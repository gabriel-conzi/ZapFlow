"use client";

// Prévia visual do fluxo, em formato de celular — mostra como a conversa
// fica, passo a passo, sem precisar publicar a automação nem testar de
// verdade no Instagram/Facebook/Telegram. Não manda nenhuma mensagem real:
// só lê os dados que já estão no editor (texto, imagem, botões etc.) e
// desenha uma simulação da tela do contato.
//
// Sempre mostra o caminho da automação (a partir do Gatilho) até o passo que
// está selecionado no momento — assim, conforme a pessoa vai clicando nos
// passos pra configurar, o celular vai "montando" a conversa na ordem certa.

import { useMemo, useState } from "react";
import { Clock, FileText, GitBranch, Tag, User } from "lucide-react";
import { getConditionRules, getMessageButtons } from "@/lib/automation-types";
import type { AutomationFlow, FlowNode } from "@/lib/automation-types";

const DELAY_UNIT_LABEL: Record<string, string> = {
  seconds: "segundo(s)",
  minutes: "minuto(s)",
  hours: "hora(s)",
  days: "dia(s)",
};

// Troca {{campo}} pelo nome do campo entre 〈 〉 — mais fácil de entender na
// prévia do que a sintaxe de chaves duplas usada por trás dos panos.
function renderFieldTokens(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, field: string) => `〈resposta: ${field}〉`);
}

// Acha o caminho do Gatilho até `targetId`, seguindo as setas do fluxo
// (busca em largura, guardando quem levou a quem). Se o passo selecionado
// tiver mais de um jeito de chegar nele (ex: depois de uma Condição), pega o
// primeiro caminho encontrado — é só uma simulação, não precisa ser o único
// caminho possível.
function findPathToNode(flow: AutomationFlow, targetId: string | null): FlowNode[] {
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));
  const trigger = flow.nodes.find((n) => n.type === "trigger");
  if (!trigger) return [];
  if (!targetId || targetId === trigger.id) return [trigger];

  const parent = new Map<string, string>();
  const visited = new Set([trigger.id]);
  const queue = [trigger.id];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    if (current === targetId) break;
    for (const edge of flow.edges) {
      if (edge.source === current && !visited.has(edge.target)) {
        visited.add(edge.target);
        parent.set(edge.target, current);
        queue.push(edge.target);
      }
    }
  }

  if (!visited.has(targetId)) {
    // passo selecionado ainda não está ligado ao gatilho — mostra ele sozinho
    const solo = nodeById.get(targetId);
    return solo ? [solo] : [];
  }

  const path: string[] = [targetId];
  let cursor = targetId;
  while (parent.has(cursor)) {
    cursor = parent.get(cursor) as string;
    path.push(cursor);
  }
  path.reverse();
  return path.map((id) => nodeById.get(id)).filter((n): n is FlowNode => Boolean(n));
}

function IncomingBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-1.5">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-neutral-300">
        <User size={11} />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-neutral-800 px-2.5 py-1.5 text-[11px] leading-snug text-neutral-100">
        {children}
      </div>
    </div>
  );
}

function OutgoingBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-fuchsia-600 to-purple-600 px-2.5 py-1.5 text-[11px] leading-snug text-white">
        {children}
      </div>
    </div>
  );
}

function SystemPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center rounded-full bg-neutral-800/70 px-2.5 py-1 text-center text-[10px] text-neutral-400">
        {children}
      </span>
    </div>
  );
}

function ReplyButtonsPreview({ node }: { node: Extract<FlowNode, { type: "sendMessage" }> }) {
  const buttons = getMessageButtons(node.data);
  if (buttons.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col items-end gap-1">
      {buttons.map((b) => (
        <span
          key={b.id}
          className="rounded-full border border-purple-400/60 bg-neutral-900 px-2.5 py-1 text-[10px] font-medium text-purple-200"
        >
          {b.kind === "link" ? "🔗 " : ""}
          {b.label || (b.kind === "link" ? "Abrir link" : "Continuar")}
        </span>
      ))}
    </div>
  );
}

