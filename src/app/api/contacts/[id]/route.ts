import { NextResponse } from "next/server";
import { db } from "@/db";
import { contacts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Permite: (1) ligar/desligar manualmente o opt-out de um contato (ex: se
// ele pedir por fora do Instagram, ou se o comando automático falhar); e
// (2) editar manualmente o valor de UM campo customizado direto na tela de
// Contatos (envia { field: "cidade", value: "São Paulo" } — value "" apaga
// o campo daquele contato).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);

  if (typeof body?.optedOut === "boolean") {
    const [updated] = await db
      .update(contacts)
      .set({ optedOut: body.optedOut })
      .where(and(eq(contacts.id, id), eq(contacts.workspaceId, workspace.id)))
      .returning();

    if (!updated) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });
    return NextResponse.json({ contact: updated });
  }

  if (typeof body?.field === "string" && body.field.trim() && typeof body?.value === "string") {
    const [existing] = await db
      .select({ customFields: contacts.customFields })
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.workspaceId, workspace.id)))
      .limit(1);

    if (!existing) return NextResponse.json({ error: "Contato não encontrado" }, { status: 404 });

    const current =
      existing.customFields && typeof existing.customFields === "object" ? existing.customFields : {};
    const next: Record<string, string> = { ...current };
    if (body.value.trim() === "") {
      delete next[body.field];
    } else {
      next[body.field] = body.value;
    }

    const [updated] = await db
      .update(contacts)
      .set({ customFields: next })
      .where(and(eq(contacts.id, id), eq(contacts.workspaceId, workspace.id)))
      .returning();

    return NextResponse.json({ contact: updated });
  }

  return NextResponse.json({ error: "Nada pra atualizar" }, { status: 400 });
}
