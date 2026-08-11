import { db } from "@/db";
import { automations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { AutomationEditor } from "@/components/automations/automation-editor";
import type { AutomationFlow } from "@/lib/automation-types";
import { notFound } from "next/navigation";

export default async function AutomationEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [automation] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.workspaceId, workspace.id)))
    .limit(1);

  if (!automation) notFound();

  return (
    <div className="h-full overflow-hidden">
      <AutomationEditor
        automation={{
          id: automation.id,
          name: automation.name,
          status: automation.status,
          flow: automation.flow as AutomationFlow,
        }}
      />
    </div>
  );
}
