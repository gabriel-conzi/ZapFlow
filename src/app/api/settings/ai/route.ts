import { NextResponse } from "next/server";
import { db } from "@/db";
import { aiSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Config da IA fica numa linha só por workspace (chave primária = workspace_id).
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [row] = await db.select().from(aiSettings).where(eq(aiSettings.workspaceId, workspace.id)).limit(1);
  return NextResponse.json({
    settings: row ?? { workspaceId: workspace.id, enabled: false, systemPrompt: "", model: "gpt-4o-mini" },
  });
}

export async function PUT(req: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const enabled = Boolean(body?.enabled);
  const systemPrompt = typeof body?.systemPrompt === "string" ? body.systemPrompt.slice(0, 4000) : "";
  const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : "gpt-4o-mini";

  const [existing] = await db.select().from(aiSettings).where(eq(aiSettings.workspaceId, workspace.id)).limit(1);

  if (existing) {
    await db
      .update(aiSettings)
      .set({ enabled, systemPrompt, model, updatedAt: new Date() })
      .where(eq(aiSettings.workspaceId, workspace.id));
  } else {
    await db.insert(aiSettings).values({ workspaceId: workspace.id, enabled, systemPrompt, model });
  }

  return NextResponse.json({ ok: true });
}
