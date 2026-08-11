import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, facebookPages, instagramAccounts, messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { sendInstagramMessage } from "@/lib/instagram";
import { sendFacebookMessage } from "@/lib/facebook";

// Envia uma resposta manual (digitada na Inbox) pro contato — Direct do
// Instagram ou Messenger do Facebook, dependendo da plataforma do contato —
// e salva a mensagem enviada no histórico da conversa.
export async function POST(req: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const conversationId = body?.conversationId as string | undefined;
  const text = (body?.text as string | undefined)?.trim();
  if (!conversationId || !text) {
    return NextResponse.json({ error: "conversationId e text são obrigatórios" }, { status: 400 });
  }

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.workspaceId, workspace.id)))
    .limit(1);
  if (!conversation) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });

  const [contact] = await db.select().from(contacts).where(eq(contacts.id, conversation.contactId)).limit(1);
  if (!contact) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

  let accessToken: string;
  if (contact.platform === "facebook") {
    if (!contact.facebookPageId) {
      return NextResponse.json({ error: "Contato sem Página do Facebook vinculada" }, { status: 400 });
    }
    const [page] = await db.select().from(facebookPages).where(eq(facebookPages.id, contact.facebookPageId)).limit(1);
    if (!page) return NextResponse.json({ error: "Página do Facebook não encontrada" }, { status: 400 });
    accessToken = page.accessToken;
  } else {
    if (!contact.instagramAccountId) {
      return NextResponse.json({ error: "Contato sem conta do Instagram vinculada" }, { status: 400 });
    }
    const [account] = await db
      .select()
      .from(instagramAccounts)
      .where(eq(instagramAccounts.id, contact.instagramAccountId))
      .limit(1);
    if (!account) return NextResponse.json({ error: "Conta do Instagram não encontrada" }, { status: 400 });
    accessToken = account.accessToken;
  }

  try {
    const sendFn = contact.platform === "facebook" ? sendFacebookMessage : sendInstagramMessage;
    const result = await sendFn({
      accessToken,
      recipientId: contact.igScopedId,
      text,
    });

    const [saved] = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        direction: "outbound",
        sender: "agent",
        text,
        igMessageId: result.message_id ?? null,
      })
      .returning();

    await db
      .update(conversations)
      .set({ updatedAt: new Date(), status: "open" })
      .where(eq(conversations.id, conversation.id));

    return NextResponse.json({ message: saved });
  } catch (err) {
    console.error("[instagram/send] erro:", err);
    const message = err instanceof Error ? err.message : "Erro ao enviar mensagem";
    // 24h de janela de resposta fechada, token vencido etc. viram erro aqui —
    // devolvemos a mensagem da Meta pra aparecer direto na tela.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
