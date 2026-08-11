import { NextResponse } from "next/server";
import { db } from "@/db";
import { automationLogs, automations, contacts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Rota de diagnóstico temporária: mostra os últimos eventos de execução de
// automações (disparo, passo, sucesso, falha) pra ajudar a debugar por que
// uma automação não respondeu. Protegida pelo mesmo login do painel.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await db
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

  return NextResponse.json({ logs: rows });
}
