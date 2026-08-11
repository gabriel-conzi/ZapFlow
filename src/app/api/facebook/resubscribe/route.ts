import { NextResponse } from "next/server";
import { db } from "@/db";
import { facebookPages } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { subscribeFacebookPage } from "@/lib/facebook";

// Reativa manualmente a inscrição de webhooks de uma Página já conectada —
// mesmo propósito do /api/instagram/resubscribe.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const pageId = searchParams.get("pageId");

  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.redirect(`${origin}/login`);

  const conditions = pageId
    ? and(eq(facebookPages.workspaceId, workspace.id), eq(facebookPages.id, pageId))
    : eq(facebookPages.workspaceId, workspace.id);

  const pages = await db.select().from(facebookPages).where(conditions);
  if (pages.length === 0) {
    return NextResponse.redirect(`${origin}/settings?fb_error=${encodeURIComponent("Página não encontrada")}`);
  }

  try {
    for (const page of pages) {
      await subscribeFacebookPage({ accessToken: page.accessToken, pageId: page.pageId });
    }
    return NextResponse.redirect(`${origin}/settings?fb_resubscribed=1`);
  } catch (err) {
    console.error("[facebook/resubscribe] erro:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.redirect(`${origin}/settings?fb_subscribe_error=${encodeURIComponent(message)}`);
  }
}
