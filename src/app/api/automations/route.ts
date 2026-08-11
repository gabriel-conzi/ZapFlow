import { NextResponse } from "next/server";
import { db } from "@/db";
import { automations } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { emptyFlowWithTrigger } from "@/lib/automation-types";

// Lista as automações do workspace, mais recentes primeiro.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await db
    .select()
    .from(automations)
    .where(eq(automations.workspaceId, workspace.id))
    .orderBy(desc(automations.updatedAt));

  return NextResponse.json({ automations: rows });
}

// Cria uma automação nova. Sem `flow` no corpo, cria em branco com um nó de
// gatilho padrão (fluxo normal do botão "Nova automação"). Com `flow`
// (usado pelo botão "Duplicar"), copia o fluxo de outra automação — sempre
// como rascunho, pra revisar antes de ativar.
export async function POST(req: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim() || "Nova automação";
  const triggerType = (body?.triggerType as string | undefined) || "keyword";
  const flow = body?.flow ?? emptyFlowWithTrigger(triggerType as "keyword" | "welcome" | "comment");

  const [created] = await db
    .insert(automations)
    .values({
      workspaceId: workspace.id,
      name,
      triggerType,
      triggerConfig: {},
      flow,
      status: "draft",
    })
    .returning();

  return NextResponse.json({ automation: created }, { status: 201 });
}
