import crypto from "crypto";
import { db } from "@/db";
import { contacts, emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const RESEND_API_BASE = "https://api.resend.com";

function resendApiKey() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurada no .env");
  return key;
}

/** Acha a conta de e-mail conectada (nossa tabela `email_accounts`) a partir
 * do endereço "para" que a Resend mandou no webhook. */
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
 * Envia um e-mail via Resend. Reaproveita o mesmo formato usado pros outros
 * canais: `accessToken` aqui é o endereço remetente (from, já verificado na
 * Resend) e `recipientId` é o e-mail de destino — assim o motor de
 * automações (`sendPlatformMessage`) não precisa de um caso especial.
 */
export async function sendEmailMessage(params: {
  accessToken: string; // endereço "de" (from)
  recipientId?: string; // e-mail do destinatário
  text: string;
  subject?: string;
  buttonText?: string;
  buttonUrl?: string;
  inReplyTo?: string;
}) {
  const { accessToken: from, recipientId: to, text, subject, buttonText, buttonUrl, inReplyTo } = params;
  if (!to) throw new Error("E-mail sem destinatário");

  const buttonHtml =
    buttonText && buttonUrl
      ? `<p style="margin-top:16px"><a href="${buttonUrl}" style="background:#111827;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">${escapeHtml(
          buttonText
        )}</a></p>`
      : "";
  const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#111827">${escapeHtml(
    text
  )}${buttonHtml}</div>`;

  const res = await fetch(`${RESEND_API_BASE}/emails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: subject?.trim() || "UsePostFlow",
      text,
      html,
      ...(inReplyTo ? { headers: { "In-Reply-To": inReplyTo, References: inReplyTo } } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? data.message ?? "Erro ao enviar e-mail pela Resend");
  }
  return { message_id: data.id as string | undefined, recipient_id: to };
}

/** Busca o corpo completo (texto/HTML) de um e-mail recebido — o webhook da
 * Resend só manda metadados (remetente, assunto, anexos), o corpo do e-mail
 * precisa dessa chamada extra na API. */
export async function fetchReceivedEmailBody(emailId: string) {
  const res = await fetch(`${RESEND_API_BASE}/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${resendApiKey()}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message ?? "Erro ao buscar corpo do e-mail recebido");
  return data as {
    text: string | null;
    html: string | null;
    subject: string;
    from: string;
    message_id: string;
  };
}

/**
 * Verifica a assinatura do webhook da Resend (padrão Svix / Standard
 * Webhooks: HMAC-SHA256 sobre "{id}.{timestamp}.{corpo}", em base64). Sem
 * isso, qualquer um que descobrisse a URL do webhook poderia forjar e-mails
 * "recebidos" e disparar automações. Precisa do corpo bruto (string), antes
 * de fazer JSON.parse.
 */
export function verifyResendWebhookSignature(params: {
  payload: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
}): boolean {
  const { payload, svixId, svixTimestamp, svixSignature } = params;
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !svixId || !svixTimestamp || !svixSignature) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  const expectedBuf = Buffer.from(expected);

  return svixSignature
    .split(" ")
    .map((token) => token.split(",")[1])
    .filter(Boolean)
    .some((sig) => {
      try {
        const sigBuf = Buffer.from(sig);
        return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
      } catch {
        return false;
      }
    });
}
