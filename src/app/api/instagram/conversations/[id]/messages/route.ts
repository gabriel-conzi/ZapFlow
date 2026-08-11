import { NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Retorna todas as mensagens de uma conversa (mais antiga primeiro, pra
// montar o chat de cima pra baixo) e zera o contador de não lidas.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.workspaceId, workspace.id)))
    .limit(1);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const thread = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));

  if (conversation.unreadCount > 0) {
    await db.update(conversations).set({ unreadCount: 0 }).where(eq(conversations.id, id));
  }

  return NextResponse.json({ messages: thread });
}
