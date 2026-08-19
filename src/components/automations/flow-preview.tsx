"use client";

// Prévia visual do fluxo, em formato de celular — mostra como a conversa
// fica, sem precisar publicar a automação nem testar de verdade no
// Instagram/Facebook/Telegram.
//
// Duas abas, iguais na ideia às do Manychat:
// - "Visualização": modo passivo — mostra o caminho da automação (a partir
//   do Gatilho) até o passo selecionado no momento no editor, atualizando
//   conforme a pessoa clica nos passos pra configurar.
// - "Teste": modo interativo — dá pra digitar uma mensagem no campo do
//   celular (como se fosse o contato mandando um Direct) e ver a automação
//   "rodar" ali mesmo: mensagens aparecem em sequência, botões de
//   ramificação ficam clicáveis, perguntas de "Capturar dado" esperam uma
//   resposta digitada, condições são avaliadas de verdade (usando os dados
//   capturados/tags adicionadas durante esse teste). Tudo local, na hora —
//   nenhuma mensagem de verdade é enviada, nenhum dado é salvo no banco.

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock, FileText, GitBranch, RotateCcw, SendHorizontal, Tag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getConditionRules, getMessageButtons, type ConditionNodeData, type ConditionRule } from "@/lib/automation-types";
import type { AutomationFlow, FlowNode } from "@/lib/automation-types";

const DELAY_UNIT_LABEL: Record<string, string> = {
  seconds: "segundo(s)",
  minutes: "minuto(s)",
  hours: "hora(s)",
  days: "dia(s)",
};

// Tempo entre cada passo no modo Teste, só pra dar a sensação de conversa
// acontecendo (bem mais rápido que o "Esperar" de verdade, que é minutos/horas).
const TEST_STEP_DELAY_MS = 450;

// Troca {{campo}} pelo nome do campo entre 〈 〉 (modo Visualização) ou pelo
// valor de verdade capturado durante o teste (modo Teste).
function renderFieldTokens(text: string, fields?: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, field: string) => {
    if (fields && field in fields) return fields[field];
    return `〈resposta: ${field}〉`;
  });
}

function nextDefaultTarget(flow: AutomationFlow, nodeId: string): string | null {
  const edge = flow.edges.find((e) => e.source === nodeId && !e.sourceHandle);
  return edge?.target ?? null;
}

// Mesma lógica de `evaluateConditionRule`/`matchesTrigger` em lib/automations.ts
// (comparação sempre em minúsculas), só que lendo de um Map/Set local em vez
// do banco — é o que faz o nó de Condição se comportar igual no teste.
function evaluateRule(rule: ConditionRule, fields: Record<string, string>, tags: Set<string>): boolean {
  if (rule.kind === "tag") {
    if (!rule.tagName?.trim()) return false;
    return tags.has(rule.tagName.trim().toLowerCase());
  }
  if (!rule.fieldName?.trim()) return false;
  const value = (fields[rule.fieldName.trim()] ?? "").trim();
  const compareTo = (rule.value ?? "").trim();
  switch (rule.operator) {
    case "isEmpty":
      return value === "";
    case "isNotEmpty":
      return value !== "";
    case "notEquals":
      return value.toLowerCase() !== compareTo.toLowerCase();
    case "contains":
      return compareTo !== "" && value.toLowerCase().includes(compareTo.toLowerCase());
    case "equals":
    default:
      return value.toLowerCase() === compareTo.toLowerCase();
  }
}

function evaluateConditionNode(data: ConditionNodeData, fields: Record<string, string>, tags: Set<string>): boolean {
  const rules = getConditionRules(data);
  if (rules.length === 0) return false;
  const results = rules.map((r) => evaluateRule(r, fields, tags));
  return data.combinator === "or" ? results.some(Boolean) : results.every(Boolean);
}

// Mesma lógica de `matchesTrigger` (lib/automations.ts) pro caso de DM —
// "welcome" dispara em qualquer mensagem (é a 1ª do teste); "keyword"/
// "comment" batem se o texto conter qualquer uma das palavras, sem
// diferenciar maiúscula/minúscula.
function checkTriggerMatch(trigger: Extract<FlowNode, { type: "trigger" }>, text: string): boolean {
  if (trigger.data.triggerType === "welcome") return true;
  const keywords = trigger.data.keywords ?? [];
  if (keywords.length === 0) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase()));
}

