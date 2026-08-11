"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import type { FlowNode } from "@/lib/automation-types";

const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export function NodePanel({
  node,
  onChange,
  onDelete,
  onClose,
}: {
  node: FlowNode;
  onChange: (data: Partial<FlowNode["data"]>) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="text-sm font-semibold">Configurar nó</p>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X size={15} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {node.type === "trigger" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium">Tipo de gatilho</label>
              <select
                className={selectClass + " mt-1"}
                value={node.data.triggerType}
                onChange={(e) =>
                  onChange({
                    triggerType: e.target.value as "keyword" | "welcome",
                    keywords: e.target.value === "keyword" ? node.data.keywords ?? [] : undefined,
                  })
                }
              >
                <option value="keyword">Palavra-chave</option>
                <option value="welcome">Primeira mensagem (boas-vindas)</option>
              </select>
            </div>
            {node.data.triggerType === "keyword" && (
              <div>
                <label className="text-xs font-medium">Palavras-chave (separe por vírgula)</label>
                <Textarea
                  className="mt-1"
                  value={(node.data.keywords ?? []).join(", ")}
                  onChange={(e) =>
                    onChange({ keywords: e.target.value.split(",").map((k) => k.trim()).filter(Boolean) })
                  }
                  placeholder="preço, valor, quanto custa"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Dispara se a mensagem recebida contiver qualquer uma dessas palavras.
                </p>
              </div>
            )}
          </div>
        )}

        {node.type === "sendMessage" && (
          <div>
            <label className="text-xs font-medium">Texto da mensagem</label>
            <Textarea
              className="mt-1 min-h-32"
              value={node.data.text}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="Escreva a mensagem que será enviada..."
            />
          </div>
        )}

        {node.type === "delay" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium">Quantidade</label>
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={node.data.amount}
                onChange={(e) => onChange({ amount: Number(e.target.value) || 1 })}
              />
            </div>
            <div>
              <label className="text-xs font-medium">Unidade</label>
              <select
                className={selectClass + " mt-1"}
                value={node.data.unit}
                onChange={(e) => onChange({ unit: e.target.value as "seconds" | "minutes" | "hours" | "days" })}
              >
                <option value="seconds">Segundos</option>
                <option value="minutes">Minutos</option>
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
              </select>
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Esperas de poucos segundos não são exatas: a automação retoma quando o verificador da
              Netlify rodar (a cada ~1 minuto), então pode levar até 1 minuto pra continuar.
            </p>
          </div>
        )}

        {node.type === "addTag" && (
          <div>
            <label className="text-xs font-medium">Nome da tag</label>
            <Input
              className="mt-1"
              value={node.data.tagName}
              onChange={(e) => onChange({ tagName: e.target.value })}
              placeholder="interessado"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Se a tag ainda não existir, ela é criada automaticamente.
            </p>
          </div>
        )}

        {node.type === "condition" && (
          <div>
            <label className="text-xs font-medium">O contato tem a tag...</label>
            <Input
              className="mt-1"
              value={node.data.tagName}
              onChange={(e) => onChange({ tagName: e.target.value })}
              placeholder="interessado"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Conecte a saída <b>Sim</b> e a saída <b>Não</b> pra caminhos diferentes do fluxo.
            </p>
          </div>
        )}
      </div>

      {node.type !== "trigger" && onDelete && (
        <div className="border-t p-3">
          <Button variant="outline" size="sm" className="w-full text-destructive" onClick={onDelete}>
            Excluir nó
          </Button>
        </div>
      )}
    </div>
  );
}
