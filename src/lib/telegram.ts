import { db } from "@/db";
import { contacts, telegramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { SendableButton } from "@/lib/automation-types";

function apiUrl(botToken: string, method: string) {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

/** Confirma que o token é válido e pega o @username do bot (usado no "Conectar"). */
export async function getBotInfo(botToken: string) {
  const res = await fetch(apiUrl(botToken, "getMe"));
  const data = await res.json();
  if (!data.ok) throw new Error(data.description ?? "Token do bot inválido");
  return data.result as { id: number; username: string; first_name: string };
}

/** Registra a URL do webhook desse bot na Telegram (chamado 1x, ao conectar). */
export async function setTelegramWebhook(params: { botToken: string; url: string; secretToken: string }) {
  const res = await fetch(apiUrl(params.botToken, "setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: params.url, secret_token: params.secretToken }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description ?? "Erro ao configurar o webhook do Telegram");
  return data;
}

export async function fetchTelegramAccountById(id: string) {
  const [account] = await db.select().from(telegramAccounts).where(eq(telegramAccounts.id, id)).limit(1);
  return account ?? null;
}

export async function getOrCreateTelegramContact(params: {
  workspaceId: string;
  telegramAccountId: string;
  chatId: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}) {
  const { workspaceId, telegramAccountId, chatId, firstName, lastName, username } = params;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.platform, "telegram"), eq(contacts.igScopedId, chatId)))
    .limit(1);
  if (existing) return existing;

  const name = [firstName, lastName].filter(Boolean).join(" ").trim();

  const [created] = await db
    .insert(contacts)
    .values({
      workspaceId,
      telegramAccountId,
      platform: "telegram",
      igScopedId: chatId,
      name: name || undefined,
      username: username ?? undefined,
    })
    .returning();
  return created;
}

/**
 * Manda uma mensagem de texto (com botão opcional de link) pelo bot do
 * Telegram. Assinatura compatível com sendInstagramMessage/sendFacebookMessage
 * (mesmo formato de retorno) pra funcionar com o dispatcher de automations.ts.
 */
export async function sendTelegramMessage(params: {
  accessToken: string; // aqui é o botToken
  recipientId?: string; // aqui é o chat_id
  text: string;
  // só os botões do tipo "link" (web_url) viram botão de verdade aqui — o
  // Telegram até suporta callback_data (equivalente a "ramificar"), mas essa
  // automação ainda não trata a resposta desse tipo de botão pra esse canal,
  // só pra Instagram/Facebook. Botões de ramificação são ignorados no Telegram.
  buttons?: SendableButton[];
  // se vier preenchido, manda a imagem desse link (com `text` como legenda,
  // se tiver) via sendPhoto em vez de sendMessage — o Telegram permite
  // imagem + legenda na mesma mensagem, diferente do Instagram/Facebook.
  imageUrl?: string;
}) {
  const { accessToken, recipientId, text, buttons, imageUrl } = params;
  if (!recipientId) throw new Error("Telegram: chat_id não informado");

  if (imageUrl) {
    const body: Record<string, unknown> = { chat_id: recipientId, photo: imageUrl };
    if (text?.trim()) body.caption = text;
    const res = await fetch(apiUrl(accessToken, "sendPhoto"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description ?? "Erro ao enviar imagem no Telegram");
    return { message_id: String(data.result?.message_id ?? ""), recipient_id: recipientId };
  }

  const linkButtons = (buttons ?? []).filter(
    (b): b is Extract<SendableButton, { type: "web_url" }> => b.type === "web_url"
  );

  const body: Record<string, unknown> = { chat_id: recipientId, text };
  if (linkButtons.length > 0) {
    body.reply_markup = { inline_keyboard: [linkButtons.map((b) => ({ text: b.title, url: b.url }))] };
  }

  const res = await fetch(apiUrl(accessToken, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.description ?? "Erro ao enviar mensagem no Telegram");
  return { message_id: String(data.result?.message_id ?? ""), recipient_id: recipientId };
}
