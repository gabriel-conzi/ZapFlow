import { db } from "@/db";
import { automations, emailAccounts, facebookPages, instagramAccounts, telegramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { AutomationEditor } from "@/components/automations/automation-editor";
import type { AutomationFlow, AccountScopeEntry } from "@/lib/automation-types";
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

  // Contas/páginas conectadas do workspace — usadas na tela do gatilho pra
  // deixar restringir em quais delas a automação vale (ver `accountScope`
  // em lib/automation-types.ts).
  const [igAccounts, fbPages, tgAccounts, emAccounts] = await Promise.all([
    db.select().from(instagramAccounts).where(eq(instagramAccounts.workspaceId, workspace.id)),
    db.select().from(facebookPages).where(eq(facebookPages.workspaceId, workspace.id)),
    db.select().from(telegramAccounts).where(eq(telegramAccounts.workspaceId, workspace.id)),
    db.select().from(emailAccounts).where(eq(emailAccounts.workspaceId, workspace.id)),
  ]);

  const connectedAccounts: { platform: AccountScopeEntry["platform"]; id: string; label: string }[] = [
    ...igAccounts.map((a) => ({ platform: "instagram" as const, id: a.id, label: `Instagram: @${a.igUsername ?? a.igUserId}` })),
    ...fbPages.map((p) => ({ platform: "facebook" as const, id: p.id, label: `Facebook: ${p.pageName ?? p.pageId}` })),
    ...tgAccounts.map((b) => ({ platform: "telegram" as const, id: b.id, label: `Telegram: @${b.botUsername ?? b.id}` })),
    ...emAccounts.map((e) => ({ platform: "email" as const, id: e.id, label: `E-mail: ${e.fromAddress}` })),
  ];

  return (
    <div className="h-full overflow-hidden">
      <AutomationEditor
        automation={{
          id: automation.id,
          name: automation.name,
          status: automation.status,
          flow: automation.flow as AutomationFlow,
        }}
        connectedAccounts={connectedAccounts}
      />
    </div>
  );
}
