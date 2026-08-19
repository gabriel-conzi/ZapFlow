import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { automations, automationRuns } from "@/db/schema";
import { getCurrentWorkspace } from "@/lib/workspace";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, CheckCircle2, XCircle, Clock3 } from "lucide-react";
import type { AutomationFlow, FlowNodeType } from "@/lib/automation-types";

export const dynamic = "force-dynamic";

// Rótulo genérico de cada tipo de passo — usado quando o nó não tem um
// `label` customizado salvo (mesmos nomes exibidos na barra lateral do
// editor, em components/automations/nodes.tsx).
const NODE_TYPE_LABELS: Record<FlowNodeType, string> = {
  trigger: "Gatilho",
  sendMessage: "Enviar mensagem",
  sendImage: "Enviar imagem",
  sendVideo: "Enviar vídeo",
  sendFile: "Enviar arquivo",
  sendAudio: "Enviar áudio",
  sendProduct: "Enviar produto",
  collectData: "Capturar dado",
  delay: "Esperar",
  addTag: "Adicionar tag",
  condition: "Condição",
};

function nodeLabel(flow: AutomationFlow, nodeId: string | null): string {
  if (!nodeId) return "Fim do fluxo";
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return "Passo removido do fluxo";
  const customLabel = (node.data as { label?: string }).label?.trim();
  return customLabel || NODE_TYPE_LABELS[node.type] || "Passo";
}

function groupByNode(flow: AutomationFlow, nodeIds: (string | null)[]) {
  const counts = new Map<string, number>();
  for (const id of nodeIds) {
    const key = id ?? "__none__";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({
      nodeId: key === "__none__" ? null : key,
      label: nodeLabel(flow, key === "__none__" ? null : key),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default async function AutomationStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const workspace = await getCurrentWorkspace();
  if (!workspace) return null;

  const [automation] = await db
    .select()
    .from(automations)
    .where(and(eq(automations.id, id), eq(automations.workspaceId, workspace.id)))
    .limit(1);
  if (!automation) notFound();

  const flow = automation.flow as AutomationFlow;
  const runs = await db.select().from(automationRuns).where(eq(automationRuns.automationId, id));

  const total = runs.length;
  const completed = runs.filter((r) => r.status === "completed").length;
  const failed = runs.filter((r) => r.status === "failed").length;
  const active = runs.filter((r) => r.status === "waiting" || r.status === "running").length;

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const waitingBreakdown = groupByNode(
    flow,
    runs.filter((r) => r.status === "waiting" || r.status === "running").map((r) => r.nextNodeId)
  );
  const failedBreakdown = groupByNode(
    flow,
    runs.filter((r) => r.status === "failed").map((r) => r.nextNodeId)
  );
  const waitingMax = Math.max(0, ...waitingBreakdown.map((b) => b.count));
  const failedMax = Math.max(0, ...failedBreakdown.map((b) => b.count));

  const cards = [
    { label: "Contatos que entraram", value: total, icon: Users, hint: null as string | null },
    { label: "Completaram o fluxo", value: completed, icon: CheckCircle2, hint: `${pct(completed)}% do total` },
    { label: "Falharam", value: failed, icon: XCircle, hint: `${pct(failed)}% do total` },
    { label: "Parados / em andamento", value: active, icon: Clock3, hint: `${pct(active)}% do total` },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center gap-3">
        <Link href={`/automations/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft size={16} />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Estatísticas — {automation.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Baseado em todas as execuções registradas dessa automação.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Clock3 size={28} />
            <p className="max-w-sm text-sm">
              Essa automação ainda não teve nenhuma execução. As estatísticas aparecem aqui assim que
              o primeiro contato disparar o gatilho.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map(({ label, value, icon: Icon, hint }) => (
              <Card key={label}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                  </CardTitle>
                  <Icon size={16} className="text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{value}</div>
                  {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Onde estão parados agora</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Contatos esperando o contato responder, apertar um botão, ou o tempo de um "Esperar" passar.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {waitingBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ninguém parado no momento.</p>
                ) : (
                  waitingBreakdown.map((b) => (
                    <div key={b.nodeId ?? "none"} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{b.label}</span>
                        <span className="shrink-0 text-muted-foreground">{b.count}</span>
                      </div>
                      <Bar value={b.count} max={waitingMax} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Onde falharam</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Passo em que a execução deu erro (ex: token expirado, campo mal configurado).
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {failedBreakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma falha registrada. 🎉</p>
                ) : (
                  failedBreakdown.map((b) => (
                    <div key={b.nodeId ?? "none"} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">{b.label}</span>
                        <span className="shrink-0 text-muted-foreground">{b.count}</span>
                      </div>
                      <Bar value={b.count} max={failedMax} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
