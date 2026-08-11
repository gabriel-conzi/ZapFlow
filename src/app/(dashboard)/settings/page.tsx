import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentWorkspace } from "@/lib/workspace";
import { db } from "@/db";
import { facebookPages, instagramAccounts, telegramAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Camera, AlertCircle, CheckCircle2, BellRing, MessageCircle, Send } from "lucide-react";
import { AiSettingsCard } from "@/components/settings/ai-settings-card";
import { TelegramConnectCard } from "@/components/settings/telegram-connect-card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    ig_connected?: string;
    ig_error?: string;
    ig_resubscribed?: string;
    ig_subscribe_error?: string;
    fb_connected?: string;
    fb_error?: string;
    fb_resubscribed?: string;
    fb_subscribe_error?: string;
  }>;
}) {
  const params = await searchParams;
  const workspace = await getCurrentWorkspace();
  const accounts = workspace
    ? await db.select().from(instagramAccounts).where(eq(instagramAccounts.workspaceId, workspace.id))
    : [];
  const pages = workspace
    ? await db.select().from(facebookPages).where(eq(facebookPages.workspaceId, workspace.id))
    : [];
  const bots = workspace
    ? await db.select().from(telegramAccounts).where(eq(telegramAccounts.workspaceId, workspace.id))
    : [];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Conecte suas contas do Instagram, Facebook e Telegram, e configure o Assistente de IA.
      </p>

      {params.ig_connected && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> Conta do Instagram conectada com sucesso.
        </div>
      )}
      {params.ig_error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} /> Não foi possível conectar: {decodeURIComponent(params.ig_error)}
        </div>
      )}
      {params.ig_resubscribed && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> Notificações reativadas. Novas mensagens já devem começar a chegar
          na Inbox.
        </div>
      )}
      {params.ig_subscribe_error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} /> Não foi possível ativar as notificações:{" "}
          {decodeURIComponent(params.ig_subscribe_error)}
        </div>
      )}

      {params.fb_connected && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> Página do Facebook conectada com sucesso.
        </div>
      )}
      {params.fb_error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} /> Não foi possível conectar: {decodeURIComponent(params.fb_error)}
        </div>
      )}
      {params.fb_resubscribed && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} /> Notificações reativadas.
        </div>
      )}
      {params.fb_subscribe_error && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} /> Não foi possível ativar as notificações em: {" "}
          {decodeURIComponent(params.fb_subscribe_error)}
        </div>
      )}

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera size={17} /> Instagram
          </CardTitle>
          <CardDescription>
            A conexão usa o login oficial da Meta — sua conta do Instagram precisa ser do tipo
            Comercial/Criador de conteúdo e estar vinculada a uma Página do Facebook.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {accounts.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">@{acc.igUsername ?? acc.igUserId}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/api/instagram/resubscribe?accountId=${acc.id}`}>
                  <Button variant="outline" size="sm">
                    <BellRing size={14} /> Reativar notificações
                  </Button>
                </a>
                <Badge variant={acc.connected ? "success" : "secondary"}>
                  {acc.connected ? "Conectado" : "Desconectado"}
                </Badge>
              </div>
            </div>
          ))}

          <a href="/api/instagram/connect">
            <Button className="mt-2 w-fit">
              <Camera size={15} /> {accounts.length ? "Conectar outra conta" : "Conectar Instagram"}
            </Button>
          </a>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Se o botão der erro de configuração, é porque as chaves da Meta (
            <code>INSTAGRAM_APP_ID</code>/<code>INSTAGRAM_APP_SECRET</code>) ainda não foram preenchidas no{" "}
            <code>.env</code>. Veja o passo a passo no README.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle size={17} /> Facebook Messenger
          </CardTitle>
          <CardDescription>
            Conecta a(s) Página(s) do Facebook que você administra — dá pra automatizar mensagens no
            Messenger e comentários em posts, igual ao Instagram.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{page.pageName ?? page.pageId}</p>
              </div>
              <div className="flex items-center gap-2">
                <a href={`/api/facebook/resubscribe?pageId=${page.id}`}>
                  <Button variant="outline" size="sm">
                    <BellRing size={14} /> Reativar notificações
                  </Button>
                </a>
                <Badge variant={page.connected ? "success" : "secondary"}>
                  {page.connected ? "Conectado" : "Desconectado"}
                </Badge>
              </div>
            </div>
          ))}

          <a href="/api/facebook/connect">
            <Button className="mt-2 w-fit">
              <MessageCircle size={15} /> {pages.length ? "Conectar outra Página" : "Conectar Facebook"}
            </Button>
          </a>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Se o botão der erro de configuração, é porque as chaves da Meta (
            <code>FACEBOOK_APP_ID</code>/<code>FACEBOOK_APP_SECRET</code>) ainda não foram preenchidas no{" "}
            <code>.env</code>. Veja o passo a passo no README.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6 max-w-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send size={17} /> Telegram
          </CardTitle>
          <CardDescription>
            Conecta um bot do Telegram — dá pra automatizar conversas por lá igual ao Direct do
            Instagram/Facebook (palavra-chave, boas-vindas, IA de fallback etc.).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {bots.map((bot) => (
            <div key={bot.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">@{bot.botUsername ?? bot.id}</p>
              </div>
              <Badge variant={bot.connected ? "success" : "secondary"}>
                {bot.connected ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
          ))}

          <TelegramConnectCard />

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Não tem um bot ainda? No Telegram, converse com <b>@BotFather</b>, mande{" "}
            <code>/newbot</code>, siga as instruções e copie o token que ele te der. Veja o passo a
            passo completo no README.
          </p>
        </CardContent>
      </Card>

      <AiSettingsCard />
    </div>
  );
}
