import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentWorkspace } from "@/lib/workspace";
import { db } from "@/db";
import { contacts, conversations, automations, instagramAccounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { Users, Inbox, Workflow, Camera } from "lucide-react";

export default async function DashboardPage() {
  const workspace = await getCurrentWorkspace();

  let stats = { contacts: 0, openConversations: 0, activeAutomations: 0, connectedAccounts: 0 };

  if (workspace) {
    const [contactRows, convRows, autoRows, igRows] = await Promise.all([
      db.select().from(contacts).where(eq(contacts.workspaceId, workspace.id)),
      db.select().from(conversations).where(and(eq(conversations.workspaceId, workspace.id), eq(conversations.status, "open"))),
      db.select().from(automations).where(and(eq(automations.workspaceId, workspace.id), eq(automations.status, "active"))),
      db.select().from(instagramAccounts).where(and(eq(instagramAccounts.workspaceId, workspace.id), eq(instagramAccounts.connected, true))),
    ]);
    stats = {
      contacts: contactRows.length,
      openConversations: convRows.length,
      activeAutomations: autoRows.length,
      connectedAccounts: igRows.length,
    };
  }

  const cards = [
    { label: "Contatos", value: stats.contacts, icon: Users },
    { label: "Conversas abertas", value: stats.openConversations, icon: Inbox },
    { label: "Automações ativas", value: stats.activeAutomations, icon: Workflow },
    { label: "Contas do Instagram", value: stats.connectedAccounts, icon: Camera },
  ];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Início</h1>
      <p className="mt-1 text-sm text-muted-foreground">Visão geral da sua automação de Instagram.</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </CardTitle>
              <Icon size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.connectedAccounts === 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Comece conectando seu Instagram</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Vá até <b>Configurações</b> para conectar sua conta comercial do Instagram e liberar o
            recebimento de mensagens e comentários.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
