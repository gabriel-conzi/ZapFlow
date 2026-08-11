import { NextResponse } from "next/server";
import { db } from "@/db";
import { instagramAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { GRAPH_VERSION } from "@/lib/instagram";

type IgMediaItem = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
};

// Lista os posts/reels recentes da conta conectada — usado pelo seletor de
// "post específico" no gatilho de comentário.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [account] = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.workspaceId, workspace.id))
    .limit(1);
  if (!account) return NextResponse.json({ error: "Nenhuma conta do Instagram conectada" }, { status: 400 });

  const res = await fetch(
    `https://graph.instagram.com/${GRAPH_VERSION}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=25&access_token=${account.accessToken}`
  );
  const data = await res.json();
  if (data.error) {
    return NextResponse.json({ error: data.error.message ?? "Erro ao buscar posts" }, { status: 502 });
  }

  const media = ((data.data ?? []) as IgMediaItem[]).map((m) => ({
    id: m.id,
    caption: m.caption ?? null,
    mediaType: m.media_type ?? null,
    thumbnailUrl: (m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url) ?? null,
    permalink: m.permalink ?? null,
    timestamp: m.timestamp ?? null,
  }));

  return NextResponse.json({ media });
}
