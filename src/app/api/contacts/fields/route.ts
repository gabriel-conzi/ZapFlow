import { NextResponse } from "next/server";
import { db } from "@/db";
import { contactFieldDefinitions } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { CONTACT_FIELD_TYPES, slugifyFieldKey, type ContactFieldType } from "@/lib/contact-fields";

// Lista os campos customizados definidos manualmente pelo Gabriel na tela de
// Contatos (ex: "Cidade", "Plano contratado").
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await db
    .select()
    .from(contactFieldDefinitions)
    .where(eq(contactFieldDefinitions.workspaceId, workspace.id))
    .orderBy(asc(contactFieldDefinitions.createdAt));

  return NextResponse.json({ fields: rows });
}

export async function POST(req: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const type = typeof body?.type === "string" ? body.type : "text";

  if (!label) {
    return NextResponse.json({ error: "Dê um nome pro campo." }, { status: 400 });
  }
  if (!CONTACT_FIELD_TYPES.includes(type as ContactFieldType)) {
    return NextResponse.json({ error: "Tipo de campo inválido." }, { status: 400 });
  }

  const key = slugifyFieldKey(label);
  if (!key) {
    return NextResponse.json(
      { error: "Esse nome não é válido — use pelo menos uma letra ou número." },
      { status: 400 }
    );
  }

  const existing = await db
    .select({ id: contactFieldDefinitions.id })
    .from(contactFieldDefinitions)
    .where(and(eq(contactFieldDefinitions.workspaceId, workspace.id), eq(contactFieldDefinitions.key, key)))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({ error: "Já existe um campo com um nome parecido com esse." }, { status: 409 });
  }

  const [created] = await db
    .insert(contactFieldDefinitions)
    .values({ workspaceId: workspace.id, key, label, type })
    .returning();

  return NextResponse.json({ field: created }, { status: 201 });
}
