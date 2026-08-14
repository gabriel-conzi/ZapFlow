"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Camera, ChevronLeft, Loader2, MessageCircle, Plus, Trash2, X } from "lucide-react";
import { MAX_MESSAGE_BUTTONS, getMessageButtons, type MessageButtonData } from "@/lib/automation-types";
import type { FlowNode, SendMessageNodeData } from "@/lib/automation-types";

const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

type Platform = "instagram" | "facebook";

type MediaItem = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
};

const platformEndpoint: Record<Platform, string> = {
  instagram: "/api/instagram/media",
  facebook: "/api/facebook/media",
};

const platformLabel: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
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
  // Fluxo em 2 passos, de propósito: primeiro escolhe a REDE (bem visível,
  // impossível de passar batido), só depois busca e mostra os posts daquela
  // rede. Evita a confusão de uma lista só com Instagram e Facebook
  // misturados, onde é fácil nem notar que tem post de outra rede mais embaixo.
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPlatform(p: Platform) {
    setPlatform(p);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(platformEndpoint[p]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar posts");
      setItems(data.media);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar posts");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPlatform(null);
    setItems(null);
    setError(null);
  }

  return (
    <div className="mt-4">
      <label className="text-xs font-medium">Post/reels específico (opcional)</label>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Deixe em branco pra valer em qualquer post, de qualquer rede. Escolha um post pra essa
        automação só disparar nele — útil quando posts diferentes usam a mesma palavra-chave com
        intenções diferentes.
      </p>

      {mediaId ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border p-2">
          <span className="truncate text-xs">{mediaLabel || mediaId}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset();
              onSelect(undefined, undefined);
            }}
          >
            Remover
          </Button>
        </div>
      ) : platform === null ? (
        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => loadPlatform("instagram")}>
            <Camera size={14} /> Instagram
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => loadPlatform("facebook")}>
            <MessageCircle size={14} /> Facebook
          </Button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={reset}>
            <ChevronLeft size={14} /> Trocar rede
          </Button>
          <span className="text-[11px] font-medium text-muted-foreground">
            Posts do {platformLabel[platform]}
          </span>
        </div>
      )}

      {loading && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Loader2 size={12} className="animate-spin" /> Buscando posts...
        </p>
      )}

      {error && <p className="mt-1 text-[11px] text-destructive">{error}</p>}

      {items && !mediaId && !loading && (
        <div className="mt-2 flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {items.length === 0 && <p className="text-[11px] text-muted-foreground">Nenhum post encontrado.</p>}
          {items.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                onSelect(m.id, `${platform === "facebook" ? "[FB] " : "[IG] "}${(m.caption ?? "Sem legenda").slice(0, 45)}`)
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ButtonsEditor({
  data,
  onChange,
}: {
  data: SendMessageNodeData;
  onChange: (data: Partial<SendMessageNodeData>) => void;
}) {
  const buttons = getMessageButtons(data);

  function update(next: MessageButtonData[]) {
    // ao editar pela lista nova, larga os campos antigos (legado) de vez —
    // daqui em diante `buttons` é a única fonte de verdade desse nó.
    onChange({ buttons: next, buttonText: undefined, buttonUrl: undefined });
  }

  function addButton() {
    if (buttons.length >= MAX_MESSAGE_BUTTONS) return;
    update([...buttons, { id: crypto.randomUUID(), kind: "reply", label: "" }]);
  }

  function updateButton(id: string, partial: Partial<MessageButtonData>) {
    update(buttons.map((b) => (b.id === id ? { ...b, ...partial } : b)));
  }

  function removeButton(id: string) {
    update(buttons.filter((b) => b.id !== id));
  }

  return (
    <div className="mt-4">
      <label className="text-xs font-medium">Botões (até {MAX_MESSAGE_BUTTONS})</label>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <b>Ramificar conversa</b>: a automação pausa depois de enviar e espera o contato apertar
        um botão — cada um leva pra um caminho diferente do fluxo (ligue a seta que sai do botão,
        embaixo do nó). <b>Abrir link</b>: botão de verdade que abre uma URL; a automação segue
        direto pela saída normal do nó, sem esperar.
      </p>

      <div className="mt-2 flex flex-col gap-2">
        {buttons.map((b) => (
          <div key={b.id} className="rounded-md border p-2">
            <div className="flex items-center gap-1.5">
              <select
                className={selectClass + " h-8 text-xs"}
                value={b.kind}
                onChange={(e) => updateButton(b.id, { kind: e.target.value as MessageButtonData["kind"] })}
              >
                <option value="reply">Ramificar conversa</option>
                <option value="link">Abrir link</option>
              </select>
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => removeButton(b.id)}>
                <Trash2 size={13} />
              </Button>
            </div>
            <Input
              className="mt-1.5 h-8 text-xs"
              value={b.label}
              onChange={(e) => updateButton(b.id, { label: e.target.value })}
              placeholder="Texto do botão (ex: Quero saber mais)"
            />
            {b.kind === "link" && (
              <Input
                className="mt-1.5 h-8 text-xs"
                value={b.url ?? ""}
                onChange={(e) => updateButton(b.id, { url: e.target.value })}
                placeholder="https://..."
              />
            )}
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="mt-2 w-full"
        onClick={addButton}
        disabled={buttons.length >= MAX_MESSAGE_BUTTONS}
      >
        <Plus size={13} /> Adicionar botão
      </Button>
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

            <ButtonsEditor data={node.data} onChange={onChange} />
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

        {node.type === "collectData" && (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium">Pergunta</label>
              <Textarea
                className="mt-1"
                value={node.data.question}
                onChange={(e) => onChange({ question: e.target.value })}
                placeholder="Qual é o seu nome?"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                A automação manda essa pergunta e pausa esperando o contato responder — a próxima
                mensagem que ele mandar é salva como resposta (funciona como o nó de botões: fica
                esperando até a pessoa responder, sem prazo).
              </p>
            </div>
            <div>
              <label className="text-xs font-medium">Salvar resposta no campo</label>
              <Input
                className="mt-1"
                value={node.data.fieldName}
                onChange={(e) => onChange({ fieldName: e.target.value })}
                placeholder="nome"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Dê um nome curto, sem espaço nem acento (ex: <code>nome</code>, <code>email</code>).
                Depois é só escrever <code>{"{{nome}}"}</code> dentro do texto de qualquer mensagem
                seguinte pra aparecer o que a pessoa respondeu.
              </p>
            </div>
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
