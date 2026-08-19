import { db } from "@/db";
import { products } from "@/db/schema";
import { eq } from "drizzle-orm";

const SLUG_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomSlug(length = 7): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += SLUG_CHARS[Math.floor(Math.random() * SLUG_CHARS.length)];
  }
  return out;
}

/** Gera um slug curto e único (globalmente, não só por workspace — a rota
 * pública /r/slug não sabe de qual workspace é) pro link rastreável de um
 * produto novo. Tenta algumas vezes até achar um que não exista ainda
 * (extremamente improvável colidir, mas mais seguro que assumir). */
export async function generateUniqueSlug(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = randomSlug(attempt < 4 ? 7 : 9); // aumenta o tamanho se colidir muitas vezes
    const [existing] = await db.select({ id: products.id }).from(products).where(eq(products.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  throw new Error("Não consegui gerar um link único pro produto, tenta salvar de novo.");
}

/** Monta a URL pública rastreável de um produto (/r/slug), opcionalmente
 * marcada com qual automação mandou o link (pra aparecer no ranking da
 * página Vendas). Usa NEXTAUTH_URL como origem — a mesma variável de
 * ambiente que já define a URL pública do site. */
export function buildTrackedProductUrl(slug: string, automationId?: string): string {
  const base = (process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  const url = new URL(`${base}/r/${slug}`);
  if (automationId) url.searchParams.set("a", automationId);
  return url.toString();
}
