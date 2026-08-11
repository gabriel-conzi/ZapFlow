import { NextResponse } from "next/server";
import { db } from "@/db";
import { telegramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getBotInfo, setTelegramWebhook } from "@/lib/telegram";

// Diferente do Instagram/Facebook (OAuth), conectar um bot do Telegram é só
// colar o token dado pelo @BotFather — não precisa de tela de consentimento.
export async function POST(req: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const botToken = (body?.botToken as string | undefined)?.trim();
  if (!botToken) return NextResponse.json({ error: "Cole o token do bot" }, { status: 400 });

  const appUrl = process.env.NEXTAUTH_URL;
  if (!appUrl) {
    return NextResponse.json({ error: "NEXTAUTH_URL não configurada. Veja o README." }, { status: 500 });
  }

  try {
    const botInfo = await getBotInfo(botToken);

    const [existing] = await db
      .select()
      .from(telegramAccounts)
      .where(and(eq(telegramAccounts.workspaceId, workspace.id), eq(telegramAccounts.botToken, botToken)))
      .limit(1);

    const account = existing
      ? existing
      : (
          await db
            .insert(telegramAccounts)
            .values({ workspaceId: workspace.id, botToken, botUsername: botInfo.username, connected: true })
            .returning()
        )[0];

    if (existing) {
      await db
        .update(telegramAccounts)
        .set({ botUsername: botInfo.username, connected: true })
        .where(eq(telegramAccounts.id, existing.id));
    }

    const webhookUrl = `${appUrl}/api/telegram/webhook/${account.id}`;
    await setTelegramWebhook({ botToken, url: webhookUrl, secretToken: account.webhookSecret });

    return NextResponse.json({ ok: true, botUsername: botInfo.username });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
