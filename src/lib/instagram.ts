import { db } from "@/db";
import { contacts, conversations, instagramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const GRAPH_VERSION = "v21.0";

/**
 * Acha a conta do Instagram conectada (da nossa tabela `instagram_accounts`)
 * a partir do ID que a Meta manda no webhook (`entry.id`).
 */
export async function fetchInstagramAccountByIgUserId(igUserId: string) {
  const [account] = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.igUserId, igUserId))
    .limit(1);
  return account ?? null;
}

/**
 * Busca nome/username/foto do contato direto na Graph API do Instagram.
 * Se der erro (token vencido, permissão etc.), retorna null e o contato é
 * criado só com o ID mesmo — não trava o fluxo.
 */
export async function fetchInstagramProfile(accessToken: string, scopedId: string) {
  try {
    const res = await fetch(
      `https://graph.instagram.com/${GRAPH_VERSION}/${scopedId}?fields=name,username,profile_pic&access_token=${accessToken}`
    );
    const data = await res.json();
    if (data.error) return null;
    return {
      name: (data.name as string | undefined) ?? undefined,
      username: (data.username as string | undefined) ?? undefined,
      profilePicUrl: (data.profile_pic as string | undefined) ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Retorna o contato já existente (mesmo workspace + mesmo ID escopado do IG)
 * ou cria um novo, buscando o perfil na Graph API.
 */
export async function getOrCreateContact(params: {
  workspaceId: string;
  instagramAccountId: string;
  igScopedId: string;
  accessToken: string;
}) {
  const { workspaceId, instagramAccountId, igScopedId, accessToken } = params;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.igScopedId, igScopedId)))
    .limit(1);
  if (existing) return existing;

  const profile = await fetchInstagramProfile(accessToken, igScopedId);

  const [created] = await db
    .insert(contacts)
    .values({
      workspaceId,
      instagramAccountId,
      igScopedId,
      name: profile?.name ?? null,
      username: profile?.username ?? null,
      profilePicUrl: profile?.profilePicUrl ?? null,
    })
    .returning();
  return created;
}

/**
 * Retorna a conversa já existente com esse contato (num canal específico,
 * "dm" por padrão) ou cria uma nova.
 */
export async function getOrCreateConversation(params: {
  workspaceId: string;
  contactId: string;
  channel?: "dm" | "comment";
}) {
  const { workspaceId, contactId, channel = "dm" } = params;

  const [existing] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.workspaceId, workspaceId),
        eq(conversations.contactId, contactId),
        eq(conversations.channel, channel)
      )
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ workspaceId, contactId, channel })
    .returning();
  return created;
}

/**
 * Envia uma mensagem de Direct pro contato via Graph API do Instagram.
 * Lança erro se a Meta recusar (token vencido, fora da janela de 24h, etc.)
 * — quem chamar deve tratar o erro e avisar o usuário.
 */
export async function sendInstagramMessage(params: {
  accessToken: string;
  recipientId: string;
  text: string;
}) {
  const { accessToken, recipientId, text } = params;

  const res = await fetch(
    `https://graph.instagram.com/${GRAPH_VERSION}/me/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
    }
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? "Erro ao enviar mensagem no Instagram");
  }
  return data as { message_id?: string; recipient_id?: string };
}
