import { NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { generateUniqueSlug } from "@/lib/products";
import { MARKETPLACES, type Marketplace } from "@/lib/marketplaces";

// Lista os produtos cadastrados do workspace (mais recentes primeiro) — usado
// pela tela de Produtos e pelo seletor do nó "Enviar produto" no editor de
// automações.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.workspaceId, workspace.id))
    .orderBy(desc(products.createdAt));

  return NextResponse.json({ products: rows });
}

export async function POST(req: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const destinationUrl = typeof body?.destinationUrl === "string" ? body.destinationUrl.trim() : "";
  const marketplace = MARKETPLACES.includes(body?.marketplace) ? (body.marketplace as Marketplace) : "outro";
  const price = typeof body?.price === "string" ? body.price.trim() : "";
  const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";

  if (!name) {
    return NextResponse.json({ error: "Dê um nome pro produto." }, { status: 400 });
  }
  if (!destinationUrl || !/^https?:\/\//i.test(destinationUrl)) {
    return NextResponse.json({ error: "Cole o link do produto (precisa começar com http:// ou https://)." }, { status: 400 });
  }

  const slug = await generateUniqueSlug();

  const [created] = await db
    .insert(products)
    .values({
      workspaceId: workspace.id,
      name,
      destinationUrl,
      marketplace,
      price: price || null,
      imageUrl: imageUrl || null,
      slug,
    })
    .returning();

  return NextResponse.json({ product: created }, { status: 201 });
}
