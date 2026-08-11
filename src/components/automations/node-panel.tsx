"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, X } from "lucide-react";
import type { FlowNode } from "@/lib/automation-types";

const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

type MediaItem = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  platform: "instagram" | "facebook";
};

function MediaPicker({
  mediaId,
  mediaLabel,
  onSelect,
}: {
  mediaId?: string;
  mediaLabel?: string;
  onSelect: (mediaId?: string, mediaLabel?: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca posts do Instagram e do Facebook em paralelo e junta numa lista só
  // (cada item com um selo indicando a plataforma). Se uma das duas contas
  // não estiver conectada, só ignora o erro dela e mostra a outra.
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [igRes, fbRes] = await Promise.all([
        fetch("/api/instagram/media").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
        fetch("/api/facebook/media").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      ]);

      const igItems: MediaItem[] = igRes.ok
        ? (igRes.d.media as Omit<MediaItem, "platform">[]).map((m) => ({ ...m, platform: "instagram" as const }))
        : [];
      const fbItems: MediaItem[] = fbRes.ok
        ? (fbRes.d.media as Omit<MediaItem, "platform">[]).map((m) => ({ ...m, platform: "facebook" as const }))
        : [];

      if (!igRes.ok && !fbRes.ok) {
        throw new Error(igRes.d.error ?? fbRes.d.error ?? "Erro ao buscar posts");
      }

      setItems([...igItems, ...fbItems]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar posts");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <label className="text-xs font-medium">Post/reels específico (opcional)</label>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Deixe em branco pra valer em qualquer post. Escolha um post pra essa automação só disparar
        nele — útil quando posts diferentes usam a mesma palavra-chave com intenções diferentes.
      </p>

      {mediaId ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border p-2">
          <span className="truncate text-xs">{mediaLabel || mediaId}</span>
          <Button variant="ghost" size="sm" onClick={() => onSelect(undefined, undefined)}>
            Remover
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mt-2" onClick={load} disabled={loading}>
          {loading && <Loader2 size={13} className="animate-spin" />}
          Escolher post
        </Button>
      )}

      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}

      {items && !mediaId && (
        <div className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {items.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum post encontrado.</p>}
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                onSelect(m.id, `${m.platform === "facebook" ? "[FB] " : "[IG] "}${(m.caption ?? "Sem legenda").slice(0, 45)}`)
              }
              className="flex items-center gap-2 rounded-md border p-1.5 text-left hover:bg-accent"
            >
              {m.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- miniatura vinda direto da API do Instagram/Facebook
                <img src={m.thumbnailUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
              ) : (
                <span className="size-9 shrink-0 rounded bg-muted" />
              )}
              <span className="flex-1 line-clamp-2 text-[11px]">{m.caption || "Sem legenda"}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                {m.platform === "facebook" ? "FB" : "IG"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
                    triggerType: e.target.value as "keyword" | "welcome" | "comment",
                    keywords: e.target.value !== "welcome" ? node.data.keywords ?? [] : undefined,
                  })
                }
              >
                <option value="keyword">Palavra-chave (Direct)</option>
                <option value="comment">Comentário em post/reels</option>
                <option value="welcome">Primeira mensagem (boas-vindas)</option>
              </select>
            </div>
            {(node.data.triggerType === "keyword" || node.data.triggerType === "comment") && (
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
                  {node.data.triggerType === "comment"
                    ? "Dispara se um comentário público em qualquer post/reels contiver uma dessas palavras. A resposta vai como mensagem privada pro autor do comentário."
                    : "Dispara se a mensagem de Direct recebida contiver qualquer uma dessas palavras."}
                </p>
              </div>
            )}
            {node.data.triggerType === "comment" && (
              <>
                <MediaPicker
                  mediaId={node.data.mediaId}
                  mediaLabel={node.data.mediaLabel}
                  onSelect={(mediaId, mediaLabel) => onChange({ mediaId, mediaLabel })}
                />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  A Meta só permite <b>1 resposta privada por comentário</b>, e só dentro de 7 dias.
                  Se o fluxo tiver mais de um passo de &quot;Enviar mensagem&quot;, só o primeiro vai
                  funcionar (a menos que o contato responda antes).
                </p>
              </>
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

            <div className="mt-4">
              <label className="text-xs font-medium">Botão (opcional)</label>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Em vez de colar um link no texto, manda um botão de verdade abaixo da mensagem.
              </p>
              <Input
                className="mt-2"
                value={node.data.buttonText ?? ""}
                onChange={(e) => onChange({ buttonText: e.target.value || undefined })}
                placeholder="Texto do botão (ex: Ver planos)"
              />
              <Input
                className="mt-2"
                value={node.data.buttonUrl ?? ""}
                onChange={(e) => onChange({ buttonUrl: e.target.value || undefined })}
                placeholder="https://..."
              />
            </div>
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
