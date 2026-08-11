import { NextResponse } from "next/server";
import { db } from "@/db";
import { emailAccounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentWorkspace } from "@/lib/workspace";

// Salva o endereço remetente conectado (ex: contato@usepostflow.com). As
// chaves sensíveis (RESEND_API_KEY, RESEND_WEBHOOK_SECRET) ficam só no .env —
// aqui só guardamos qual endereço/domínio o workspace vai usar.
export async function POST(req: Request) {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const fromAddress = (body?.fromAddress as string | undefined)?.trim().toLowerCase();
  const fromName = (body?.fromName as string | undefined)?.trim() || null;

  if (!fromAddress || !fromAddress.includes("@")) {
    return NextResponse.json({ error: "Informe um endereço de e-mail válido" }, { status: 400 });
  }
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json(
      { error: "RESEND_API_KEY não configurada no .env — veja o passo a passo no README" },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select()
    .from(emailAccounts)
    .where(and(eq(emailAccounts.workspaceId, workspace.id), eq(emailAccounts.fromAddress, fromAddress)))
    .limit(1);

  if (existing) {
    await db.update(emailAccounts).set({ fromName, connected: true }).where(eq(emailAccounts.id, existing.id));
  } else {
    await db.insert(emailAccounts).values({ workspaceId: workspace.id, fromAddress, fromName });
  }

  return NextResponse.json({ ok: true, fromAddress });
}
