import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  fetchEmailAccountByFromAddress,
  fetchReceivedEmailBody,
  getOrCreateEmailContact,
  parseEmailAddress,
  verifyResendWebhookSignature,
} from "@/lib/email";
import { getOrCreateConversation } from "@/lib/instagram";
import { handleOptControlKeyword, maybeReplyWithAi, triggerAutomationsForMessage } from "@/lib/automations";

type ResendEmailReceivedEvent = {
  type: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject?: string;
    message_id?: string;
  };
};

// Webhook da Resend (evento "email.received"). Precisa do corpo BRUTO (texto)
// pra verificar a assinatura antes de confiar no conteúdo — por isso lemos
// com req.text() em vez de req.json() direto.
export async function POST(req: Request) {
  const rawBody = await req.text();

  const valid = verifyResendWebhookSignature({
    payload: rawBody,
    svixId: req.headers.get("svix-id"),
    svixTimestamp: req.headers.get("svix-timestamp"),
    svixSignature: req.headers.get("svix-signature"),
  });
  if (!valid) {
    console.warn("[email/webhook] assinatura inválida, ignorando");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const event = JSON.parse(rawBody) as ResendEmailReceivedEvent;

  if (event.type !== "email.received") {
    return NextResponse.json({ received: true });
  }

  try {
    const toAddress = event.data.to?.[0];
    if (!toAddress) return NextResponse.json({ received: true });

    const account = await fetchEmailAccountByFromAddress(toAddress);
    if (!account) {
      console.warn(`[email/webhook] e-mail pra ${toAddress}, que não está conectado no ZapFlow`);
      return NextResponse.json({ received: true });
    }

    const full = await fetchReceivedEmailBody(event.data.email_id);
    const { name, email } = parseEmailAddress(full.from);

    const contact = await getOrCreateEmailContact({
      workspaceId: account.workspaceId,
      emailAccountId: account.id,
      email,
      name,
    });

    const conversation = await getOrCreateConversation({
      workspaceId: account.workspaceId,
      contactId: contact.id,
      channel: "dm",
    });

    const bodyText = full.text?.trim() || full.html?.replace(/<[^>]+>/g, " ").trim() || null;

    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: "inbound",
      sender: "contact",
      text: bodyText,
      igMessageId: full.message_id ?? event.data.message_id ?? null,
    });

    await db
      .update(conversations)
      .set({
        updatedAt: new Date(),
        status: "open",
        unreadCount: sql`${conversations.unreadCount} + 1`,
        subject: full.subject ?? event.data.subject ?? conversation.subject,
      })
      .where(eq(conversations.id, conversation.id));

    await db.update(contacts).set({ lastInteractionAt: new Date() }).where(eq(contacts.id, contact.id));

    const handled = await handleOptControlKeyword({
      contactId: contact.id,
      conversationId: conversation.id,
      text: bodyText,
      accessToken: account.fromAddress,
      recipientId: contact.igScopedId,
      platform: "email",
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
        messageText: bodyText,
        isFirstMessage,
      });

      if (!matched) {
        await maybeReplyWithAi({
          workspaceId: account.workspaceId,
          contactId: contact.id,
          conversationId: conversation.id,
          accessToken: account.fromAddress,
          recipientId: contact.igScopedId,
          platform: "email",
        });
      }
    }
  } catch (err) {
    console.error("[email/webhook] erro ao processar e-mail recebido:", err);
  }

  return NextResponse.json({ received: true });
}
