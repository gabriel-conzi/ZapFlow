import { db } from "@/db";
import {
  automationLogs,
  automationRuns,
  automations,
  contactTags,
  contacts,
  conversations,
  emailAccounts,
  facebookPages,
  instagramAccounts,
  telegramAccounts,
  messages,
  tags,
} from "@/db/schema";
import { and, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { sendInstagramMessage } from "@/lib/instagram";
import { sendFacebookMessage } from "@/lib/facebook";
import { sendTelegramMessage } from "@/lib/telegram";
import { sendEmailMessage } from "@/lib/email";
import { generateAiReply } from "@/lib/ai";
import { getMessageButtons, hasReplyButtons, toSendableButtons } from "@/lib/automation-types";
import type {
  AutomationFlow,
  DelayNodeData,
  AddTagNodeData,
  ConditionNodeData,
  SendMessageNodeData,
  SendableButton,
} from "@/lib/automation-types";

/** Troca `{{chave}}` (case-sensitive, só letras/números/underscore no nome do
 * campo) pelo valor guardado em `contacts.customFields` — vazio se o campo
 * não existir. Usado antes de mandar qualquer mensagem, pra permitir algo
 * como "Oi {{nome}}, aqui está..." depois de um nó "Capturar dado". */
function interpolateFields(text: string, fields: unknown): string {
  const map = (fields && typeof fields === "object" ? (fields as Record<string, unknown>) : {}) ?? {};
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = map[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

type RunRow = typeof automationRuns.$inferSelect;
type Platform = "instagram" | "facebook" | "telegram" | "email";

/** Escolhe a função de envio certa pra plataforma do contato. */
export function sendPlatformMessage(
  platform: Platform,
  params: {
    accessToken: string;
    recipientId?: string;
    commentId?: string;
    text: string;
    subject?: string;
    buttons?: SendableButton[];
  }
) {
  if (platform === "facebook") return sendFacebookMessage(params);
  if (platform === "telegram") return sendTelegramMessage(params);
  if (platform === "email") return sendEmailMessage(params);
  return sendInstagramMessage(params);
}

/** Busca o assunto guardado da conversa (só existe pro canal de e-mail) e
 * devolve pronto pra usar como "Re: assunto original". */
async function emailReplySubject(conversationId: string | null): Promise<string | undefined> {
  if (!conversationId) return undefined;
  const [conv] = await db
    .select({ subject: conversations.subject })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv?.subject) return undefined;
  return conv.subject.toLowerCase().startsWith("re:") ? conv.subject : `Re: ${conv.subject}`;
}

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

type TriggerEvent =
  | { kind: "dm"; messageText: string | null; isFirstMessage: boolean }
  | { kind: "comment"; commentText: string | null; mediaId: string | null };

/** Verifica se o gatilho de um fluxo bate com o evento recebido (DM ou comentário). */
export function matchesTrigger(flow: AutomationFlow, event: TriggerEvent): boolean {
  const trigger = flow.nodes.find((n) => n.type === "trigger");
  if (!trigger || trigger.type !== "trigger") return false;

  if (event.kind === "dm") {
    if (trigger.data.triggerType === "welcome") return event.isFirstMessage;
    if (trigger.data.triggerType === "keyword") {
      const keywords = trigger.data.keywords ?? [];
      if (keywords.length === 0) return false;
      const text = (event.messageText ?? "").toLowerCase();
      return keywords.some((k) => k.trim() && text.includes(k.trim().toLowerCase()));
    }
    return false;
  }

  // event.kind === "comment"
  if (trigger.data.triggerType !== "comment") return false;
  // se essa automação está vinculada a um post específico, só bate se o
  // comentário foi feito exatamente nesse post/reels
  if (trigger.data.mediaId && trigger.data.mediaId !== event.mediaId) return false;
  const keywords = trigger.data.keywords ?? [];
  if (keywords.length === 0) return false;
  const text = (event.commentText ?? "").toLowerCase();
  return keywords.some((k) => k.trim() && text.includes(k.trim().toLowerCase()));
}

const OPT_OUT_WORDS = ["parar", "pare", "cancelar", "sair", "descadastrar", "stop"];
const OPT_IN_WORDS = ["voltar", "reativar"];

function normalizeControlText(text: string | null): string {
  return (text ?? "")
    .toLowerCase()
    .trim()
    .replace(/[!.?]+$/, "");
}

/**
 * Trata comandos globais de opt-out/opt-in ("parar", "voltar" etc.) — têm
 * prioridade sobre qualquer automação normal e funcionam mesmo sem nenhuma
 * automação configurada pra eles. Precisa ser a mensagem inteira (não uma
 * palavra dentro de uma frase maior), pra não disparar por engano.
 * Retorna true se a mensagem era um desses comandos — nesse caso quem chamou
 * NÃO deve rodar o disparo normal de automações pra essa mensagem.
 */
export async function handleOptControlKeyword(params: {
  contactId: string;
  conversationId: string;
  text: string | null;
  accessToken: string;
  recipientId: string;
  commentId?: string;
  platform: Platform;
}): Promise<boolean> {
  const normalized = normalizeControlText(params.text);
  if (!normalized) return false;

  const isOptOut = OPT_OUT_WORDS.includes(normalized);
  const isOptIn = OPT_IN_WORDS.includes(normalized);
  if (!isOptOut && !isOptIn) return false;

  await db.update(contacts).set({ optedOut: isOptOut }).where(eq(contacts.id, params.contactId));

  if (isOptOut) {
    // cancela qualquer automação em andamento ou esperando pra esse contato
    await db
      .update(automationRuns)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(eq(automationRuns.contactId, params.contactId), inArray(automationRuns.status, ["running", "waiting"]))
      );
  }

  const confirmText = isOptOut
    ? 'Combinado! Você não vai mais receber mensagens automáticas por aqui. Se mudar de ideia, é só mandar "voltar".'
    : "Prontinho, você voltou a receber nossas mensagens automáticas. 🎉";

  try {
    const result = await sendPlatformMessage(params.platform, {
      accessToken: params.accessToken,
      recipientId: params.recipientId,
      commentId: params.commentId,
      text: confirmText,
      subject: params.platform === "email" ? await emailReplySubject(params.conversationId) : undefined,
    });
    await db.insert(messages).values({
      conversationId: params.conversationId,
      direction: "outbound",
      sender: "automation",
      text: confirmText,
      igMessageId: result.message_id ?? null,
    });
  } catch (err) {
    console.error("[automations] erro ao confirmar opt-out/opt-in:", err);
  }

  return true;
}

/**
 * Acha, entre as automações ativas do workspace, a primeira cujo gatilho bate
 * com a mensagem de Direct — e a inicia. Retorna true se alguma automação foi
 * disparada (o chamador usa isso pra decidir se cai no fallback de IA).
 */
export async function triggerAutomationsForMessage(params: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  messageText: string | null;
  isFirstMessage: boolean;
}): Promise<boolean> {
  const { workspaceId, contactId, conversationId, messageText, isFirstMessage } = params;

  const [contact] = await db
    .select({ optedOut: contacts.optedOut })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (contact?.optedOut) return false;

  const active = await db
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.status, "active")));

  for (const automation of active) {
    const flow = automation.flow as AutomationFlow;
    if (matchesTrigger(flow, { kind: "dm", messageText, isFirstMessage })) {
      await startAutomationRun({ automationId: automation.id, flow, contactId, conversationId });
      // só dispara a primeira automação que bater, pra não mandar respostas duplicadas
      return true;
    }
  }
  return false;
}

