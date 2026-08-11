import { db } from "@/db";
import { automations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { AutomationsList } from "@/components/automations/automations-list";

export default async function AutomationsPage() {
  const workspace = await getCurrentWorkspace();
  const rows = workspace
    ? await db
        .select()
        .from(automations)
        .where(eq(automations.workspaceId, workspace.id))
        .orderBy(desc(automations.updatedAt))
    : [];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Automações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Construtor visual de fluxos: palavras-chave, condições, espera e tags.
      </p>

      <AutomationsList
        initial={rows.map((r) => ({
          id: r.id,
          name: r.name,
          status: r.status,
          triggerType: r.triggerType,
          flow: r.flow,
          updatedAt: r.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
