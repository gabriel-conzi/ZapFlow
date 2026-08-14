"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nodeTypes, paletteItems } from "@/components/automations/nodes";
import { NodePanel } from "@/components/automations/node-panel";
import type { AutomationFlow, FlowNode, FlowNodeType, SendMessageNodeData } from "@/lib/automation-types";

type AutomationRow = {
  id: string;
  name: string;
  status: string;
  flow: AutomationFlow;
};

function defaultDataFor(type: FlowNodeType): Record<string, unknown> {
  switch (type) {
    case "sendMessage":
      return { text: "", buttons: [] };
    case "delay":
      return { amount: 1, unit: "hours" };
    case "addTag":
      return { tagName: "" };
    case "condition":
      return { rules: [], combinator: "and" };
    case "collectData":
      return { question: "", fieldName: "" };
    case "trigger":
    default:
      return { triggerType: "keyword", keywords: [] };
  }
}

function EditorInner({ automation }: { automation: AutomationRow }) {
  const [name, setName] = useState(automation.name);
  const [status, setStatus] = useState(automation.status);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    automation.flow.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data as Record<string, unknown>,
      deletable: n.type !== "trigger",
    }))
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    automation.flow.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle }))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) as unknown as FlowNode | undefined,
    [nodes, selectedId]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        // no máximo uma conexão saindo de cada handle (o motor de execução assume isso)
        const filtered = eds.filter(
          (e) => !(e.source === connection.source && (e.sourceHandle ?? null) === (connection.sourceHandle ?? null))
        );
        return addEdge({ ...connection, id: crypto.randomUUID() }, filtered);
      });
    },
    [setEdges]
  );

  function addNode(type: Exclude<FlowNodeType, "trigger">) {
    const id = crypto.randomUUID();
    const newNode: Node = {
      id,
      type,
      position: { x: 340 + ((nodes.length * 37) % 120), y: 80 + nodes.length * 50 },
      data: defaultDataFor(type),
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedId(id);
  }

  function updateSelectedNodeData(partial: Record<string, unknown>) {
    if (!selectedId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedId) return n;
        const nextData = { ...n.data, ...partial };
        // se a lista de botões de um nó de "Enviar mensagem" mudou (botão
        // removido, ou trocou de "ramificar" pra "link"), tira do canvas as
        // arestas que saíam de um botão que não existe mais como "reply" —
        // o id do botão é o sourceHandle da aresta.
        if (n.type === "sendMessage" && "buttons" in partial) {
          const validHandles = new Set(
            ((nextData as SendMessageNodeData).buttons ?? [])
              .filter((b) => b.kind === "reply")
              .map((b) => b.id)
          );
          setEdges((eds) =>
            eds.filter((e) => e.source !== selectedId || !e.sourceHandle || validHandles.has(e.sourceHandle))
          );
        }
        return { ...n, data: nextData };
      })
    );
  }

  function deleteSelectedNode() {
    if (!selectedId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedId && e.target !== selectedId));
    setSelectedId(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const flow: AutomationFlow = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type as FlowNodeType,
          position: n.position,
          data: n.data,
        })) as FlowNode[],
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle })),
      };
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, flow }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Erro ao salvar");
      }
      setSavedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(next: string) {
    setStatus(next);
    try {
      await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
    } catch {
      // silencioso — o próximo salvar/recarregar reflete o estado real
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/automations">
            <Button variant="ghost" size="icon">
              <ArrowLeft size={16} />
            </Button>
          </Link>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 w-64 font-medium" />
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-destructive">{error}</span>}
          {savedAt && !error && (
            <span className="text-xs text-muted-foreground">Salvo às {savedAt.toLocaleTimeString("pt-BR")}</span>
          )}
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            <option value="draft">Rascunho</option>
            <option value="active">Ativa</option>
            <option value="paused">Pausada</option>
          </select>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-44 shrink-0 flex-col gap-2 border-r p-3">
          <p className="px-1 text-[11px] font-semibold uppercase text-muted-foreground">Adicionar passo</p>
          {paletteItems.map((item) => (
            <button
              key={item.type}
              onClick={() => addNode(item.type)}
              className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs hover:bg-accent"
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded text-white ${item.iconClassName}`}
              >
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
            Clique num passo pra adicionar, depois arraste dos pontinhos pra conectar as setas.
          </p>
        </div>

        <div className="relative flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            deleteKeyCode={["Backspace", "Delete"]}
            fitView
          >
            <Background gap={16} />
            <Controls />
          </ReactFlow>
        </div>

        {selectedNode && (
          <NodePanel
            node={selectedNode}
            onChange={updateSelectedNodeData}
            onDelete={selectedNode.type !== "trigger" ? deleteSelectedNode : undefined}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

export function AutomationEditor({ automation }: { automation: AutomationRow }) {
  return (
    <ReactFlowProvider>
      <EditorInner automation={automation} />
    </ReactFlowProvider>
  );
}