/**
 * Fallback de IA: chamado quando nenhuma automação bateu com a mensagem
 * recebida (e o contato não está com opt-out). Gera uma resposta com OpenAI
 * (se a IA estiver ativada em Configurações) e manda pro contato, salvando
 * como uma mensagem normal (sender "ai") no histórico da conversa.
 */
export async function maybeReplyWithAi(params: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  accessToken: string;
  recipientId: string;
  platform: Platform;
}) {
  const [contact] = await db
    .select({ optedOut: contacts.optedOut })
    .from(contacts)
    .where(eq(contacts.id, params.contactId))
    .limit(1);
  if (contact?.optedOut) return;

  const reply = await generateAiReply({ workspaceId: params.workspaceId, conversationId: params.conversationId });
  if (!reply) return;

  try {
    const result = await sendPlatformMessage(params.platform, {
      accessToken: params.accessToken,
      recipientId: params.recipientId,
      text: reply,
      subject: params.platform === "email" ? await emailReplySubject(params.conversationId) : undefined,
    });
    await db.insert(messages).values({
      conversationId: params.conversationId,
      direction: "outbound",
      sender: "ai",
      text: reply,
      igMessageId: result.message_id ?? null,
    });
    await db
      .update(conversations)
      .set({ updatedAt: new Date(), status: "open" })
      .where(eq(conversations.id, params.conversationId));
  } catch (err) {
    console.error("[automations] erro ao enviar resposta da IA:", err);
  }
}

