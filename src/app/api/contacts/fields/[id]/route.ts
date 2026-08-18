import { NextResponse } from "next/server";
import { db } from "@/db";
import { contactFieldDefinitions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Remove um campo customizado da lista. Os valores já salvos nos contatos
// (dentro de contacts.customFields) não são apagados — só deixam de
// aparecer como coluna editável na tela de Contatos.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [deleted] = await db
    .delete(contactFieldDefinitions)
    .where(and(eq(contactFieldDefinitions.id, id), eq(contactFieldDefinitions.workspaceId, workspace.id)))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Campo não encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
