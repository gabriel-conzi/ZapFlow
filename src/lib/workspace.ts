import { auth } from "@/lib/auth";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Retorna o workspace do usuário logado. Hoje cada usuário tem exatamente um
 * workspace (criado automaticamente no cadastro) — essa função concentra essa
 * regra num só lugar para que, se o produto virar multiempresa no futuro,
 * baste trocar a implementação aqui.
 */
export async function getCurrentWorkspace() {
  const session = await auth();
  if (!session?.user) return null;

  const userId = (session.user as { id?: string }).id;
  if (!userId) return null;

  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.ownerId, userId)).limit(1);
  return workspace ?? null;
}