// Acha o caminho do Gatilho até `targetId` (modo Visualização), seguindo as
// setas do fluxo (busca em largura, guardando quem levou a quem).
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
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-neutral-300">
        <User size={10} />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-neutral-800 px-2 py-1 text-[11px] leading-snug text-neutral-100">
        {children}
      </div>
    </div>
  );
}

function OutgoingBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gradient-to-br from-fuchsia-600 to-purple-600 px-2 py-1 text-[11px] leading-snug text-white">
        {children}
      </div>
    </div>
  );
}

function SystemPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="inline-flex items-center rounded-full bg-neutral-800/70 px-2 py-0.5 text-center text-[10px] text-neutral-400">
        {children}
      </span>
    </div>
  );
}

function MediaBubble({
  type,
  url,
  caption,
  fields,
}: {
  type: "image" | "video" | "audio" | "file";
  url: string;
  caption?: string;
  fields?: Record<string, string>;
}) {
  const [error, setError] = useState(false);
  const trimmed = url?.trim();

  return (
    <div className="flex justify-end">
      <div className="flex w-[85%] max-w-[220px] flex-col gap-1 rounded-2xl rounded-br-sm bg-neutral-800 p-1">
        {!trimmed ? (
          <p className="px-1 py-1 text-[10px] italic text-neutral-500">nenhum link definido ainda</p>
        ) : error ? (
          <p className="px-1 py-1.5 text-[10px] text-red-400">
            Não consegui carregar esse link — confira se está certo e é público.
          </p>
        ) : type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL externa escolhida pelo usuário
          <img src={trimmed} alt="" className="max-h-28 w-full rounded-lg object-cover" onError={() => setError(true)} />
        ) : type === "video" ? (
          <video controls src={trimmed} className="max-h-28 w-full rounded-lg bg-black" onError={() => setError(true)} />
        ) : type === "audio" ? (
          <audio controls src={trimmed} className="w-full" onError={() => setError(true)} />
        ) : (
          <a
            href={trimmed}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 px-1 py-1 text-[10px] text-purple-200 underline"
          >
            <FileText size={11} /> Abrir arquivo
          </a>
        )}
        {caption && <p className="px-1 pb-0.5 text-[10px] leading-snug text-neutral-200">{renderFieldTokens(caption, fields)}</p>}
      </div>
    </div>
  );
}

function ProductBubble({
  productLabel,
  extraText,
  fields,
}: {
  productLabel?: string;
  extraText?: string;
  fields?: Record<string, string>;
}) {
  return (
    <div className="flex justify-end">
      <div className="flex w-[85%] max-w-[220px] flex-col gap-1 rounded-2xl rounded-br-sm bg-neutral-800 p-1.5">
        {productLabel ? (
          <p className="text-[11px] font-medium leading-snug text-neutral-100">{productLabel}</p>
        ) : (
          <p className="text-[10px] italic text-neutral-500">nenhum produto escolhido ainda</p>
        )}
        {extraText && (
          <p className="text-[10px] leading-snug text-neutral-300">{renderFieldTokens(extraText, fields)}</p>
        )}
        <span className="mt-0.5 w-fit rounded-full border border-green-400/60 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-green-300">
          🛒 Comprar
        </span>
      </div>
    </div>
  );
}

// ───────────────────────── Modo Visualização (passivo) ─────────────────────────

