import { NextResponse } from "next/server";
import { db } from "@/db";
import { automations } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import type { AutomationFlow } from "@/lib/automation-types";

async function loadOwned(id: string, workspaceId: string) {
  const [row] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const automation = await loadOwned(id, workspace.id);
  if (!automation) return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });

  return NextResponse.json({ automation });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const automation = await loadOwned(id, workspace.id);
  if (!automation) return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: Partial<typeof automations.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.status === "active" || body.status === "paused" || body.status === "draft") {
    updates.status = body.status;
  }
  if (body.flow) {
    const flow = body.flow as AutomationFlow;
    updates.flow = flow;
    const trigger = flow.nodes?.find((n) => n.type === "trigger");
    if (trigger && trigger.type === "trigger") {
      updates.triggerType = trigger.data.triggerType;
      updates.triggerConfig = trigger.data.triggerType === "keyword" ? { keywords: trigger.data.keywords ?? [] } : {};
    }
  }

  const [updated] = await db.update(automations).set(updates).where(eq(automations.id, id)).returning();
  return NextResponse.json({ automation: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const automation = await loadOwned(id, workspace.id);
  if (!automation) return NextResponse.json({ error: "Automação não encontrada" }, { status: 404 });

  await db.delete(automations).where(eq(automations.id, id));
  return NextResponse.json({ ok: true });
}
