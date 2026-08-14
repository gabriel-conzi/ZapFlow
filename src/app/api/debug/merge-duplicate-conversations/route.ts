import { NextResponse } from "next/server";
import { db } from "@/db";
import { automationRuns, conversations, messages } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Rota de limpeza única: até essa correção, cada contato podia acabar com
// duas conversas na Inbox (uma pro canal "comment", outra pro "dm"), porque
// getOrCreateConversation() buscava por contato + canal. Agora ele busca só
// por contato, então essa duplicação não acontece mais daqui pra frente —
// essa rota só existe pra juntar as conversas que já ficaram duplicadas
// antes da correção. Protegida pelo mesmo login do painel.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await db
    .select({ id: conversations.id, contactId: conversations.contactId, createdAt: conversations.createdAt, unreadCount: conversations.unreadCount, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.workspaceId, workspace.id))
    .orderBy(asc(conversations.createdAt));

  const byContact = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byContact.get(row.contactId) ?? [];
    list.push(row);
    byContact.set(row.contactId, list);
  }

  const merged: Array<{ contactId: string; keptConversationId: string; mergedConversationIds: string[] }> = [];

  for (const [contactId, group] of byContact) {
    if (group.length < 2) continue;
    const [primary, ...duplicates] = group; // mais antiga vira a "principal"

    for (const dup of duplicates) {
      await db.update(messages).set({ conversationId: primary.id }).where(eq(messages.conversationId, dup.id));
      await db.update(automationRuns).set({ conversationId: primary.id }).where(eq(automationRuns.conversationId, dup.id));
      await db
        .update(conversations)
        .set({
          unreadCount: sql`${conversations.unreadCount} + ${dup.unreadCount}`,
          updatedAt: dup.updatedAt > primary.updatedAt ? dup.updatedAt : primary.updatedAt,
        })
        .where(eq(conversations.id, primary.id));
      await db.delete(conversations).where(eq(conversations.id, dup.id));
    }

    merged.push({ contactId, keptConversationId: primary.id, mergedConversationIds: duplicates.map((d) => d.id) });
  }

  return NextResponse.json({ merged, contactsAffected: merged.length });
}
