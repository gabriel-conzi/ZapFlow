"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ClipboardList, Clock, GitBranch, MessageSquareText, Send, Tag, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMessageButtons } from "@/lib/automation-types";
import type {
  AddTagNodeData,
  CollectDataNodeData,
  ConditionNodeData,
  DelayNodeData,
  SendMessageNodeData,
  TriggerNodeData,
} from "@/lib/automation-types";

function NodeShell({
  selected,
  icon,
  iconClassName,
  title,
  children,
  showTarget = true,
}: {
  selected?: boolean;
  icon: React.ReactNode;
  iconClassName?: string;
  title: string;
  children?: React.ReactNode;
  showTarget?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-56 rounded-xl border bg-card shadow-sm",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border"
      )}
    >
      {showTarget && <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-white", iconClassName)}>
          {icon}
        </span>
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <div className="px-3 py-2.5 text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

export function TriggerNode({ data, selected }: NodeProps & { data: TriggerNodeData }) {
  return (
    <NodeShell
      selected={selected}
      icon={<Zap size={13} />}
      iconClassName="bg-amber-500"
      title="Gatilho"
      showTarget={false}
    >
      {data.triggerType === "welcome" && <p>Primeira mensagem do contato</p>}
      {data.triggerType === "keyword" && (
        <p className="truncate">
          Palavra-chave (DM): {data.keywords?.length ? data.keywords.join(", ") : <em>nenhuma definida</em>}
        </p>
      )}
      {data.triggerType === "comment" && (
        <>
          <p className="truncate">
            Comentário: {data.keywords?.length ? data.keywords.join(", ") : <em>nenhuma definida</em>}
          </p>
          <p className="mt-0.5 truncate text-[10px]">
            📌 {data.mediaLabel ? data.mediaLabel : "qualquer post"}
          </p>
        </>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </NodeShell>
  );
}

// Uma cor por botão de ramificação (até MAX_MESSAGE_BUTTONS = 3), reaproveitada
// tanto no "chip" do botão quanto na bolinha numerada colada na linha/handle
// que sai dele — assim dá pra ver de longe qual linha responde qual botão,
// sem precisar clicar/testar pra descobrir.
const REPLY_COLORS = [
  { chip: "border-fuchsia-400 text-fuchsia-600", badge: "bg-fuchsia-500", handle: "!bg-fuchsia-500" },
  { chip: "border-blue-400 text-blue-600", badge: "bg-blue-500", handle: "!bg-blue-500" },
  { chip: "border-orange-400 text-orange-600", badge: "bg-orange-500", handle: "!bg-orange-500" },
];

export function SendMessageNode({ data, selected }: NodeProps & { data: SendMessageNodeData }) {
  const buttons = getMessageButtons(data);
  const replyButtons = buttons.filter((b) => b.kind === "reply");
  const hasReply = replyButtons.length > 0;

  return (
    <NodeShell selected={selected} icon={<Send size={13} />} iconClassName="bg-primary" title="Enviar mensagem">
      <p className="line-clamp-3">{data.text || <em>mensagem vazia</em>}</p>

      {buttons.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1">
          {buttons.map((b) => {
            // só botão de "ramificar conversa" (reply) tem uma linha/handle de
            // verdade saindo dele — botão de link abre a URL e não ramifica,
            // então não ganha número/cor (não haveria linha pra combinar).
            const replyIdx = b.kind === "reply" ? replyButtons.findIndex((rb) => rb.id === b.id) : -1;
            const color = replyIdx >= 0 ? REPLY_COLORS[replyIdx % REPLY_COLORS.length] : null;
            return (
              <span
                key={b.id}
                className={cn(
                  "flex items-center gap-1.5 truncate rounded border px-1.5 py-0.5 text-[10px] font-medium",
                  color ? color.chip : "border-primary/40 text-primary"
                )}
              >
                {color ? (
                  <span
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white",
                      color.badge
                    )}
                  >
                    {replyIdx + 1}
                  </span>
                ) : (
                  <span className="shrink-0">🔗</span>
                )}
                <span className="truncate">{b.label || <em>sem texto</em>}</span>
              </span>
            );
          })}
        </div>
      )}

      {hasReply && (
        <p className="mt-1.5 text-[10px] italic text-muted-foreground">
          Pausa aqui até o contato escolher um botão — a bolinha numerada ↓ tem a mesma cor/número do botão acima
        </p>
      )}

      {hasReply ? (
        replyButtons.flatMap((b, i) => {
          const color = REPLY_COLORS[i % REPLY_COLORS.length];
          const left = ((i + 1) / (replyButtons.length + 1)) * 100;
          return [
            <span
              key={`${b.id}-badge`}
              className={cn(
                "pointer-events-none absolute z-10 flex size-3.5 -translate-x-1/2 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-card",
                color.badge
              )}
              style={{ left: `${left}%`, bottom: -2 }}
            >
              {i + 1}
            </span>,
            <Handle
              key={b.id}
              type="source"
              position={Position.Bottom}
              id={b.id}
              style={{ left: `${left}%` }}
              className={color.handle}
            />,
          ];
        })
      ) : (
        <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      )}
    </NodeShell>
  );
}

