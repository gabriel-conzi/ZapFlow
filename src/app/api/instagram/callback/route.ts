import { NextResponse } from "next/server";
import { db } from "@/db";
import { instagramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Troca o "code" do OAuth por um token de longa duração, busca as Páginas do
// Facebook do usuário e, para cada uma com uma conta comercial do Instagram
// vinculada, salva a conexão no banco. Baseado no fluxo padrão da Graph API
// da Meta (o mesmo usado por qualquer ferramenta de automação de Instagram).
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

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = process.env.META_REDIRECT_URI!;

  try {
    // 1) code → token de curta duração
    const shortRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const shortData = await shortRes.json();
    if (shortData.error) throw new Error(shortData.error.message);

    // 2) troca por token de longa duração (~60 dias)
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortData.access_token}`
    );
    const longData = await longRes.json();
    if (longData.error) throw new Error(longData.error.message);

    // 3) lista as Páginas do Facebook administradas pelo usuário
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?access_token=${longData.access_token}&fields=id,name,access_token,instagram_business_account{id,username}`
    );
    const pagesData = await pagesRes.json();
    if (pagesData.error) throw new Error(pagesData.error.message);

    const pages = (pagesData.data ?? []) as Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>;

    const withInstagram = pages.filter((p) => p.instagram_business_account?.id);

    if (withInstagram.length === 0) {
      return NextResponse.redirect(`${origin}/settings?ig_error=no_ig_business_account`);
    }

    for (const page of withInstagram) {
      const igUserId = page.instagram_business_account!.id;

      const [existing] = await db
        .select()
        .from(instagramAccounts)
        .where(and(eq(instagramAccounts.workspaceId, workspaceId), eq(instagramAccounts.igUserId, igUserId)))
        .limit(1);

      const values = {
        workspaceId,
        igUserId,
        igUsername: page.instagram_business_account!.username ?? null,
        pageId: page.id,
        pageName: page.name,
        accessToken: page.access_token, // token de página, de longa duração
        connected: true,
      };

      if (existing) {
        await db.update(instagramAccounts).set(values).where(eq(instagramAccounts.id, existing.id));
      } else {
        await db.insert(instagramAccounts).values(values);
      }
    }

    return NextResponse.redirect(`${origin}/settings?ig_connected=1`);
  } catch (err) {
    console.error("[instagram/callback] erro:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.redirect(`${origin}/settings?ig_error=${encodeURIComponent(message)}`);
  }
}
