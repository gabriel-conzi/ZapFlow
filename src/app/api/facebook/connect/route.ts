import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCurrentWorkspace } from "@/lib/workspace";

// Usamos uma "Configuration" do Facebook Login for Business (em vez de passar
// `scope` direto) porque as Páginas do Gabriel ficam dentro de um Portfólio
// Empresarial — só assim a Meta mostra o seletor de Portfólio/Página no OAuth
// e o /me/accounts do callback consegue enxergar as Páginas.
// Configuration "ZapFlow Messenger", criada em Meta for Developers → App →
// Login do Facebook para Empresas → Configurações → Criar configuração, com
// permissões: pages_show_list, pages_messaging, pages_manage_metadata,
// pages_read_engagement.
const CONFIG_ID = process.env.FACEBOOK_CONFIG_ID;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL));

  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Workspace não encontrado" }, { status: 400 });

  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !redirectUri || !CONFIG_ID) {
    return NextResponse.json(
      {
        error:
          "FACEBOOK_APP_ID / FACEBOOK_REDIRECT_URI / FACEBOOK_CONFIG_ID não configurados. Veja o README.",
      },
      { status: 500 }
    );
  }

  const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("config_id", CONFIG_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", workspace.id);

  return NextResponse.redirect(authUrl.toString());
}
