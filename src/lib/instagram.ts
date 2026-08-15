import { db } from "@/db";
import { contacts, conversations, instagramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { MediaAttachment, SendableButton } from "@/lib/automation-types";

export const GRAPH_VERSION = "v21.0";

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
 * Verifica se um ID de remetente de um evento de Direct é, na verdade, uma
 * das OUTRAS contas do Instagram já conectadas nesse mesmo workspace (ex:
 * Gabriel tem @usepostflow e @fuxica_aqui conectadas — se uma manda Direct
 * pra outra, a Meta entrega um evento de mensagem normal, indistinguível de
 * uma pessoa real).
 *
 * Sem esse filtro, cada conta responde à outra automaticamente (automação de
 * boas-vindas ou a IA) e isso gera uma nova mensagem que a OUTRA conta também
 * responde — loop infinito entre as duas contas do próprio Gabriel, gastando
 * chamadas de IA (tokens) sem nenhum contato real envolvido. Ver
 * `claude/DIAGNOSTICO_loop_contas_proprias_2026-08-15.md`.
 */
export async function isOwnConnectedInstagramSender(workspaceId: string, senderId: string): Promise<boolean> {
  const [match] = await db
    .select({ id: instagramAccounts.id })
    .from(instagramAccounts)
    .where(and(eq(instagramAccounts.workspaceId, workspaceId), eq(instagramAccounts.igUserId, senderId)))
    .limit(1);
  return Boolean(match);
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

  // Uma única conversa por contato — comentário e Direct do mesmo contato
  // caem na mesma linha do tempo na Inbox (como no ManyChat), em vez de
  // aparecerem como duas conversas separadas pra mesma pessoa. `channel` só
  // é usado pra marcar a origem quando a conversa é criada pela primeira vez
  // (mostra a etiqueta "comentário" na lista da Inbox).
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.contactId, contactId)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(conversations)
    .values({ workspaceId, contactId, channel })
    .returning();
  return created;
}

/**
 * Assina a conta do Instagram pra receber webhooks de mensagens ("messages").
 * Isso é DIFERENTE de configurar o webhook no painel da Meta: lá você registra
 * a URL/campos a nível do app, mas cada conta do Instagram também precisa ser
 * inscrita individualmente (via API, com o token dela) pra Meta começar a
 * mandar os eventos de verdade. Sem isso, o webhook fica "configurado" mas
 * nunca recebe nada. Chamamos isso automaticamente ao conectar a conta —
 * e dá pra chamar de novo a qualquer momento, é seguro repetir.
 */
export async function subscribeInstagramAccount(params: { accessToken: string; igUserId: string }) {
  const { accessToken, igUserId } = params;
  const res = await fetch(
    `https://graph.instagram.com/${GRAPH_VERSION}/${igUserId}/subscribed_apps?subscribed_fields=messages,comments&access_token=${accessToken}`,
    { method: "POST" }
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? "Erro ao assinar webhooks da conta");
  }
  return data as { success?: boolean };
}

/**
 * Envia uma mensagem de Direct pro contato via Graph API do Instagram.
 * Lança erro se a Meta recusar (token vencido, fora da janela de 24h, etc.)
 * — quem chamar deve tratar o erro e avisar o usuário.
 *
 * Passe `commentId` em vez de `recipientId` pra mandar uma "resposta
 * privada" a um comentário (primeiro contato, antes de existir uma janela
 * de mensagens aberta) — a Meta só permite isso 1x por comentário, dentro
 * de 7 dias. Depois desse primeiro envio, use `recipientId` normalmente.
 */
export async function sendInstagramMessage(params: {
  accessToken: string;
  recipientId?: string;
  commentId?: string;
  text: string;
  // se vier preenchido, manda como "button template" (texto + até 3 botões
  // de verdade, misturando link e ramificação) em vez de só texto
  buttons?: SendableButton[];
  // se vier preenchido, manda esse arquivo como anexo (imagem, vídeo, áudio
  // ou arquivo genérico) — nesse caso `text`/`buttons` são ignorados (a
  // Graph API não permite misturar anexo de mídia com texto/botões na
  // mesma mensagem).
  media?: MediaAttachment;
}) {
  const { accessToken, recipientId, commentId, text, buttons, media } = params;
  const recipient = commentId ? { comment_id: commentId } : { id: recipientId };

  const message = media
    ? { attachment: { type: media.type, payload: { url: media.url, is_reusable: true } } }
    : buttons?.length
    ? {
        attachment: {
          type: "template",
          payload: { template_type: "button", text, buttons },
        },
      }
    : { text };

  const res = await fetch(
    `https://graph.instagram.com/${GRAPH_VERSION}/me/messages?access_token=${accessToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient, message }),
    }
  );
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message ?? "Erro ao enviar mensagem no Instagram");
  }
  return data as { message_id?: string; recipient_id?: string };
}
