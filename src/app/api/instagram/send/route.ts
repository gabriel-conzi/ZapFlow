import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts, conversations, messages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { emailReplySubject, resolveContactChannel, sendPlatformMessage } from "@/lib/automations";

// Envia uma resposta manual (digitada na Inbox) pro contato — Direct do
// Instagram, Messenger do Facebook, Telegram ou e-mail, dependendo da
// plataforma do contato — e salva a mensagem enviada no histórico da
// conversa. (Rota continua com nome "instagram/send" por histórico, mas já
// cobre os 4 canais via `resolveContactChannel`/`sendPlatformMessage`.)
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

  try {
    const { accessToken, platform } = await resolveContactChannel(contact);

    const result = await sendPlatformMessage(platform, {
      accessToken,
      recipientId: contact.igScopedId,
      text,
      subject: platform === "email" ? await emailReplySubject(conversation.id) : undefined,
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
    // 24h de janela de resposta fechada (Instagram/Facebook), token vencido etc. viram
    // erro aqui — devolvemos a mensagem original pra aparecer direto na tela.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
