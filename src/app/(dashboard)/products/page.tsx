import { headers } from "next/headers";
import { db } from "@/db";
import { products, productClicks } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { ProductsManager, type ProductRow } from "@/components/products/products-manager";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const workspace = await getCurrentWorkspace();
  const rows = workspace
    ? await db.select().from(products).where(eq(products.workspaceId, workspace.id)).orderBy(desc(products.createdAt))
    : [];

  const clickRows = workspace
    ? await db
        .select({ productId: productClicks.productId })
        .from(productClicks)
        .innerJoin(products, eq(productClicks.productId, products.id))
        .where(eq(products.workspaceId, workspace.id))
    : [];
  const clicksByProduct = new Map<string, number>();
  for (const c of clickRows) clicksByProduct.set(c.productId, (clicksByProduct.get(c.productId) ?? 0) + 1);

  const productRows: ProductRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    imageUrl: p.imageUrl,
    marketplace: p.marketplace,
    destinationUrl: p.destinationUrl,
    slug: p.slug,
    active: p.active,
    clicks: clicksByProduct.get(p.id) ?? 0,
  }));

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const siteOrigin = `${proto}://${host}`;

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Produtos</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cadastre os produtos que você divulga (com seu link de afiliado do Mercado Livre, Shopee,
        Amazon, Magalu etc.) — depois é só usar o nó &quot;Enviar produto&quot; nas automações. Cada
        produto ganha um link curto rastreável, e os cliques aparecem na página Vendas.
      </p>

      <ProductsManager initialProducts={productRows} siteOrigin={siteOrigin} />
    </div>
  );
}
