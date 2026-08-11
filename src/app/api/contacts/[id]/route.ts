import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Permite ligar/desligar manualmente o opt-out de um contato (ex: se ele
// pedir por fora do Instagram, ou se o comando automático falhar).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (typeof body?.optedOut !== "boolean") {
    return NextResponse.json({ error: "Campo 'optedOut' inválido" }, { status: 400 });
  }

  const [updated] = await db
    .update(contacts)
    .set({ optedOut: body.optedOut })
    .where(and(eq(contacts.id, id), eq(contacts.workspaceId, workspace.id)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
  return NextResponse.json({ contact: updated });
}
