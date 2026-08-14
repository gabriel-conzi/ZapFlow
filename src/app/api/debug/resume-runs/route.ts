import { NextResponse } from "next/server";
import { resumeDueRuns } from "@/lib/automations";
import { getCurrentWorkspace } from "@/lib/workspace";

// Rota de diagnóstico temporária: retoma manualmente as automações paradas
// num nó de "esperar" (mesma lógica que a função agendada da Netlify chama
// via /api/automations/resume, mas protegida pelo login do painel em vez do
// segredo compartilhado — só pra conseguirmos testar sem depender do
// agendamento). Usar visitando a URL logado no painel.
export async function GET() {
  const workspace = await getCurrentWorkspace();
  if (!workspace) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const resumed = await resumeDueRuns();
  return NextResponse.json({ resumed });
}
