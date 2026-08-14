import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Lista as conversas do workspace logado, mais recentes primeiro, já com
// uma prévia da última mensagem — usado pela coluna esquerda da Inbox.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      status: conversations.status,
      unreadCount: conversations.unreadCount,
      updatedAt: conversations.updatedAt,
      contact: {
        id: contacts.id,
        name: contacts.name,
        username: contacts.username,
        profilePicUrl: contacts.profilePicUrl,
        platform: contacts.platform,
      },
    })
    .from(conversations)
    .innerJoin(contacts, eq(conversations.contactId, contacts.id))
    .where(eq(conversations.workspaceId, workspace.id))
    .orderBy(desc(conversations.updatedAt));

  const withPreview = await Promise.all(
    rows.map(async (conversation) => {
      const [last] = await db
        .select({ text: messages.text, direction: messages.direction, createdAt: messages.createdAt })
        .from(messages)
        .where(eq(messages.conversationId, conversation.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);
      return { ...conversation, lastMessage: last ?? null };
    })
  );

  return NextResponse.json({ conversations: withPreview });
}
