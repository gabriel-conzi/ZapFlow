import { NextResponse } from "next/server";
import { resumeDueRuns } from "@/lib/automations";

// Chamada pela função agendada da Netlify (netlify/functions/automations-cron.mts)
// uma vez por minuto. Não usa sessão de login — é protegida por um segredo
// compartilhado (CRON_SECRET), por isso precisa estar em PUBLIC_PATHS no
// src/proxy.ts, mas continua checando o segredo aqui dentro.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = req.headers.get("x-cron-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const resumed = await resumeDueRuns();
  return NextResponse.json({ resumed });
}
