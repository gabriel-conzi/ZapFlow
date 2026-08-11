import { db } from "@/db";
import {
  automationLogs,
  automationRuns,
  automations,
  contactTags,
  contacts,
  conversations,
  instagramAccounts,
  messages,
  tags,
} from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { sendInstagramMessage } from "@/lib/instagram";
import type { AutomationFlow, DelayNodeData, AddTagNodeData, ConditionNodeData, SendMessageNodeData } from "@/lib/automation-types";

type RunRow = typeof automationRuns.$inferSelect;

function findNode(flow: AutomationFlow, id: string | null) {
  if (!id) return null;
  return flow.nodes.find((n) => n.id === id) ?? null;
}

function nextNodeId(flow: AutomationFlow, fromId: string, handle?: string) {
  const edge = flow.edges.find(
    (e) => e.source === fromId && (handle === undefined ? true : (e.sourceHandle ?? "default") === handle)
  );
  return edge?.target ?? null;
}

/** Verifica se o gatilho de um fluxo bate com a mensagem recebida. */
export function matchesTrigger(
  flow: AutomationFlow,
  params: { messageText: string | null; isFirstMessage: boolean }
): boolean {
  const trigger = flow.nodes.find((n) => n.type === "trigger");
  if (!trigger || trigger.type !== "trigger") return false;

  if (trigger.data.triggerType === "welcome") return params.isFirstMessage;

  if (trigger.data.triggerType === "keyword") {
    const keywords = trigger.data.keywords ?? [];
    if (keywords.length === 0) return false;
    const text = (params.messageText ?? "").toLowerCase();
    return keywords.some((k) => k.trim() && text.includes(k.trim().toLowerCase()));
  }

  return false;
}

/** Acha, entre as automações ativas do workspace, a primeira cujo gatilho bate — e a inicia. */
export async function triggerAutomationsForMessage(params: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  messageText: string | null;
  isFirstMessage: boolean;
}) {
  const { workspaceId, contactId, conversationId, messageText, isFirstMessage } = params;

  const active = await db
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.status, "active")));

  for (const automation of active) {
    const flow = automation.flow as AutomationFlow;
    if (matchesTrigger(flow, { messageText, isFirstMessage })) {
      await startAutomationRun({ automationId: automation.id, flow, contactId, conversationId });
      // só dispara a primeira automação que bater, pra não mandar respostas duplicadas
      break;
    }
  }
}

export async function startAutomationRun(params: {
  automationId: string;
  flow: AutomationFlow;
  contactId: string;
  conversationId: string;
}) {
  const { automationId, flow, contactId, conversationId } = params;
  const trigger = flow.nodes.find((n) => n.type === "trigger");
  const firstStepId = trigger ? nextNodeId(flow, trigger.id) : null;

  const [run] = await db
    .insert(automationRuns)
    .values({ automationId, contactId, conversationId, status: "running", nextNodeId: firstStepId })
    .returning();

  await db.insert(automationLogs).values({ automationId, contactId, status: "triggered" });

  await advanceRun(run, flow);
}

/** Retoma execuções que estavam esperando (nó de delay) e já venceram o prazo. */
export async function resumeDueRuns() {
  const due = await db
    .select()
    .from(automationRuns)
    .where(and(eq(automationRuns.status, "waiting"), lte(automationRuns.resumeAt, new Date())));

  let resumed = 0;
  for (const run of due) {
    const [automation] = await db.select().from(automations).where(eq(automations.id, run.automationId)).limit(1);
    if (!automation) continue;

    const flow = automation.flow as AutomationFlow;
    await db
      .update(automationRuns)
      .set({ status: "running", resumeAt: null, updatedAt: new Date() })
      .where(eq(automationRuns.id, run.id));

    const [fresh] = await db.select().from(automationRuns).where(eq(automationRuns.id, run.id)).limit(1);
    if (fresh) {
      await advanceRun(fresh, flow);
      resumed += 1;
    }
  }
  return resumed;
}

async function persistNext(run: RunRow, nextId: string | null) {
  const [updated] = await db
    .update(automationRuns)
    .set({ nextNodeId: nextId, updatedAt: new Date() })
    .where(eq(automationRuns.id, run.id))
    .returning();
  return updated;
}

async function markCompleted(run: RunRow) {
  await db.update(automationRuns).set({ status: "completed", updatedAt: new Date() }).where(eq(automationRuns.id, run.id));
  await db.insert(automationLogs).values({ automationId: run.automationId, contactId: run.contactId, status: "completed" });
}

async function markFailed(run: RunRow, detail: string) {
  await db.update(automationRuns).set({ status: "failed", updatedAt: new Date() }).where(eq(automationRuns.id, run.id));
  await db.insert(automationLogs).values({ automationId: run.automationId, contactId: run.contactId, status: "failed", detail });
}

