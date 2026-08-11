import { NextResponse } from "next/server";
import { db } from "@/db";
import { automationLogs, automations, contacts, conversations, messages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { AutomationFlow } from "@/lib/automation-types";

// Rota de diagnóstico temporária: mostra os últimos eventos de execução de
// automações (disparo, passo, sucesso, falha) e os últimos comentários
// recebidos crus (com o post_id que a Meta mandou), pra debugar por que uma
// automação vinculada a um post específico não bateu. Protegida pelo mesmo
// login do painel.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const logs = await db
    .select({
      id: automationLogs.id,
      status: automationLogs.status,
      detail: automationLogs.detail,
      createdAt: automationLogs.createdAt,
      automationName: automations.name,
      contactName: contacts.name,
      contactUsername: contacts.username,
      contactScopedId: contacts.igScopedId,
      contactPlatform: contacts.platform,
    })
    .from(automationLogs)
    .innerJoin(automations, eq(automationLogs.automationId, automations.id))
    .leftJoin(contacts, eq(automationLogs.contactId, contacts.id))
    .where(eq(automations.workspaceId, workspace.id))
    .orderBy(desc(automationLogs.createdAt))
    .limit(30);

  const configuredTriggers = (
    await db.select().from(automations).where(eq(automations.workspaceId, workspace.id))
  ).map((a) => {
    const flow = a.flow as AutomationFlow;
    const trigger = flow.nodes.find((n) => n.type === "trigger");
    return {
      automationName: a.name,
      status: a.status,
      triggerData: trigger && trigger.type === "trigger" ? trigger.data : null,
    };
  });

  const rawComments = await db
    .select({
      id: messages.id,
      text: messages.text,
      postId: messages.mediaUrl,
      createdAt: messages.createdAt,
      contactId: conversations.contactId,
      contactName: contacts.name,
      contactPlatform: contacts.platform,
    })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(conversations.channel, "comment"))
    .orderBy(desc(messages.createdAt))
    .limit(15);

  return NextResponse.json({ logs, configuredTriggers, rawComments });
}