export function DelayNode({ data, selected }: NodeProps & { data: DelayNodeData }) {
  const unitLabel =
    { seconds: "segundo(s)", minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)" }[data.unit] ?? data.unit;
  return (
    <NodeShell selected={selected} icon={<Clock size={13} />} iconClassName="bg-sky-500" title="Esperar">
      <p>
        {data.amount} {unitLabel}
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500" />
    </NodeShell>
  );
}

export function AddTagNode({ data, selected }: NodeProps & { data: AddTagNodeData }) {
  return (
    <NodeShell selected={selected} icon={<Tag size={13} />} iconClassName="bg-emerald-500" title="Adicionar tag">
      <p className="truncate">{data.tagName || <em>nenhuma tag definida</em>}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-emerald-500" />
    </NodeShell>
  );
}

export function ConditionNode({ data, selected }: NodeProps & { data: ConditionNodeData }) {
  return (
    <NodeShell selected={selected} icon={<GitBranch size={13} />} iconClassName="bg-fuchsia-500" title="Condição">
      <p className="truncate">
        Contato tem a tag <b>{data.tagName || "?"}</b>?
      </p>
      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className="text-red-500">Não ↙</span>
        <span className="text-green-600">Sim ↘</span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{ left: "25%" }}
        className="!bg-red-500"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{ left: "75%" }}
        className="!bg-green-600"
      />
    </NodeShell>
  );
}

export function CollectDataNode({ data, selected }: NodeProps & { data: CollectDataNodeData }) {
  return (
    <NodeShell selected={selected} icon={<ClipboardList size={13} />} iconClassName="bg-cyan-600" title="Capturar dado">
      <p className="line-clamp-3">{data.question || <em>pergunta vazia</em>}</p>
      <p className="mt-1.5 truncate rounded border border-cyan-400 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700">
        💾 salva em: {data.fieldName || <em>sem nome</em>}
      </p>
      <p className="mt-1.5 text-[10px] italic text-muted-foreground">
        Pausa aqui até o contato responder
      </p>
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-600" />
    </NodeShell>
  );
}

export const nodeTypes = {
  trigger: TriggerNode,
  sendMessage: SendMessageNode,
  delay: DelayNode,
  addTag: AddTagNode,
  condition: ConditionNode,
  collectData: CollectDataNode,
};

export const paletteItems: Array<{
  type: "sendMessage" | "delay" | "addTag" | "condition" | "collectData";
  label: string;
  icon: React.ReactNode;
  iconClassName: string;
}> = [
  { type: "sendMessage", label: "Enviar mensagem", icon: <MessageSquareText size={14} />, iconClassName: "bg-primary" },
  { type: "collectData", label: "Capturar dado", icon: <ClipboardList size={14} />, iconClassName: "bg-cyan-600" },
  { type: "delay", label: "Esperar", icon: <Clock size={14} />, iconClassName: "bg-sky-500" },
  { type: "addTag", label: "Adicionar tag", icon: <Tag size={14} />, iconClassName: "bg-emerald-500" },
  { type: "condition", label: "Condição", icon: <GitBranch size={14} />, iconClassName: "bg-fuchsia-500" },
];