async function advanceRun(initialRun: RunRow, flow: AutomationFlow) {
  let current = initialRun;

  while (true) {
    if (!current.nextNodeId) {
      await markCompleted(current);
      return;
    }

    const node = findNode(flow, current.nextNodeId);
    if (!node) {
      await markFailed(current, `Nó "${current.nextNodeId}" não existe mais no fluxo`);
      return;
    }

    try {
      if (node.type === "sendMessage") {
        await executeSendMessage(current, node.data);
        current = await persistNext(current, nextNodeId(flow, node.id));
        continue;
      }

      if (node.type === "addTag") {
        await executeAddTag(current, node.data);
        current = await persistNext(current, nextNodeId(flow, node.id));
        continue;
      }

      if (node.type === "condition") {
        const matched = await evaluateCondition(current, node.data);
        current = await persistNext(current, nextNodeId(flow, node.id, matched ? "yes" : "no"));
        continue;
      }

      if (node.type === "delay") {
        const resumeAt = computeResumeAt(node.data);
        await db
          .update(automationRuns)
          .set({ status: "waiting", resumeAt, nextNodeId: nextNodeId(flow, node.id), updatedAt: new Date() })
          .where(eq(automationRuns.id, current.id));
        await db.insert(automationLogs).values({
          automationId: current.automationId,
          contactId: current.contactId,
          status: "step",
          detail: `Esperando até ${resumeAt.toISOString()}`,
        });
        return; // pausa aqui — a função agendada retoma quando o prazo vencer
      }

      // tipo desconhecido (ex: um segundo nó de gatilho perdido no meio do fluxo) — pula
      current = await persistNext(current, nextNodeId(flow, node.id));
    } catch (err) {
      console.error("[automations] erro ao executar nó:", err);
      await markFailed(current, err instanceof Error ? err.message : "Erro desconhecido");
      return;
    }
  }
}

function computeResumeAt(data: DelayNodeData): Date {
  const msPerUnit = { seconds: 1_000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;
  const amount = Number.isFinite(data.amount) && data.amount > 0 ? data.amount : 1;
  return new Date(Date.now() + amount * msPerUnit[data.unit]);
}

async function executeSendMessage(run: RunRow, data: SendMessageNodeData) {
  if (!run.conversationId) throw new Error("Execução sem conversa associada");
  if (!data.text?.trim()) return; // nó de mensagem vazio: não faz nada, mas não quebra o fluxo

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, run.contactId)).limit(1);
  if (!contact?.instagramAccountId) throw new Error("Contato sem conta do Instagram vinculada");

  const [account] = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.id, contact.instagramAccountId))
    .limit(1);
  if (!account) throw new Error("Conta do Instagram não encontrada");

  const result = await sendInstagramMessage({
    accessToken: account.accessToken,
    recipientId: contact.igScopedId,
    text: data.text,
  });

  await db.insert(messages).values({
    conversationId: run.conversationId,
    direction: "outbound",
    sender: "automation",
    text: data.text,
    igMessageId: result.message_id ?? null,
    automationId: run.automationId,
  });

  await db
    .update(conversations)
    .set({ updatedAt: new Date(), status: "open" })
    .where(eq(conversations.id, run.conversationId));
}

async function getTagByName(workspaceId: string, name: string) {
  const [existing] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.workspaceId, workspaceId), eq(tags.name, name)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db.insert(tags).values({ workspaceId, name }).returning();
  return created;
}

async function executeAddTag(run: RunRow, data: AddTagNodeData) {
  if (!data.tagName?.trim()) return;

  const [automation] = await db.select().from(automations).where(eq(automations.id, run.automationId)).limit(1);
  if (!automation) throw new Error("Automação não encontrada");

  const tag = await getTagByName(automation.workspaceId, data.tagName.trim());

  const [existingLink] = await db
    .select()
    .from(contactTags)
    .where(and(eq(contactTags.contactId, run.contactId), eq(contactTags.tagId, tag.id)))
    .limit(1);
  if (!existingLink) {
    await db.insert(contactTags).values({ contactId: run.contactId, tagId: tag.id });
  }
}

async function evaluateCondition(run: RunRow, data: ConditionNodeData) {
  if (!data.tagName?.trim()) return false;

  const [automation] = await db.select().from(automations).where(eq(automations.id, run.automationId)).limit(1);
  if (!automation) return false;

  const [tag] = await db
    .select()
    .from(tags)
    .where(and(eq(tags.workspaceId, automation.workspaceId), eq(tags.name, data.tagName.trim())))
    .limit(1);
  if (!tag) return false;

  const [link] = await db
    .select()
    .from(contactTags)
    .where(and(eq(contactTags.contactId, run.contactId), eq(contactTags.tagId, tag.id)))
    .limit(1);
  return Boolean(link);
}