/** Igual à de cima, mas pra comentários em posts/reels. */
export async function triggerAutomationsForComment(params: {
  workspaceId: string;
  contactId: string;
  conversationId: string;
  commentId: string;
  commentText: string | null;
  mediaId: string | null;
}) {
  const { workspaceId, contactId, conversationId, commentId, commentText, mediaId } = params;

  const [contact] = await db
    .select({ optedOut: contacts.optedOut })
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);
  if (contact?.optedOut) return;

  const active = await db
    .select()
    .from(automations)
    .where(and(eq(automations.workspaceId, workspaceId), eq(automations.status, "active")));

  for (const automation of active) {
    const flow = automation.flow as AutomationFlow;
    if (matchesTrigger(flow, { kind: "comment", commentText, mediaId })) {
      await startAutomationRun({ automationId: automation.id, flow, contactId, conversationId, commentId });
      break;
    }
  }
}

export async function startAutomationRun(params: {
  automationId: string;
  flow: AutomationFlow;
  contactId: string;
  conversationId: string;
  commentId?: string;
}) {
  const { automationId, flow, contactId, conversationId, commentId } = params;
  const trigger = flow.nodes.find((n) => n.type === "trigger");
  const firstStepId = trigger ? nextNodeId(flow, trigger.id) : null;

  const [run] = await db
    .insert(automationRuns)
    .values({
      automationId,
      contactId,
      conversationId,
      status: "running",
      nextNodeId: firstStepId,
      commentId: commentId ?? null,
    })
    .returning();

  await db.insert(automationLogs).values({ automationId, contactId, status: "triggered" });

  await advanceRun(run, flow);
}

/**
 * Retoma uma execução que estava pausada esperando o contato apertar um
 * botão de ramificação (nó de "Enviar mensagem" com botão tipo "reply").
 * `payload` é o id do botão, que a Meta devolve no evento de postback quando
 * o contato aperta de verdade — é o caminho principal. Se não vier payload
 * (o contato só digitou uma mensagem normal em vez de apertar o botão),
 * tenta casar pelo texto do botão como fallback mais frouxo.
 *
 * Retorna true se havia uma execução esperando E algum botão bateu — nesse
 * caso quem chamou NÃO deve rodar o disparo normal de automações pra essa
 * mensagem (evita resposta duplicada). Se não havia execução esperando, ou
 * nenhum botão bateu, retorna false e quem chamou segue o fluxo normal
 * (palavra-chave / IA), deixando a execução pausada como estava.
 */
