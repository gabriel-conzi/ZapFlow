import { NextResponse } from "next/server";
import { db } from "@/db";
import { facebookPages } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { FB_GRAPH_VERSION } from "@/lib/facebook";

type FbPostItem = {
  id: string;
  message?: string;
  full_picture?: string;
  permalink_url?: string;
  created_time?: string;
};

// Lista os posts recentes de TODAS as Páginas do Facebook conectadas nesse
// workspace — usado pelo seletor de "post específico" no gatilho de
// comentário (mesma ideia do /api/instagram/media, mas juntando as Páginas).
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const pages = await db.select().from(facebookPages).where(eq(facebookPages.workspaceId, workspace.id));
  if (pages.length === 0) {
    return NextResponse.json({ error: "Nenhuma Página do Facebook conectada" }, { status: 400 });
  }

  const results = await Promise.all(
    pages.map(async (page) => {
      const res = await fetch(
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/${page.pageId}/posts?fields=id,message,full_picture,permalink_url,created_time&limit=25&access_token=${page.accessToken}`
      );
      const data = await res.json();
      if (data.error) return [];
      return ((data.data ?? []) as FbPostItem[]).map((p) => ({
        id: p.id,
        caption: p.message ?? null,
        mediaType: "FACEBOOK_POST",
        thumbnailUrl: p.full_picture ?? null,
        permalink: p.permalink_url ?? null,
        pageName: page.pageName,
      }));
    })
  );

  return NextResponse.json({ media: results.flat() });
}
