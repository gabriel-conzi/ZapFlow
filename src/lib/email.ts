import crypto from "crypto";
import { db } from "@/db";
import { contacts, emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import type { MediaAttachment, SendableButton } from "@/lib/automation-types";

// Rótulo do link/botão de download pra cada tipo de mídia que não é imagem
// (vídeo, áudio, arquivo) — e-mail não tem suporte confiável a embutir
// vídeo/áudio tocando direto no corpo (varia demais entre provedores de
// e-mail), então esses tipos viram um botão de link que abre o arquivo.
const MEDIA_LINK_LABEL: Record<Exclude<MediaAttachment["type"], "image">, string> = {
  video: "▶ Assistir vídeo",
  audio: "🎧 Ouvir áudio",
  file: "📎 Baixar arquivo",
};

// api.mailgun.net (US) ou api.eu.mailgun.net (EU), dependendo da região
// escolhida ao criar o domínio na Mailgun.
const MAILGUN_API_BASE = process.env.MAILGUN_API_BASE || "https://api.mailgun.net/v3";

function mailgunApiKey() {
  const key = process.env.MAILGUN_API_KEY;
  if (!key) throw new Error("MAILGUN_API_KEY não configurada no .env");
  return key;
}

function basicAuthHeader() {
  return "Basic " + Buffer.from(`api:${mailgunApiKey()}`).toString("base64");
}

/** Acha a conta de e-mail conectada (nossa tabela `email_accounts`) a partir
 * do endereço "para" que a Mailgun mandou no webhook. */
export async function fetchEmailAccountByFromAddress(fromAddress: string) {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.fromAddress, fromAddress.toLowerCase()))
    .limit(1);
  return account ?? null;
}

/** Separa "Nome Sobrenome <email@dominio.com>" em nome + endereço. Aceita
 * também um endereço puro sem nome. */
export function parseEmailAddress(raw: string): { name: string | null; email: string } {
  const match = raw.match(/^(.*?)<([^<>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { name: name || null, email: match[2].trim().toLowerCase() };
  }
  return { name: null, email: raw.trim().toLowerCase() };
}

/** Retorna o contato já existente (mesmo workspace + mesmo e-mail) ou cria
 * um novo. */
export async function getOrCreateEmailContact(params: {
  workspaceId: string;
  emailAccountId: string;
  email: string;
  name?: string | null;
}) {
  const { workspaceId, emailAccountId, email, name } = params;

  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.workspaceId, workspaceId), eq(contacts.platform, "email"), eq(contacts.igScopedId, email)))
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(contacts)
    .values({
      workspaceId,
      emailAccountId,
      platform: "email",
      igScopedId: email,
      name: name ?? null,
      username: email,
    })
    .returning();
  return created;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
}

/**
 * Envia um e-mail via Mailgun. Reaproveita o mesmo formato usado pros outros
 * canais: `accessToken` aqui é o endereço remetente (from, já verificado na
 * Mailgun) e `recipientId` é o e-mail de destino — assim o motor de
 * automações (`sendPlatformMessage`) não precisa de um caso especial. O
 * domínio usado na chamada da API é extraído do próprio endereço "from"
 * (tudo depois do @).
 */
export async function sendEmailMessage(params: {
  accessToken: string; // endereço "de" (from)
  recipientId?: string; // e-mail do destinatário
  text: string;
  subject?: string;
  // só os botões do tipo "link" (web_url) viram botão de verdade aqui —
  // e-mail não tem como avisar a automação de qual botão foi clicado, então
  // botões de ramificação não fazem sentido nesse canal e são ignorados.
  buttons?: SendableButton[];
  inReplyTo?: string;
  // se vier preenchido, embute essa mídia no corpo do e-mail (acima do
  // texto, que nesse caso funciona como legenda). Imagem é embutida direto;
  // vídeo/áudio/arquivo viram um botão de link (ver `MEDIA_LINK_LABEL`).
  media?: MediaAttachment;
}) {
  const { accessToken: from, recipientId: to, text, subject, buttons, inReplyTo, media } = params;
  if (!to) throw new Error("E-mail sem destinatário");

  const domain = from.split("@")[1];
  if (!domain) throw new Error("Endereço remetente inválido");

  const linkButton = (buttons ?? []).find((b): b is Extract<SendableButton, { type: "web_url" }> => b.type === "web_url");
  const buttonHtml = linkButton
    ? `<p style="margin-top:16px"><a href="${linkButton.url}" style="background:#111827;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(
        linkButton.title
      )}</a></p>`
    : "";
  const mediaHtml = !media
    ? ""
    : media.type === "image"
    ? `<p><img src="${media.url}" alt="" style="max-width:100%;border-radius:8px;display:block" /></p>`
    : `<p><a href="${media.url}" style="background:#111827;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${
        MEDIA_LINK_LABEL[media.type]
      }</a></p>`;
  const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111827">${mediaHtml}${escapeHtml(
    text
  )}${buttonHtml}</div>`;

  const form = new URLSearchParams();
  form.set("from", from);
  form.set("to", to);
  form.set("subject", subject?.trim() || "UsePostFlow");
  form.set("text", text);
  form.set("html", html);
  if (inReplyTo) {
    form.set("h:In-Reply-To", inReplyTo);
    form.set("h:References", inReplyTo);
  }

  const res = await fetch(`${MAILGUN_API_BASE}/${domain}/messages`, {
    method: "POST",
    headers: { Authorization: basicAuthHeader(), "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message ?? "Erro ao enviar e-mail pela Mailgun");
  }
  return { message_id: data.id as string | undefined, recipient_id: to };
}

/**
 * Verifica a assinatura do webhook da Mailgun: HMAC-SHA256 sobre
 * "{timestamp}{token}" (concatenados, sem separador), usando a "Webhook
 * Signing Key" da conta (Configurações → Segurança na Mailgun — não é a
 * mesma coisa que a chave de API). Sem isso, qualquer um que descobrisse a
 * URL do webhook poderia forjar e-mails "recebidos" e disparar automações.
 */
export function verifyMailgunWebhookSignature(params: {
  timestamp: string | null;
  token: string | null;
  signature: string | null;
}): boolean {
  const { timestamp, token, signature } = params;
  const signingKey = process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  if (!signingKey || !timestamp || !token || !signature) return false;

  const expected = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp.concat(token))
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(signature, "hex");
    return expectedBuf.length === sigBuf.length && crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}
