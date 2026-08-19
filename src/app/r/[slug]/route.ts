import { NextResponse } from "next/server";
import { db } from "@/db";
import { products, productClicks } from "@/db/schema";
import { eq } from "drizzle-orm";

// Rota PÚBLICA (fora do grupo (dashboard), sem exigir login — precisa estar
// na lista PUBLIC_PATHS de src/proxy.ts) — é o link curto que o ZapFlow gera
// pra cada produto cadastrado (/r/slug). Quando alguém clica (seja num botão
// mandado pelo nó "Enviar produto", seja num link copiado manualmente),
// registra 1 clique e redireciona pro link de afiliado/produto de verdade.
// `?a=<automationId>` (opcional) diz qual automação mandou esse link
// específico, pra aparecer separado no ranking da página Vendas.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { searchParams, origin } = new URL(req.url);
  const automationId = searchParams.get("a") || null;

  const [product] = await db.select().from(products).where(eq(products.slug, slug)).limit(1);

  if (!product || !product.active) {
    // link inválido/removido/pausado — manda pra home em vez de dar erro feio
    return NextResponse.redirect(origin);
  }

  try {
    await db.insert(productClicks).values({ productId: product.id, automationId });
  } catch (err) {
    // nunca deixa uma falha ao registrar o clique impedir o redirecionamento
    console.error("[products] erro ao registrar clique:", err);
  }

  return NextResponse.redirect(product.destinationUrl, { status: 302 });
}