function MediaBubble({
  type,
  url,
  caption,
}: {
  type: "image" | "video" | "audio" | "file";
  url: string;
  caption?: string;
}) {
  const [error, setError] = useState(false);
  const trimmed = url?.trim();

  return (
    <div className="flex justify-end">
      <div className="flex max-w-[85%] flex-col gap-1.5 rounded-2xl rounded-br-sm bg-neutral-800 p-1.5">
        {!trimmed ? (
          <p className="max-w-40 px-1.5 py-1 text-[10px] italic text-neutral-500">nenhum link definido ainda</p>
        ) : error ? (
          <p className="max-w-40 px-1.5 py-2 text-[10px] text-red-400">
            Não consegui carregar esse link — confira se está certo e é público.
          </p>
        ) : type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL externa escolhida pelo usuário
          <img src={trimmed} alt="" className="max-h-36 w-40 rounded-lg object-cover" onError={() => setError(true)} />
        ) : type === "video" ? (
          <video controls src={trimmed} className="max-h-36 w-40 rounded-lg bg-black" onError={() => setError(true)} />
        ) : type === "audio" ? (
          <audio controls src={trimmed} className="w-44" onError={() => setError(true)} />
        ) : (
          <a
            href={trimmed}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-1.5 py-1.5 text-[10px] text-purple-200 underline"
          >
            <FileText size={13} /> Abrir arquivo
          </a>
        )}
        {caption && <p className="px-1.5 pb-0.5 text-[10px] leading-snug text-neutral-200">{renderFieldTokens(caption)}</p>}
      </div>
    </div>
  );
}

function StepBubbles({ node }: { node: FlowNode }) {
  switch (node.type) {
    case "trigger": {
      const label =
        node.data.triggerType === "welcome"
          ? "Oi! (primeira mensagem)"
          : node.data.keywords?.length
            ? node.data.keywords[0]
            : "(nenhuma palavra-chave definida)";
      return <IncomingBubble>{label}</IncomingBubble>;
    }
    case "sendMessage":
      return (
        <>
          <OutgoingBubble>{renderFieldTokens(node.data.text) || <em>mensagem vazia</em>}</OutgoingBubble>
          <ReplyButtonsPreview node={node} />
          {getMessageButtons(node.data).some((b) => b.kind === "reply") && (
            <SystemPill>⏸ pausa aqui até o contato escolher um botão</SystemPill>
          )}
        </>
      );
    case "sendImage":
      return <MediaBubble type="image" url={node.data.imageUrl} caption={node.data.caption} />;
    case "sendVideo":
      return <MediaBubble type="video" url={node.data.mediaUrl} caption={node.data.caption} />;
    case "sendAudio":
      return <MediaBubble type="audio" url={node.data.mediaUrl} caption={node.data.caption} />;
    case "sendFile":
      return <MediaBubble type="file" url={node.data.mediaUrl} caption={node.data.caption} />;
    case "collectData":
      return (
        <>
          <OutgoingBubble>{renderFieldTokens(node.data.question) || <em>pergunta vazia</em>}</OutgoingBubble>
          <SystemPill>⏸ pausa aqui até o contato responder</SystemPill>
        </>
      );
    case "delay": {
      const unitLabel = DELAY_UNIT_LABEL[node.data.unit] ?? node.data.unit;
      return (
        <SystemPill>
          <Clock size={10} className="mr-1" /> espera {node.data.amount} {unitLabel}
        </SystemPill>
      );
    }
    case "addTag":
      return (
        <SystemPill>
          <Tag size={10} className="mr-1" /> tag adicionada: {node.data.tagName || "?"} (invisível pro contato)
        </SystemPill>
      );
    case "condition": {
      const rules = getConditionRules(node.data);
      return (
        <SystemPill>
          <GitBranch size={10} className="mr-1" /> verifica condição
          {rules.length > 0 ? ` (${rules.length} critério${rules.length > 1 ? "s" : ""})` : ""}
        </SystemPill>
      );
    }
    default:
      return null;
  }
}

export function FlowPreview({
  flow,
  selectedNodeId,
  automationName,
}: {
  flow: AutomationFlow;
  selectedNodeId: string | null;
  automationName?: string;
}) {
  const path = useMemo(() => findPathToNode(flow, selectedNodeId), [flow, selectedNodeId]);

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-muted/30 p-3">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Prévia da conversa
      </p>
      <div className="mx-auto flex w-full max-w-[240px] flex-1 flex-col overflow-hidden rounded-[26px] border-[6px] border-neutral-900 bg-neutral-950 shadow-lg">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-neutral-300">
            <User size={14} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">Contato de teste</p>
            <p className="truncate text-[10px] text-neutral-500">{automationName || "Automação"}</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2.5 py-3">
          {path.length === 0 ? (
            <p className="mt-6 px-2 text-center text-[11px] text-neutral-500">
              Clique num passo do fluxo pra ver aqui como ele vai aparecer pro contato.
            </p>
          ) : (
            path.map((node) => <StepBubbles key={node.id} node={node} />)
          )}
        </div>
        <div className="border-t border-neutral-800 px-3 py-2">
          <div className="rounded-full bg-neutral-800 px-3 py-1.5 text-[10px] text-neutral-500">Mensagem...</div>
        </div>
      </div>
      <p className="mt-2 px-1 text-center text-[10px] leading-relaxed text-muted-foreground">
        Isso é só uma simulação visual — nenhuma mensagem de verdade é enviada aqui.
      </p>
    </div>
  );
}
