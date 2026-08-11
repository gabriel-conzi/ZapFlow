import { db } from "@/db";
import { instagramAccounts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { InboxClient } from "@/components/inbox/inbox-client";
import { Card, CardContent } from "@/components/ui/card";
import { AtSign } from "lucide-react";

export default async function InboxPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [account] = await db
    .select()
    .from(instagramAccounts)
    .where(eq(instagramAccounts.workspaceId, workspace.id))
    .limit(1);

  if (!account || !account.connected) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversas de Direct do Instagram em um só lugar.
        </p>
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <AtSign size={28} />
            <p className="max-w-sm text-sm">
              Conecte sua conta do Instagram em <b>Configurações</b> pra começar a receber as
              mensagens aqui.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversas de Direct com @{account.igUsername}
        </p>
      </div>
      <InboxClient />
    </div>
  );
}
