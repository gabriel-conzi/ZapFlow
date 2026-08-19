import Link from "next/link";
import { db } from "@/db";
import { automations, productClicks, products } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MARKETPLACE_LABELS, type Marketplace } from "@/lib/marketplaces";
import { MousePointerClick, Package, ShoppingBag, Workflow } from "lucide-react";

export const dynamic = "force-dynamic";

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function SalesPage() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const productRows = await db.select().from(products).where(eq(products.workspaceId, workspace.id));
  const automationRows = await db
    .select({ id: automations.id, name: automations.name })
    .from(automations)
    .where(eq(automations.workspaceId, workspace.id));
  const automationNameById = new Map(automationRows.map((a) => [a.id, a.name]));

  const clickRows = await db
    .select({ productId: productClicks.productId, automationId: productClicks.automationId })
    .from(productClicks)
    .innerJoin(products, eq(productClicks.productId, products.id))
    .where(eq(products.workspaceId, workspace.id));

  const totalClicks = clickRows.length;

  const clicksByProduct = new Map<string, number>();
  const clicksByAutomation = new Map<string, number>(); // key "" = link copiado manualmente (sem automação)
  for (const c of clickRows) {
    clicksByProduct.set(c.productId, (clicksByProduct.get(c.productId) ?? 0) + 1);
    const key = c.automationId ?? "";
    clicksByAutomation.set(key, (clicksByAutomation.get(key) ?? 0) + 1);
  }

  const productRanking = productRows
    .map((p) => ({
      id: p.id,
      name: p.name,
      marketplace: p.marketplace,
      price: p.price,
      clicks: clicksByProduct.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const automationRanking = Array.from(clicksByAutomation.entries())
    .map(([id, clicks]) => ({
      id,
      name: id ? automationNameById.get(id) ?? "Automação removida" : "Link copiado manualmente (fora de automação)",
      clicks,
    }))
    .sort((a, b) => b.clicks - a.clicks);

  const productMax = Math.max(0, ...productRanking.map((p) => p.clicks));
  const automationMax = Math.max(0, ...automationRanking.map((a) => a.clicks));

  const cards = [
    { label: "Cliques no total", value: totalClicks, icon: MousePointerClick },
    { label: "Produtos cadastrados", value: productRows.length, icon: Package },
    { label: "Produtos com pelo menos 1 clique", value: productRanking.filter((p) => p.clicks > 0).length, icon: ShoppingBag },
  ];

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">Vendas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cliques nos links rastreáveis dos seus produtos (
        <Link href="/products" className="text-primary underline">
          gerencie em Produtos
        </Link>
        ). É uma contagem de clique — a confirmação da venda de verdade e o valor da comissão
        dependem do painel de afiliados de cada marketplace.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
              <Icon size={16} className="text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalClicks === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <MousePointerClick size={28} />
            <p className="max-w-sm text-sm">
              Nenhum clique registrado ainda. Cadastre produtos em{" "}
              <Link href="/products" className="text-primary underline">
                Produtos
              </Link>{" "}
              e use o nó &quot;Enviar produto&quot; numa automação (ou copie o link rastreável direto)
              pra começar a aparecer aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ranking de produtos</CardTitle>
              <p className="text-xs text-muted-foreground">Produtos com mais cliques no link rastreável.</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {productRanking.map((p) => (
                <div key={p.id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate">
                      {p.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {MARKETPLACE_LABELS[p.marketplace as Marketplace] ?? p.marketplace}
                        {p.price ? ` · ${p.price}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">{p.clicks}</span>
                  </div>
                  <Bar value={p.clicks} max={productMax} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cliques por automação</CardTitle>
              <p className="text-xs text-muted-foreground">
                Qual automação (nó &quot;Enviar produto&quot;) gerou mais cliques.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {automationRanking.map((a) => (
                <div key={a.id || "manual"} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 truncate">
                      <Workflow size={12} className="shrink-0 text-muted-foreground" />
                      {a.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">{a.clicks}</span>
                  </div>
                  <Bar value={a.clicks} max={automationMax} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
