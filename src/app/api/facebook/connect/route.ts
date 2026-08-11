import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentWorkspace } from "@/lib/workspace";

// Permissões de Página necessárias pra Messenger (DM) + comentários em posts.
const SCOPES = [
  "pages_show_list",
  "pages_messaging",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_manage_engagement",
].join(",");

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));

  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });

  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !redirectUri) {
    return NextResponse.json(
      { error: "FACEBOOK_APP_ID / FACEBOOK_REDIRECT_URI não configurados. Veja o README." },
      { status: 500 }
    );
  }

  const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", workspace.id);

  return NextResponse.redirect(authUrl.toString());
}