export async function resumeRunWaitingForButton(params: {
  contactId: string;
  payload?: string | null;
  messageText?: string | null;
}): Promise<boolean> {
  const { contactId, payload, messageText } = params;

  const [run] = await db
    .select()
    .from(automationRuns)
    .where(
      and(eq(automationRuns.contactId, contactId), eq(automationRuns.status, "waiting"), isNull(automationRuns.resumeAt))
    )
    .orderBy(desc(automationRuns.updatedAt))
    .limit(1);
  if (!run || !run.nextNodeId) return false;

  const [automation] = await db.select().from(automations).where(eq(automations.id, run.automationId)).limit(1);
  if (!automation) return false;

  const flow = automation.flow as AutomationFlow;
  const node = findNode(flow, run.nextNodeId);
  if (!node) return false;

  if (node.type === "collectData") {
    const answer = messageText?.trim();
    if (!answer) return false; // sem texto (ex: só figurinha/anexo) — continua esperando

    const fieldName = node.data.fieldName?.trim();
    if (fieldName) {
      const [contact] = await db
        .select({ customFields: contacts.customFields })
        .from(contacts)
        .where(eq(contacts.id, run.contactId))
        .limit(1);
      const current: Record<string, string> =
        contact?.customFields && typeof contact.customFields === "object" ? contact.customFields : {};
      await db
        .update(contacts)
        .set({ customFields: { ...current, [fieldName]: answer } })
        .where(eq(contacts.id, run.contactId));
    }

    const advanced = await persistNext(run, nextNodeId(flow, node.id));
    await advanceRun(advanced, flow);
    return true;
  }

  if (node.type !== "sendMessage") return false;

  const replyButtons = getMessageButtons(node.data).filter((b) => b.kind === "reply");
  if (replyButtons.length === 0) return false;

  const normalizedText = messageText?.trim().toLowerCase();
  const matched =
    (payload ? replyButtons.find((b) => b.id === payload) : undefined) ??
    (normalizedText ? replyButtons.find((b) => b.label.trim().toLowerCase() === normalizedText) : undefined);
  if (!matched) return false;

  const advanced = await persistNext(run, nextNodeId(flow, node.id, matched.id));
  await advanceRun(advanced, flow);
  return true;
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
        if (current.commentId) {
          // só vale usar o comment_id uma vez (resposta privada ao comentário)
          await db.update(automationRuns).set({ commentId: null }).where(eq(automationRuns.id, current.id));
          current = { ...current, commentId: null };
        }

        if (hasReplyButtons(node.data)) {
          // mensagem tem botão de ramificação: pausa aqui e espera o
          // contato apertar um deles (não segue pela saída padrão). Deixa
          // nextNodeId apontando pro PRÓPRIO nó, pra saber quais botões
          // casar quando resumeRunWaitingForButton() for chamado.
          await db
            .update(automationRuns)
            .set({ status: "waiting", resumeAt: null, nextNodeId: node.id, updatedAt: new Date() })
            .where(eq(automationRuns.id, current.id));
          await db.insert(automationLogs).values({
            automationId: current.automationId,
            contactId: current.contactId,
            status: "step",
            detail: "Esperando o contato escolher um botão",
          });
          return;
        }

        current = await persistNext(current, nextNodeId(flow, node.id));
        continue;
      }

      if (node.type === "addTag") {
        await executeAddTag(current, node.data);
        current = await persistNext(current, nextNodeId(flow, node.id));
        continue;
      }

      if (node.type === "collectData") {
        if (!node.data.question?.trim()) {
          // pergunta vazia: nó mal configurado, não trava a automação por causa disso
          current = await persistNext(current, nextNodeId(flow, node.id));
          continue;
        }
        await executeSendMessage(current, { text: node.data.question });
        if (current.commentId) {
          // mesma regra do nó "Enviar mensagem": o comment_id (resposta
          // privada a um comentário) só vale pra 1 mensagem. Sem isso, a
          // próxima mensagem do fluxo (depois do contato responder) tenta
          // reusar o mesmo comment_id e a Meta rejeita ("Activity already
          // replied to" no Facebook, erro genérico no Instagram).
          await db.update(automationRuns).set({ commentId: null }).where(eq(automationRuns.id, current.id));
          current = { ...current, commentId: null };
        }
        await db
          .update(automationRuns)
          .set({ status: "waiting", resumeAt: null, nextNodeId: node.id, updatedAt: new Date() })
          .where(eq(automationRuns.id, current.id));
        await db.insert(automationLogs).values({
          automationId: current.automationId,
          contactId: current.contactId,
          status: "step",
          detail: `Esperando resposta pra capturar "${node.data.fieldName?.trim() || "campo sem nome"}"`,
        });
        return; // pausa aqui — resumeRunWaitingForButton() retoma quando o contato responder
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
  if (!contact) throw new Error("Contato não encontrado");

  let accessToken: string;
  let platform: Platform;
  if (contact.platform === "facebook") {
    if (!contact.facebookPageId) throw new Error("Contato sem Página do Facebook vinculada");
    const [page] = await db.select().from(facebookPages).where(eq(facebookPages.id, contact.facebookPageId)).limit(1);
    if (!page) throw new Error("Página do Facebook não encontrada");
    accessToken = page.accessToken;
    platform = "facebook";
  } else if (contact.platform === "telegram") {
    if (!contact.telegramAccountId) throw new Error("Contato sem bot do Telegram vinculado");
    const [account] = await db
      .select()
      .from(telegramAccounts)
      .where(eq(telegramAccounts.id, contact.telegramAccountId))
      .limit(1);
    if (!account) throw new Error("Bot do Telegram não encontrado");
    accessToken = account.botToken;
    platform = "telegram";
  } else if (contact.platform === "email") {
    if (!contact.emailAccountId) throw new Error("Contato sem conta de e-mail vinculada");
    const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, contact.emailAccountId)).limit(1);
    if (!account) throw new Error("Conta de e-mail não encontrada");
    accessToken = account.fromAddress;
    platform = "email";
  } else {
    if (!contact.instagramAccountId) throw new Error("Contato sem conta do Instagram vinculada");
    const [account] = await db
      .select()
      .from(instagramAccounts)
      .where(eq(instagramAccounts.id, contact.instagramAccountId))
      .limit(1);
    if (!account) throw new Error("Conta do Instagram não encontrada");
    accessToken = account.accessToken;
    platform = "instagram";
  }

  const text = interpolateFields(data.text, contact.customFields);

  const result = await sendPlatformMessage(platform, {
    accessToken,
    recipientId: contact.igScopedId,
    commentId: run.commentId ?? undefined,
    text,
    buttons: toSendableButtons(data),
    subject: platform === "email" ? await emailReplySubject(run.conversationId) : undefined,
  });

  await db.insert(messages).values({
    conversationId: run.conversationId,
    direction: "outbound",
    sender: "automation",
    text,
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
