import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchTelegramAccountById, getOrCreateTelegramContact } from "@/lib/telegram";
import { getOrCreateConversation } from "@/lib/instagram";
import { handleOptControlKeyword, maybeReplyWithAi, triggerAutomationsForMessage } from "@/lib/automations";

type TelegramUpdate = {
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { id: number; first_name?: string; last_name?: string; username?: string };
  };
};

// Cada bot tem sua própria URL de webhook (/api/telegram/webhook/<id da conta
// no nosso banco>) — diferente do Instagram/Facebook, o Telegram não manda um
// "hub.challenge" de verificação, só passamos a checar o header do secret.
export async function POST(req: Request, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const body = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!body) return NextResponse.json({ received: true });

  try {
    const account = await fetchTelegramAccountById(accountId);
    if (!account) {
      console.warn(`[telegram/webhook] conta ${accountId} não encontrada`);
      return NextResponse.json({ received: true });
    }

    const secret = req.headers.get("x-telegram-bot-api-secret-token");
    if (secret !== account.webhookSecret) {
      console.warn(`[telegram/webhook] secret inválido pra conta ${accountId}`);
      return NextResponse.json({ received: true });
    }

    const msg = body.message;
    if (!msg?.text || !msg.chat) return NextResponse.json({ received: true });

    const chatId = String(msg.chat.id);

    const contact = await getOrCreateTelegramContact({
      workspaceId: account.workspaceId,
      telegramAccountId: account.id,
      chatId,
      firstName: msg.from?.first_name,
      lastName: msg.from?.last_name,
      username: msg.from?.username,
    });

    const conversation = await getOrCreateConversation({
      workspaceId: account.workspaceId,
      contactId: contact.id,
      channel: "dm",
    });

    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: "inbound",
      sender: "contact",
      text: msg.text,
      igMessageId: String(msg.message_id),
    });

    await db
      .update(conversations)
      .set({ updatedAt: new Date(), status: "open", unreadCount: sql`${conversations.unreadCount} + 1` })
      .where(eq(conversations.id, conversation.id));

    await db.update(contacts).set({ lastInteractionAt: new Date() }).where(eq(contacts.id, contact.id));

    const handled = await handleOptControlKeyword({
      contactId: contact.id,
      conversationId: conversation.id,
      text: msg.text,
      accessToken: account.botToken,
      recipientId: chatId,
      platform: "telegram",
    });

    if (!handled) {
      const existingMessages = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversationId, conversation.id));
      const isFirstMessage = existingMessages.length === 1;

      const matched = await triggerAutomationsForMessage({
        workspaceId: account.workspaceId,
        contactId: contact.id,
        conversationId: conversation.id,
        messageText: msg.text,
        isFirstMessage,
        channelPlatform: "telegram",
        channelAccountId: account.id,
      });

      if (!matched) {
        await maybeReplyWithAi({
          workspaceId: account.workspaceId,
          contactId: contact.id,
          conversationId: conversation.id,
          accessToken: account.botToken,
          recipientId: chatId,
          platform: "telegram",
        });
      }
    }
  } catch (err) {
    console.error("[telegram/webhook] erro ao processar evento:", err);
  }

  return NextResponse.json({ received: true });
}
