import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  fetchEmailAccountByFromAddress,
  getOrCreateEmailContact,
  parseEmailAddress,
  verifyMailgunWebhookSignature,
} from "@/lib/email";
import { getOrCreateConversation } from "@/lib/instagram";
import { handleOptControlKeyword, maybeReplyWithAi, triggerAutomationsForMessage } from "@/lib/automations";

// Webhook da Mailgun (Route com action forward() apontando pra cá). A Mailgun
// manda um POST application/x-www-form-urlencoded (ou multipart/form-data se
// tiver anexo) — diferente de outros webhooks desse app, já vem com o corpo
// do e-mail direto, sem precisar de uma chamada extra pra API.
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  const valid = verifyMailgunWebhookSignature({
    timestamp: form.get("timestamp")?.toString() ?? null,
    token: form.get("token")?.toString() ?? null,
    signature: form.get("signature")?.toString() ?? null,
  });
  if (!valid) {
    console.warn("[email/webhook] assinatura inválida, ignorando");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  try {
    const toAddress = form.get("recipient")?.toString();
    if (!toAddress) return NextResponse.json({ received: true });

    const account = await fetchEmailAccountByFromAddress(toAddress);
    if (!account) {
      console.warn(`[email/webhook] e-mail pra ${toAddress}, que não está conectado no ZapFlow`);
      return NextResponse.json({ received: true });
    }

    const fromRaw = form.get("from")?.toString() ?? form.get("sender")?.toString() ?? "";
    const { name, email } = parseEmailAddress(fromRaw);
    const subject = form.get("subject")?.toString() ?? "";
    const bodyText =
      form.get("stripped-text")?.toString().trim() ||
      form.get("body-plain")?.toString().trim() ||
      form
        .get("body-html")
        ?.toString()
        .replace(/<[^>]+>/g, " ")
        .trim() ||
      null;
    const messageId = form.get("Message-Id")?.toString() ?? null;

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

    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: "inbound",
      sender: "contact",
      text: bodyText,
      igMessageId: messageId,
    });

    await db
      .update(conversations)
      .set({
        updatedAt: new Date(),
        status: "open",
        unreadCount: sql`${conversations.unreadCount} + 1`,
        subject: subject || conversation.subject,
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
