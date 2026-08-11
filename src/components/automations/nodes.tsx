"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Clock, GitBranch, MessageSquareText, Send, Tag, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AddTagNodeData,
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
        <p className="truncate">
          Comentário: {data.keywords?.length ? data.keywords.join(", ") : <em>nenhuma definida</em>}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </NodeShell>
  );
}

export function SendMessageNode({ data, selected }: NodeProps & { data: SendMessageNodeData }) {
  return (
    <NodeShell selected={selected} icon={<Send size={13} />} iconClassName="bg-primary" title="Enviar mensagem">
      <p className="line-clamp-3">{data.text || <em>mensagem vazia</em>}</p>
      {data.buttonText && (
        <span className="mt-1.5 inline-block rounded border border-primary/40 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          🔗 {data.buttonText}
        </span>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
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

export const nodeTypes = {
  trigger: TriggerNode,
  sendMessage: SendMessageNode,
  delay: DelayNode,
  addTag: AddTagNode,
  condition: ConditionNode,
};

export const paletteItems: Array<{
  type: "sendMessage" | "delay" | "addTag" | "condition";
  label: string;
  icon: React.ReactNode;
  iconClassName: string;
}> = [
  { type: "sendMessage", label: "Enviar mensagem", icon: <MessageSquareText size={14} />, iconClassName: "bg-primary" },
  { type: "delay", label: "Esperar", icon: <Clock size={14} />, iconClassName: "bg-sky-500" },
  { type: "addTag", label: "Adicionar tag", icon: <Tag size={14} />, iconClassName: "bg-emerald-500" },
  { type: "condition", label: "Condição", icon: <GitBranch size={14} />, iconClassName: "bg-fuchsia-500" },
];
