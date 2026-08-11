import { NextResponse } from "next/server";
import { db } from "@/db";
import { instagramAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";
import { subscribeInstagramAccount } from "@/lib/instagram";

// Reativa manualmente a inscrição de webhooks de uma conta já conectada —
// útil pra contas que foram conectadas ANTES da assinatura automática
// existir (ver /api/instagram/callback), sem precisar desconectar e
// reconectar tudo de novo. Só o dono logado consegue chamar (protegido
// pelo src/proxy.ts, que exige sessão pra tudo que não está em PUBLIC_PATHS).
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.redirect(`${origin}/login`);

  const conditions = accountId
    ? and(eq(instagramAccounts.workspaceId, workspace.id), eq(instagramAccounts.id, accountId))
    : eq(instagramAccounts.workspaceId, workspace.id);

  const accounts = await db.select().from(instagramAccounts).where(conditions);
  if (accounts.length === 0) {
    return NextResponse.redirect(`${origin}/settings?ig_error=${encodeURIComponent("Conta não encontrada")}`);
  }

  try {
    for (const account of accounts) {
      await subscribeInstagramAccount({ accessToken: account.accessToken, igUserId: account.igUserId });
    }
    return NextResponse.redirect(`${origin}/settings?ig_resubscribed=1`);
  } catch (err) {
    console.error("[instagram/resubscribe] erro:", err);
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.redirect(`${origin}/settings?ig_subscribe_error=${encodeURIComponent(message)}`);
  }
}
