import { db } from "@/db";
import { contacts, facebookPages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { SendableButton } from "@/lib/automation-types";

export const FB_GRAPH_VERSION = "v21.0";

/**
 * Acha a Página do Facebook conectada (nossa tabela `facebook_pages`) a
 * partir do ID que a Meta manda no webhook (`entry.id`).
 */
export async function fetchFacebookPageByPageId(pageId: string) {
  const [page] = await db.select().from(facebookPages).where(eq(facebookPages.pageId, pageId)).limit(1);
  return page ?? null;
}

/**
 * Busca nome/foto da pessoa direto na Graph API do Facebook (via o ID dela
 * escopado pra Página — PSID). Se der erro (token vencido, sem permissão
 * etc.), retorna null e o contato é criado só com o ID mesmo.
 */
export async function fetchFacebookProfile(accessToken: string, psid: string) {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/${psid}?fields=first_name,last_name,profile_pic&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data.error) return null;
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
    return {
      name: name || undefined,
      profilePicUrl: (data.profile_pic as string | undefined) ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Retorna o contato já existente (mesmo workspace + mesmo PSID no Facebook)
 * ou cria um novo, buscando o perfil na Graph API.
 *
 * `fallbackName`: pra quem comentou num post, a Meta já manda o nome junto
 * no próprio evento do webhook (`from.name`). A busca de perfil via Graph API
 * (`/{psid}?fields=first_name,...`) só funciona pra quem já tem uma conversa
 * de Messenger aberta com a Página — quem só comentou (nunca mandou Direct)
 * não tem esse acesso liberado e a chamada falha. Por isso usamos o nome que
 * já veio no evento como reserva, em vez de deixar o contato sem nome.
 */
export async function getOrCreateFacebookContact(params: {
  workspaceId: string;
  facebookPageId: string;
  psid: string;
  accessToken: string;
  fallbackName?: string;
}) {
  const { workspaceId, facebookPageId, psid, accessToken, fallbackName } = params;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(
      and(eq(contacts.workspaceId, workspaceId), eq(contacts.platform, "facebook"), eq(contacts.igScopedId, psid))
    )
    .limit(1);
  if (existing) return existing;

  const profile = await fetchFacebookProfile(accessToken, psid);

  const [created] = await db
    .insert(contacts)
    .values({
      workspaceId,
      facebookPageId,
      platform: "facebook",
      igScopedId: psid,
      name: profile?.name ?? fallbackName ?? null,
      profilePicUrl: profile?.profilePicUrl ?? null,
    })
    .returning();
  return created;
}

/**
 * Assina a Página pra receber webhooks de mensagens ("messages") e
 * comentários em posts ("feed"). Igual ao Instagram: configurar o webhook no
 * painel da Meta só registra a URL a nível do app — cada Página também
 * precisa ser inscrita individualmente (via API, com o token dela).
 */
export async function subscribeFacebookPage(params: { accessToken: string; pageId: string }) {
  const { accessToken, pageId } = params;
  const res = await fetch(
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}/subscribed_apps?subscribed_fields=messages,feed&access_token=${accessToken}`,
    { method: "POST" }
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? "Erro ao assinar webhooks da Página");
  }
  return data as { success?: boolean };
}

/**
 * Envia uma mensagem via Messenger (Send API). Passe `commentId` em vez de
 * `recipientId` pra mandar uma "resposta privada" a um comentário em post —
 * mesmo mecanismo do Instagram, mesma limitação de janela.
 */
export async function sendFacebookMessage(params: {
  accessToken: string;
  recipientId?: string;
  commentId?: string;
  text: string;
  buttons?: SendableButton[];
  // se vier preenchido, manda a imagem desse link como anexo — nesse caso
  // `text`/`buttons` são ignorados (a Graph API não permite misturar anexo
  // de imagem com texto/botões na mesma mensagem).
  imageUrl?: string;
}) {
  const { accessToken, recipientId, commentId, text, buttons, imageUrl } = params;
  const recipient = commentId ? { comment_id: commentId } : { id: recipientId };

  const message = imageUrl
    ? { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } }
    : buttons?.length
    ? {
        attachment: {
          type: "template",
          payload: { template_type: "button", text, buttons },
        },
      }
    : { text };

  const res = await fetch(`https://graph.facebook.com/${FB_GRAPH_VERSION}/me/messages?access_token=${accessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipient, message }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? "Erro ao enviar mensagem no Messenger");
  }
  return data as { message_id?: string; recipient_id?: string };
}