function ReplyButtonsPreview({ node }: { node: Extract<FlowNode, { type: "sendMessage" }> }) {
  const buttons = getMessageButtons(node.data);
  if (buttons.length === 0) return null;
  return (
    <div className="mt-1 flex flex-col items-end gap-1">
      {buttons.map((b) => (
        <span
          key={b.id}
          className="rounded-full border border-purple-400/60 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-purple-200"
        >
          {b.kind === "link" ? "🔗 " : ""}
          {b.label || (b.kind === "link" ? "Abrir link" : "Continuar")}
        </span>
      ))}
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
            <SystemPill>⏸ pausa até o contato escolher um botão</SystemPill>
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
    case "sendProduct":
      return <ProductBubble productLabel={node.data.productLabel} extraText={node.data.extraText} />;
    case "collectData":
      return (
        <>
          <OutgoingBubble>{renderFieldTokens(node.data.question) || <em>pergunta vazia</em>}</OutgoingBubble>
          <SystemPill>⏸ pausa até o contato responder</SystemPill>
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
          <Tag size={10} className="mr-1" /> tag: {node.data.tagName || "?"} (invisível pro contato)
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

function VisualizationPanel({ flow, selectedNodeId }: { flow: AutomationFlow; selectedNodeId: string | null }) {
  const path = useMemo(() => findPathToNode(flow, selectedNodeId), [flow, selectedNodeId]);
  return (
    <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden px-2 py-2.5">
      {path.length === 0 ? (
        <p className="mt-6 px-2 text-center text-[11px] text-neutral-500">
          Clique num passo do fluxo pra ver aqui como ele vai aparecer pro contato.
        </p>
      ) : (
        path.map((node) => <StepBubbles key={node.id} node={node} />)
      )}
    </div>
  );
}

// ───────────────────────── Modo Teste (interativo) ─────────────────────────

type TestEntry =
  | { id: string; kind: "incoming"; text: string }
  | { id: string; kind: "node"; node: FlowNode; resultNote?: "Sim" | "Não" }
  | { id: string; kind: "note"; text: string };

type Awaiting = { type: "buttons"; nodeId: string } | { type: "collectData"; nodeId: string };

function TestStepView({
  node,
  resultNote,
  fields,
  interactiveButtons,
  onButtonClick,
}: {
  node: FlowNode;
  resultNote?: "Sim" | "Não";
  fields: Record<string, string>;
  interactiveButtons: boolean;
  onButtonClick: (buttonId: string, label: string) => void;
}) {
  switch (node.type) {
    case "sendMessage": {
      const buttons = getMessageButtons(node.data);
      return (
        <>
          <OutgoingBubble>{renderFieldTokens(node.data.text, fields) || <em>mensagem vazia</em>}</OutgoingBubble>
          {buttons.length > 0 && (
            <div className="mt-1 flex flex-col items-end gap-1">
              {buttons.map((b) =>
                b.kind === "link" ? (
                  <a
                    key={b.id}
                    href={b.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-purple-400/60 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-purple-200 underline"
                  >
                    🔗 {b.label || "Abrir link"}
                  </a>
                ) : (
                  <button
                    key={b.id}
                    type="button"
                    disabled={!interactiveButtons}
                    onClick={() => onButtonClick(b.id, b.label)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                      interactiveButtons
                        ? "cursor-pointer border-purple-400 bg-neutral-900 text-purple-200 hover:bg-purple-900"
                        : "border-purple-400/30 bg-neutral-900/50 text-purple-200/50"
                    )}
                  >
                    {b.label || "Continuar"}
                  </button>
                )
              )}
            </div>
          )}
        </>
      );
    }
    case "collectData":
      return <OutgoingBubble>{renderFieldTokens(node.data.question, fields) || <em>pergunta vazia</em>}</OutgoingBubble>;
    case "sendImage":
      return <MediaBubble type="image" url={node.data.imageUrl} caption={node.data.caption} fields={fields} />;
    case "sendVideo":
      return <MediaBubble type="video" url={node.data.mediaUrl} caption={node.data.caption} fields={fields} />;
    case "sendAudio":
      return <MediaBubble type="audio" url={node.data.mediaUrl} caption={node.data.caption} fields={fields} />;
    case "sendFile":
      return <MediaBubble type="file" url={node.data.mediaUrl} caption={node.data.caption} fields={fields} />;
    case "sendProduct":
      return <ProductBubble productLabel={node.data.productLabel} extraText={node.data.extraText} fields={fields} />;
    case "delay": {
      const unitLabel = DELAY_UNIT_LABEL[node.data.unit] ?? node.data.unit;
      return (
        <SystemPill>
          <Clock size={10} className="mr-1" /> esperaria {node.data.amount} {unitLabel} (pulado no teste)
        </SystemPill>
      );
    }
    case "addTag":
      return (
        <SystemPill>
          <Tag size={10} className="mr-1" /> tag adicionada: {node.data.tagName || "?"}
        </SystemPill>
      );
    case "condition": {
      const rules = getConditionRules(node.data);
      return (
        <SystemPill>
          <GitBranch size={10} className="mr-1" /> condição
          {rules.length > 0 ? ` (${rules.length} critério${rules.length > 1 ? "s" : ""})` : ""} → seguiu por &quot;
          {resultNote ?? "?"}&quot;
        </SystemPill>
      );
    }
    default:
      return null;
  }
}

function TestPanel({ flow }: { flow: AutomationFlow }) {
  const trigger = useMemo(() => flow.nodes.find((n) => n.type === "trigger"), [flow]);
  const nodeById = useMemo(() => new Map(flow.nodes.map((n) => [n.id, n])), [flow]);

  const [entries, setEntries] = useState<TestEntry[]>([]);
  const [awaiting, setAwaiting] = useState<Awaiting | null>(null);
  const [started, setStarted] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const fieldsRef = useRef<Record<string, string>>({});
  const tagsRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [entries]);

  function reset() {
    setEntries([]);
    setAwaiting(null);
    setStarted(false);
    setInputValue("");
    fieldsRef.current = {};
    tagsRef.current = new Set();
  }

  function append(entry: TestEntry) {
    if (!mountedRef.current) return;
    setEntries((prev) => [...prev, entry]);
  }

  async function runFrom(startId: string) {
    let currentId: string | null = startId;
    let steps = 0;
    while (currentId && steps < 50 && mountedRef.current) {
      steps++;
      const node: FlowNode | undefined = nodeById.get(currentId);
      if (!node) break;

      if (node.type === "condition") {
        const passed = evaluateConditionNode(node.data, fieldsRef.current, tagsRef.current);
        append({ id: crypto.randomUUID(), kind: "node", node, resultNote: passed ? "Sim" : "Não" });
        await new Promise((r) => setTimeout(r, TEST_STEP_DELAY_MS));
        const edge = flow.edges.find((e) => e.source === node.id && e.sourceHandle === (passed ? "yes" : "no"));
        currentId = edge?.target ?? null;
        continue;
      }

      if (node.type === "addTag") {
        if (node.data.tagName?.trim()) tagsRef.current.add(node.data.tagName.trim().toLowerCase());
        append({ id: crypto.randomUUID(), kind: "node", node });
        await new Promise((r) => setTimeout(r, TEST_STEP_DELAY_MS));
        currentId = nextDefaultTarget(flow, node.id);
        continue;
      }

      if (node.type === "sendMessage") {
        append({ id: crypto.randomUUID(), kind: "node", node });
        const pausesHere = getMessageButtons(node.data).some((b) => b.kind === "reply");
        if (pausesHere) {
          if (mountedRef.current) setAwaiting({ type: "buttons", nodeId: node.id });
          return;
        }
        await new Promise((r) => setTimeout(r, TEST_STEP_DELAY_MS));
        currentId = nextDefaultTarget(flow, node.id);
        continue;
      }

      if (node.type === "collectData") {
        append({ id: crypto.randomUUID(), kind: "node", node });
        if (mountedRef.current) setAwaiting({ type: "collectData", nodeId: node.id });
        return;
      }

      // trigger (não deveria aparecer aqui, já foi representado pela
      // mensagem digitada) e nós de mídia/delay: só mostra e segue.
      if (node.type !== "trigger") {
        append({ id: crypto.randomUUID(), kind: "node", node });
      }
      await new Promise((r) => setTimeout(r, TEST_STEP_DELAY_MS));
      currentId = nextDefaultTarget(flow, node.id);
    }
    if (mountedRef.current) setAwaiting(null);
  }

  async function handleSend() {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue("");

    if (awaiting?.type === "collectData") {
      const node = nodeById.get(awaiting.nodeId);
      append({ id: crypto.randomUUID(), kind: "incoming", text });
      if (node?.type === "collectData" && node.data.fieldName?.trim()) {
        fieldsRef.current[node.data.fieldName.trim()] = text;
      }
      setAwaiting(null);
      const target = node ? nextDefaultTarget(flow, node.id) : null;
      if (target) await runFrom(target);
      return;
    }

    if (awaiting?.type === "buttons") return; // esperando toque num botão, não em texto

    if (!trigger || trigger.type !== "trigger") return;
    append({ id: crypto.randomUUID(), kind: "incoming", text });
    const matched = checkTriggerMatch(trigger, text);
    if (!matched) {
      append({
        id: crypto.randomUUID(),
        kind: "note",
        text: "🚫 essa mensagem não bateria com o gatilho dessa automação",
      });
      return;
    }
    setStarted(true);
    const target = nextDefaultTarget(flow, trigger.id);
    if (target) await runFrom(target);
    else append({ id: crypto.randomUUID(), kind: "note", text: "(fluxo sem nenhum passo depois do gatilho)" });
  }

  function handleButtonClick(nodeId: string, buttonId: string, label: string) {
    if (awaiting?.type !== "buttons" || awaiting.nodeId !== nodeId) return;
    append({ id: crypto.randomUUID(), kind: "incoming", text: label || "Continuar" });
    setAwaiting(null);
    const edge = flow.edges.find((e) => e.source === nodeId && e.sourceHandle === buttonId);
    if (edge) runFrom(edge.target);
  }

  const inputDisabled = awaiting?.type === "buttons";
  const placeholder =
    awaiting?.type === "buttons"
      ? "Toque num botão acima pra continuar..."
      : awaiting?.type === "collectData"
        ? "Digite a resposta..."
        : started
          ? "Digite outra mensagem..."
          : "Digite uma mensagem, como o contato faria...";

  return (
    <>
      <div ref={scrollRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden px-2 py-2.5">
        {entries.length === 0 ? (
          <p className="mt-6 px-2 text-center text-[11px] text-neutral-500">
            Digite abaixo uma mensagem que bateria com o gatilho dessa automação pra ver ela rodar de verdade, aqui
            mesmo — sem mandar nada pelo Instagram.
          </p>
        ) : (
          entries.map((entry) => {
            if (entry.kind === "incoming") return <IncomingBubble key={entry.id}>{entry.text}</IncomingBubble>;
            if (entry.kind === "note") return <SystemPill key={entry.id}>{entry.text}</SystemPill>;
            return (
              <TestStepView
                key={entry.id}
                node={entry.node}
                resultNote={entry.resultNote}
                fields={fieldsRef.current}
                interactiveButtons={awaiting?.type === "buttons" && awaiting.nodeId === entry.node.id}
                onButtonClick={(buttonId, label) => handleButtonClick(entry.node.id, buttonId, label)}
              />
            );
          })
        )}
      </div>

      <div className="border-t border-neutral-800 px-2 py-1.5">
        <div className="flex items-center gap-1.5 rounded-full bg-neutral-800 pl-2.5 pr-1 py-1">
          <input
            value={inputValue}
            disabled={inputDisabled}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-[11px] text-neutral-200 placeholder:text-neutral-500 outline-none disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={inputDisabled || !inputValue.trim()}
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-purple-600 text-white disabled:opacity-30"
          >
            <SendHorizontal size={11} />
          </button>
        </div>
      </div>

      <div className="flex justify-center pb-1.5">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300"
        >
          <RotateCcw size={10} /> Reiniciar
        </button>
      </div>
    </>
  );
}

// ───────────────────────── Componente principal ─────────────────────────

type Tab = "visualizacao" | "teste";

export function FlowPreview({
  flow,
  selectedNodeId,
  automationName,
}: {
  flow: AutomationFlow;
  selectedNodeId: string | null;
  automationName?: string;
}) {
  const [tab, setTab] = useState<Tab>("visualizacao");

  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l bg-muted/30 p-3">
      <div className="mb-2 flex items-center justify-center gap-1 rounded-full bg-muted p-0.5">
        <button
          type="button"
          onClick={() => setTab("visualizacao")}
          className={cn(
            "flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
            tab === "visualizacao" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          Visualização
        </button>
        <button
          type="button"
          onClick={() => setTab("teste")}
          className={cn(
            "flex-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
            tab === "teste" ? "bg-background shadow-sm" : "text-muted-foreground"
          )}
        >
          Teste
        </button>
      </div>

      <div className="mx-auto flex w-[240px] flex-col overflow-hidden rounded-[26px] border-[6px] border-neutral-900 bg-neutral-950 shadow-lg" style={{ aspectRatio: "9 / 19" }}>
        <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-800 px-2.5 py-1.5">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-neutral-300">
            <User size={11} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium text-white">Contato de teste</p>
            <p className="truncate text-[10px] text-neutral-500">{automationName || "Automação"}</p>
          </div>
        </div>

        {tab === "visualizacao" ? (
          <VisualizationPanel flow={flow} selectedNodeId={selectedNodeId} />
        ) : (
          <TestPanel key={JSON.stringify(flow.nodes.map((n) => n.id))} flow={flow} />
        )}
      </div>

      <p className="mt-2 px-1 text-center text-[10px] leading-relaxed text-muted-foreground">
        {tab === "visualizacao"
          ? "Isso é só uma simulação visual — nenhuma mensagem de verdade é enviada aqui."
          : "O teste roda só aqui no navegador — não manda nada pelo Instagram/Facebook/Telegram/e-mail de verdade."}
      </p>
    </div>
  );
}
