import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCurrentWorkspace } from "@/lib/workspace";
import { db } from "@/db";
import { instagramAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Camera, AlertCircle, CheckCircle2 } from "lucide-react";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ig_connected?: string; ig_error?: string }>;
}) {
  const params = await searchParams;
  const workspace = await getCurrentWorkspace();
  const accounts = workspace
    ? await db.select().from(instagramAccounts).where(eq(instagramAccounts.workspaceId, workspace.id))
    : [];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <p className="mt-1 text-sm text-muted-foreground">Conecte sua conta comercial do Instagram.</p>

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
            <div key={acc.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">@{acc.igUsername ?? acc.igUserId}</p>
                <p className="text-xs text-muted-foreground">via página {acc.pageName}</p>
              </div>
              <Badge variant={acc.connected ? "success" : "secondary"}>
                {acc.connected ? "Conectado" : "Desconectado"}
              </Badge>
            </div>
          ))}

          <a href="/api/instagram/connect">
            <Button className="mt-2 w-fit">
              <Camera size={15} /> {accounts.length ? "Conectar outra conta" : "Conectar Instagram"}
            </Button>
          </a>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Se o botão der erro de configuração, é porque as chaves da Meta (
            <code>META_APP_ID</code>/<code>META_APP_SECRET</code>) ainda não foram preenchidas no{" "}
            <code>.env</code>. Veja o passo a passo no README.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
