import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { fetchFacebookPageByPageId, getOrCreateFacebookContact, isOwnConnectedFacebookSender } from "@/lib/facebook";
import { getOrCreateConversation } from "@/lib/instagram";
import {
  handleOptControlKeyword,
  maybeReplyWithAi,
  resumeRunWaitingForButton,
  triggerAutomationsForComment,
  triggerAutomationsForMessage,
} from "@/lib/automations";

// Verificação inicial exigida pela Meta ao cadastrar a URL do webhook no
// Meta Developer (Products → Webhooks → Page).
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

type FbMessagingEvent = {
  sender: { id: string };
  recipient: { id: string };
  timestamp?: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: Array<{ type: string; payload?: { url?: string } }>;
  };
  // presente quando o contato aperta um botão de "ramificar conversa" (nosso
  // botão do tipo "reply" vira "postback" na Send API) — `payload` é o id
  // do botão que a gente mandou ao enviar a mensagem.
  postback?: { mid?: string; title?: string; payload?: string };
};

type FbFeedChange = {
  field: string; // "feed"
  value: {
    item?: string; // "comment" | "post" | "reaction" | ...
    verb?: string; // "add" | "edited" | "remove"
    comment_id?: string;
    post_id?: string;
    message?: string;
    from?: { id: string; name?: string };
  };
};

type FbEntry = {
  id: string; // ID da Página que recebeu o evento
  time?: number;
  messaging?: FbMessagingEvent[];
  changes?: FbFeedChange[];
};

// Recebe os eventos em tempo real da Página do Facebook: mensagens de
// Messenger e comentários em posts. Mesmo contrato do webhook do Instagram
// (resposta 200 rápida, erros só vão pro log).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (body?.object === "page" && Array.isArray(body.entry)) {
    try {
      await Promise.all(
        (body.entry as FbEntry[]).map(async (entry) => {
          await processMessagingEntry(entry);
          await processFeedEntry(entry);
        })
      );
    } catch (err) {
      console.error("[facebook/webhook] erro ao processar evento:", err);
    }
  } else if (body) {
    console.log("[facebook/webhook] evento ignorado (formato não tratado):", JSON.stringify(body));
  }

  return NextResponse.json({ received: true });
}

async function processMessagingEntry(entry: FbEntry) {
  if (!entry.messaging?.length) return;

  const page = await fetchFacebookPageByPageId(entry.id);
  if (!page) {
    console.warn(`[facebook/webhook] evento pra Página ${entry.id}, que não está conectada no banco`);
    return;
  }

  for (const event of entry.messaging) {
    const msg = event.message;
    const postback = event.postback;
    // "is_echo" é a confirmação da própria Meta de uma mensagem que NÓS
    // enviamos — já salva na hora de enviar, ignora aqui pra não duplicar.
    if (msg?.is_echo) continue;
    if (!msg && !postback) continue;

    // remetente é OUTRA Página do Facebook já conectada nesse workspace —
    // ignora completamente, mesma lógica (e mesmo motivo) do webhook do
    // Instagram. Ver isOwnConnectedFacebookSender() em src/lib/facebook.ts.
    if (await isOwnConnectedFacebookSender(page.workspaceId, event.sender.id)) {
      console.warn(
        `[facebook/webhook] mensagem de ${event.sender.id} ignorada — é outra Página própria conectada, não um contato real`
      );
      continue;
    }

    const contact = await getOrCreateFacebookContact({
      workspaceId: page.workspaceId,
      facebookPageId: page.id,
      psid: event.sender.id,
      accessToken: page.accessToken,
    });

    const conversation = await getOrCreateConversation({
      workspaceId: page.workspaceId,
      contactId: contact.id,
      channel: "dm",
    });

    const mediaUrl = msg?.attachments?.[0]?.payload?.url ?? null;
    // postback (clique num botão de ramificação) não tem texto de verdade —
    // usa o título do botão só pra aparecer legível na Inbox.
    const text = msg?.text ?? postback?.title ?? null;

    await db.insert(messages).values({
      conversationId: conversation.id,
      direction: "inbound",
      sender: "contact",
      text,
      mediaUrl,
      igMessageId: msg?.mid ?? postback?.mid ?? null,
    });

    await db
      .update(conversations)
      .set({ updatedAt: new Date(), status: "open", unreadCount: sql`${conversations.unreadCount} + 1` })
      .where(eq(conversations.id, conversation.id));

    await db.update(contacts).set({ lastInteractionAt: new Date() }).where(eq(contacts.id, contact.id));

    try {
      // se tinha uma automação pausada esperando o contato escolher um botão
      // (de ramificação), tenta resolver por aqui primeiro — via o payload
      // do postback (clique de verdade) ou, se a pessoa digitou em vez de
      // clicar, tentando casar pelo texto do botão.
      const handledByButton = await resumeRunWaitingForButton({
        contactId: contact.id,
        payload: postback?.payload ?? null,
        messageText: msg?.text ?? null,
      });

      // um postback sem nenhuma execução esperando (ex: clique duplicado
      // reenviado pela Meta) não deve acionar mais nada.
      if (!handledByButton && msg) {
        const handled = await handleOptControlKeyword({
          contactId: contact.id,
          conversationId: conversation.id,
          text: msg.text ?? null,
          accessToken: page.accessToken,
          recipientId: contact.igScopedId,
          platform: "facebook",
        });

        if (!handled) {
          const existingMessages = await db
            .select({ id: messages.id })
            .from(messages)
            .where(eq(messages.conversationId, conversation.id));
          const isFirstMessage = existingMessages.length === 1;

          const matched = await triggerAutomationsForMessage({
            workspaceId: page.workspaceId,
            contactId: contact.id,
            conversationId: conversation.id,
            messageText: msg.text ?? null,
            isFirstMessage,
            channelPlatform: "facebook",
            channelAccountId: page.id,
          });

          if (!matched) {
            await maybeReplyWithAi({
              workspaceId: page.workspaceId,
              contactId: contact.id,
              conversationId: conversation.id,
              accessToken: page.accessToken,
              recipientId: contact.igScopedId,
              platform: "facebook",
            });
          }
        }
      }
    } catch (err) {
      console.error("[facebook/webhook] erro ao disparar automação:", err);
    }
  }
}

