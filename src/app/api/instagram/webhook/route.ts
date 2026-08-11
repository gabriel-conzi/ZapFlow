import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchInstagramAccountByIgUserId, getOrCreateContact, getOrCreateConversation } from "@/lib/instagram";
import { triggerAutomationsForMessage } from "@/lib/automations";

// Verificação inicial exigida pela Meta ao cadastrar a URL do webhook no
// Meta Developer (Products → Webhooks → Instagram). Veja o README.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

type IgMessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type: string; payload?: { url?: string } }>;
  };
};

type IgEntry = {
  id: string; // ID da conta do Instagram que recebeu o evento
  time?: number;
  messaging?: IgMessagingEvent[];
};

// Recebe os eventos em tempo real do Instagram (Fase 2: mensagens de
// Direct). A Meta exige resposta 200 em até 20s, então sempre respondemos
// "received: true" mesmo se algum item específico falhar ao processar —
// os detalhes de erro só vão pro log do servidor.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (body?.object === "instagram" && Array.isArray(body.entry)) {
    try {
      await Promise.all((body.entry as IgEntry[]).map(processEntry));
    } catch (err) {
      console.error("[instagram/webhook] erro ao processar evento:", err);
    }
  } else if (body) {
    console.log("[instagram/webhook] evento ignorado (formato não tratado):", JSON.stringify(body));
  }

  return NextResponse.json({ received: true });
}

async function processEntry(entry: IgEntry) {
  if (!entry.messaging?.length) return;

  const account = await fetchInstagramAccountByIgUserId(entry.id);
  if (!account) {
    console.warn(`[instagram/webhook] evento pra conta ${entry.id}, que não está conectada no banco`);
    return;
  }

  for (const event of entry.messaging) {
    const msg = event.message;
    // "is_echo" é a confirmação da própria Meta de uma mensagem que NÓS
    // enviamos (via /api/instagram/send). Já salvamos ela na hora de
    // enviar, então ignoramos aqui pra não duplicar.
    if (!msg || msg.is_echo) continue;

    const contact = await getOrCreateContact({
      workspaceId: account.workspaceId,
      instagramAccountId: account.id,
      igScopedId: event.sender.id,
      accessToken: account.accessToken,
    });

    const conversation = await getOrCreateConversation({
      workspaceId: account.workspaceId,
      contactId: contact.id,
      channel: "dm",
    });

    const mediaUrl = msg.attachments?.[0]?.payload?.url ?? null;

    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: "inbound",
      sender: "contact",
      text: msg.text ?? null,
      mediaUrl,
      igMessageId: msg.mid,
    });

    await db
      .update(conversations)
      .set({
        updatedAt: new Date(),
        status: "open",
        unreadCount: sql`${conversations.unreadCount} + 1`,
      })
      .where(eq(conversations.id, conversation.id));

    await db.update(contacts).set({ lastInteractionAt: new Date() }).where(eq(contacts.id, contact.id));

    // dispara automações (palavra-chave / boas-vindas) depois de salvar a
    // mensagem — se der erro, não deve derrubar o recebimento da mensagem em si
    try {
      const existingMessages = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversationId, conversation.id));
      const isFirstMessage = existingMessages.length === 1;

      await triggerAutomationsForMessage({
        workspaceId: account.workspaceId,
        contactId: contact.id,
        conversationId: conversation.id,
        messageText: msg.text ?? null,
        isFirstMessage,
      });
    } catch (err) {
      console.error("[instagram/webhook] erro ao disparar automação:", err);
    }
  }
}
