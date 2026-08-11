import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentWorkspace } from "@/lib/workspace";

// Escopos da API do Instagram (login direto, sem precisar de Página do
// Facebook) — ver Meta for Developers > Casos de uso > API do Instagram.
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
].join(",");

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));

  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });

  const appId = process.env.INSTAGRAM_APP_ID;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID / META_REDIRECT_URI não configurados. Veja o README." },
      { status: 500 }
    );
  }

  const authUrl = new URL("https://www.instagram.com/oauth/authorize");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", workspace.id);

  return NextResponse.redirect(authUrl.toString());
}
