import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  fetchInstagramAccountByIgUserId,
  getOrCreateContact,
  getOrCreateConversation,
  isOwnConnectedInstagramSender,
} from "@/lib/instagram";
import {
  handleOptControlKeyword,
  maybeReplyWithAi,
  resumeRunWaitingForButton,
  triggerAutomationsForComment,
  triggerAutomationsForMessage,
} from "@/lib/automations";

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
  // presente quando o contato aperta um botão de "ramificar conversa" (nosso
  // botão do tipo "reply" vira "postback" na Graph API) — `payload` é o id
  // do botão que a gente mandou ao enviar a mensagem.
  postback?: { mid?: string; title?: string; payload?: string };
};

type IgCommentChange = {
  field: string; // "comments"
  value: {
    id: string; // ID do comentário
    text?: string;
    from?: { id: string; username?: string };
    media?: { id: string; media_product_type?: string };
    parent_id?: string;
  };
};

type IgEntry = {
  id: string; // ID da conta do Instagram que recebeu o evento
  time?: number;
  messaging?: IgMessagingEvent[];
  changes?: IgCommentChange[];
};

// Recebe os eventos em tempo real do Instagram: mensagens de Direct (Fase 2)
// e comentários em posts/reels (Fase 3). A Meta exige resposta 200 em até
// 20s, então sempre respondemos "received: true" mesmo se algum item
// específico falhar ao processar — os detalhes de erro só vão pro log do
// servidor.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (body?.object === "instagram" && Array.isArray(body.entry)) {
    try {
      await Promise.all(
        (body.entry as IgEntry[]).map(async (entry) => {
          await processMessagingEntry(entry);
          await processCommentEntry(entry);
        })
      );
    } catch (err) {
      console.error("[instagram/webhook] erro ao processar evento:", err);
    }
  } else if (body) {
    console.log("[instagram/webhook] evento ignorado (formato não tratado):", JSON.stringify(body));
  }

  return NextResponse.json({ received: true });
}

async function processMessagingEntry(entry: IgEntry) {
  if (!entry.messaging?.length) return;

  const account = await fetchInstagramAccountByIgUserId(entry.id);
  if (!account) {
    console.warn(`[instagram/webhook] evento pra conta ${entry.id}, que não está conectada no banco`);
    return;
  }

  for (const event of entry.messaging) {
    const msg = event.message;
    const postback = event.postback;
    // "is_echo" é a confirmação da própria Meta de uma mensagem que NÓS
    // enviamos (via /api/instagram/send). Já salvamos ela na hora de
    // enviar, então ignoramos aqui pra não duplicar.
    if (msg?.is_echo) continue;
    if (!msg && !postback) continue;

    // remetente é OUTRA conta do Instagram já conectada nesse workspace (ex:
    // @usepostflow mandando Direct pra @fuxica_aqui) — ignora completamente,
    // não cria contato nem dispara automação/IA. Sem isso, as duas contas
    // ficam respondendo uma pra outra infinitamente. Ver
    // isOwnConnectedInstagramSender() em src/lib/instagram.ts.
    if (await isOwnConnectedInstagramSender(account.workspaceId, event.sender.id)) {
      console.warn(
        `[instagram/webhook] mensagem de ${event.sender.id} ignorada — é outra conta própria conectada, não um contato real`
      );
      continue;
    }

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
          accessToken: account.accessToken,
          recipientId: contact.igScopedId,
          platform: "instagram",
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
            messageText: msg.text ?? null,
            isFirstMessage,
            channelPlatform: "instagram",
            channelAccountId: account.id,
          });

          if (!matched) {
            await maybeReplyWithAi({
              workspaceId: account.workspaceId,
              contactId: contact.id,
              conversationId: conversation.id,
              accessToken: account.accessToken,
              recipientId: contact.igScopedId,
              platform: "instagram",
            });
          }
        }
      }
    } catch (err) {
      console.error("[instagram/webhook] erro ao disparar automação:", err);
    }
  }
}

async function processCommentEntry(entry: IgEntry) {
  const commentChanges = entry.changes?.filter((c) => c.field === "comments") ?? [];
  if (!commentChanges.length) return;

  const account = await fetchInstagramAccountByIgUserId(entry.id);
  if (!account) {
    console.warn(`[instagram/webhook] comentário pra conta ${entry.id}, que não está conectada no banco`);
    return;
  }

  for (const change of commentChanges) {
    const comment = change.value;
    if (!comment?.id || !comment.from?.id) continue;
    // ignora comentários feitos pela própria conta comercial (ex: se um dia
    // a automação também responder publicamente, isso evita loop)
    if (comment.from.id === account.igUserId) continue;

    try {
      const contact = await getOrCreateContact({
        workspaceId: account.workspaceId,
        instagramAccountId: account.id,
        igScopedId: comment.from.id,
        accessToken: account.accessToken,
      });

      const conversation = await getOrCreateConversation({
        workspaceId: account.workspaceId,
        contactId: contact.id,
        channel: "comment",
      });

      await db.insert(messages).values({
        conversationId: conversation.id,
        direction: "inbound",
        sender: "contact",
        text: comment.text ?? null,
        igMessageId: comment.id,
      });

      await db
        .update(conversations)
        .set({ updatedAt: new Date(), status: "open", unreadCount: sql`${conversations.unreadCount} + 1` })
        .where(eq(conversations.id, conversation.id));

      await db.update(contacts).set({ lastInteractionAt: new Date() }).where(eq(contacts.id, contact.id));

      const handled = await handleOptControlKeyword({
        contactId: contact.id,
        conversationId: conversation.id,
        text: comment.text ?? null,
        accessToken: account.accessToken,
        recipientId: contact.igScopedId,
        commentId: comment.id,
        platform: "instagram",
      });

      if (!handled) {
        await triggerAutomationsForComment({
          workspaceId: account.workspaceId,
          contactId: contact.id,
          conversationId: conversation.id,
          commentId: comment.id,
          commentText: comment.text ?? null,
          mediaId: comment.media?.id ?? null,
          channelPlatform: "instagram",
          channelAccountId: account.id,
        });
      }
    } catch (err) {
      console.error("[instagram/webhook] erro ao processar comentário:", err);
    }
  }
}
