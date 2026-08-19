import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { MARKETPLACES, type Marketplace } from "@/lib/marketplaces";

async function findOwnedProduct(workspaceId: string, id: string) {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const existing = await findOwnedProduct(workspace.id, id);
  if (!existing) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const patch: Partial<typeof products.$inferInsert> = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Dê um nome pro produto." }, { status: 400 });
    patch.name = name;
  }
  if (typeof body?.destinationUrl === "string") {
    const destinationUrl = body.destinationUrl.trim();
    if (!destinationUrl || !/^https?:\/\//i.test(destinationUrl)) {
      return NextResponse.json({ error: "Link do produto inválido (precisa começar com http:// ou https://)." }, { status: 400 });
    }
    patch.destinationUrl = destinationUrl;
  }
  if (typeof body?.marketplace === "string") {
    if (!MARKETPLACES.includes(body.marketplace as Marketplace)) {
      return NextResponse.json({ error: "Marketplace inválido." }, { status: 400 });
    }
    patch.marketplace = body.marketplace;
  }
  if (typeof body?.price === "string") patch.price = body.price.trim() || null;
  if (typeof body?.imageUrl === "string") patch.imageUrl = body.imageUrl.trim() || null;
  if (typeof body?.active === "boolean") patch.active = body.active;

  const [updated] = await db.update(products).set(patch).where(eq(products.id, id)).returning();
  return NextResponse.json({ product: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const existing = await findOwnedProduct(workspace.id, id);
  if (!existing) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

  await db.delete(products).where(eq(products.id, id));
  return NextResponse.json({ ok: true });
}
