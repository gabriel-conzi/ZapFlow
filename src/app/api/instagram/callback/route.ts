import { NextResponse } from "next/server";
import { db } from "@/db";
import { instagramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { subscribeInstagramAccount } from "@/lib/instagram";

// Troca o "code" do OAuth (login direto do Instagram) por um token de longa
// duração e salva a conexão no banco. Fluxo da API do Instagram com login do
// Instagram (não depende de Página do Facebook).
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/settings?ig_error=${encodeURIComponent(error)}`);
  }
  if (!code || !workspaceId) {
    return NextResponse.redirect(`${origin}/settings?ig_error=missing_code`);
  }

  const appId = process.env.INSTAGRAM_APP_ID!;
  const appSecret = process.env.INSTAGRAM_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;

  try {
    const shortForm = new URLSearchParams();
    shortForm.set("client_id", appId);
    shortForm.set("client_secret", appSecret);
    shortForm.set("grant_type", "authorization_code");
    shortForm.set("redirect_uri", redirectUri);
    shortForm.set("code", code);

    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: shortForm,
    });
    const shortData = await shortRes.json();
    if (shortData.error_message) throw new Error(shortData.error_message);

    const longRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${appSecret}&access_token=${shortData.access_token}`
    );
    const longData = await longRes.json();
    if (longData.error) throw new Error(longData.error.message);

    const meRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=${longData.access_token}`
    );
    const meData = await meRes.json();
    if (meData.error) throw new Error(meData.error.message);

    const igUserId = String(meData.user_id ?? shortData.user_id);

    const [existing] = await db
      .select()
      .from(instagramAccounts)
      .where(and(eq(instagramAccounts.workspaceId, workspaceId), eq(instagramAccounts.igUserId, igUserId)))
      .limit(1);

    const values = {
      workspaceId,
      igUserId,
      igUsername: meData.username ?? null,
      pageId: null,
      pageName: null,
      accessToken: longData.access_token,
      connected: true,
    };

    if (existing) {
      await db.update(instagramAccounts).set(values).where(eq(instagramAccounts.id, existing.id));
    } else {
      await db.insert(instagramAccounts).values(values);
    }

    // Configurar os campos do webhook no painel da Meta registra a URL a
    // nível do APP, mas cada conta do Instagram também precisa ser inscrita
    // individualmente pra Meta de fato começar a mandar os eventos. Se essa
    // chamada falhar, a conta ainda fica "conectada" (o token é válido), só
    // avisamos que as mensagens em tempo real podem não chegar.
    try {
      await subscribeInstagramAccount({ accessToken: longData.access_token, igUserId });
    } catch (subErr) {
      console.error("[instagram/callback] falha ao assinar webhooks da conta:", subErr);
      const message = subErr instanceof Error ? subErr.message : "Erro desconhecido";
      return NextResponse.redirect(
        `${origin}/settings?ig_connected=1&ig_subscribe_error=${encodeURIComponent(message)}`
      );
    }

    return NextResponse.redirect(`${origin}/settings?ig_connected=1`);
  } catch (err) {
    console.error("[instagram/callback] erro:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.redirect(`${origin}/settings?ig_error=${encodeURIComponent(message)}`);
  }
}