async function processFeedEntry(entry: FbEntry) {
  const feedChanges = entry.changes?.filter((c) => c.field === "feed") ?? [];
  if (!feedChanges.length) return;

  const page = await fetchFacebookPageByPageId(entry.id);
  if (!page) {
    console.warn(`[facebook/webhook] comentário pra Página ${entry.id}, que não está conectada no banco`);
    return;
  }

  for (const change of feedChanges) {
    const item = change.value;
    // só nos interessa comentário novo — ignora edições, remoções, curtidas,
    // posts novos etc.
    if (item.item !== "comment" || item.verb !== "add") continue;
    if (!item.comment_id || !item.from?.id) continue;
    // ignora comentários feitos pela própria Página (evita loop se um dia a
    // automação também responder publicamente)
    if (item.from.id === page.pageId) continue;

    try {
      const contact = await getOrCreateFacebookContact({
        workspaceId: page.workspaceId,
        facebookPageId: page.id,
        psid: item.from.id,
        accessToken: page.accessToken,
        fallbackName: item.from.name,
      });

      const conversation = await getOrCreateConversation({
        workspaceId: page.workspaceId,
        contactId: contact.id,
        channel: "comment",
      });

      await db.insert(messages).values({
        conversationId: conversation.id,
        direction: "inbound",
        sender: "contact",
        text: item.message ?? null,
        igMessageId: item.comment_id,
        // reaproveitando mediaUrl (não usado em comentários) só pra guardar o
        // post_id bruto que a Meta mandou — ajuda a debugar automação de
        // comentário vinculada a post específico que não bate o mediaId
        mediaUrl: item.post_id ?? null,
      });

      await db
        .update(conversations)
        .set({ updatedAt: new Date(), status: "open", unreadCount: sql`${conversations.unreadCount} + 1` })
        .where(eq(conversations.id, conversation.id));

      await db.update(contacts).set({ lastInteractionAt: new Date() }).where(eq(contacts.id, contact.id));

      const handled = await handleOptControlKeyword({
        contactId: contact.id,
        conversationId: conversation.id,
        text: item.message ?? null,
        accessToken: page.accessToken,
        recipientId: contact.igScopedId,
        commentId: item.comment_id,
        platform: "facebook",
      });

      if (!handled) {
        await triggerAutomationsForComment({
          workspaceId: page.workspaceId,
          contactId: contact.id,
          conversationId: conversation.id,
          commentId: item.comment_id,
          commentText: item.message ?? null,
          mediaId: item.post_id ?? null,
          channelPlatform: "facebook",
          channelAccountId: page.id,
        });
      }
    } catch (err) {
      console.error("[facebook/webhook] erro ao processar comentário:", err);
    }
  }
}
