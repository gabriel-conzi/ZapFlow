import { db } from "@/db";
import { contacts, telegramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

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
  buttonText?: string;
  buttonUrl?: string;
}) {
  const { accessToken, recipientId, text, buttonText, buttonUrl } = params;
  if (!recipientId) throw new Error("Telegram: chat_id não informado");

  const body: Record<string, unknown> = { chat_id: recipientId, text };
  if (buttonText && buttonUrl) {
    body.reply_markup = { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] };
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
