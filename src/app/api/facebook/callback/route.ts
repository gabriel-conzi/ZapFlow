import { NextResponse } from "next/server";
import { db } from "@/db";
import { facebookPages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { subscribeFacebookPage, FB_GRAPH_VERSION } from "@/lib/facebook";

type FbAccountsPage = { id: string; name?: string; access_token: string };

// Troca o "code" do OAuth (Facebook Login) por um token de usuário de longa
// duração, lista as Páginas administradas por esse usuário, e conecta TODAS
// (cada uma vira uma linha em facebook_pages, com o próprio token de Página).
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const workspaceId = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/settings?fb_error=${encodeURIComponent(error)}`);
  }
  if (!code || !workspaceId) {
    return NextResponse.redirect(`${origin}/settings?fb_error=missing_code`);
  }

  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI!;

  try {
    const shortRes = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`
    );
    const shortData = await shortRes.json();
    if (shortData.error) throw new Error(shortData.error.message);

    const longRes = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortData.access_token}`
    );
    const longData = await longRes.json();
    if (longData.error) throw new Error(longData.error.message);

    const pagesRes = await fetch(
      `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/accounts?access_token=${longData.access_token}`
    );
    const pagesData = await pagesRes.json();
    if (pagesData.error) throw new Error(pagesData.error.message);

    const pages = (pagesData.data ?? []) as FbAccountsPage[];
    if (pages.length === 0) {
      return NextResponse.redirect(`${origin}/settings?fb_error=${encodeURIComponent("Nenhuma Página encontrada nessa conta")}`);
    }

    const subscribeErrors: string[] = [];

    for (const page of pages) {
      const [existing] = await db
        .select()
        .from(facebookPages)
        .where(and(eq(facebookPages.workspaceId, workspaceId), eq(facebookPages.pageId, page.id)))
        .limit(1);

      const values = {
        workspaceId,
        pageId: page.id,
        pageName: page.name ?? null,
        accessToken: page.access_token,
        connected: true,
      };

      if (existing) {
        await db.update(facebookPages).set(values).where(eq(facebookPages.id, existing.id));
      } else {
        await db.insert(facebookPages).values(values);
      }

      try {
        await subscribeFacebookPage({ accessToken: page.access_token, pageId: page.id });
      } catch (subErr) {
        console.error("[facebook/callback] falha ao assinar webhooks da página:", page.id, subErr);
        subscribeErrors.push(page.name ?? page.id);
      }
    }

    if (subscribeErrors.length > 0) {
      return NextResponse.redirect(
        `${origin}/settings?fb_connected=1&fb_subscribe_error=${encodeURIComponent(subscribeErrors.join(", "))}`
      );
    }

    return NextResponse.redirect(`${origin}/settings?fb_connected=1`);
  } catch (err) {
    console.error("[facebook/callback] erro:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.redirect(`${origin}/settings?fb_error=${encodeURIComponent(message)}`);
  }
}
