"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Inbox as InboxIcon, Loader2, Send } from "lucide-react";

type ConversationPreview = {
  id: string;
  channel: string;
  status: string;
  unreadCount: number;
  updatedAt: string;
  contact: {
    id: string;
    name: string | null;
    username: string | null;
    profilePicUrl: string | null;
  };
  lastMessage: { text: string | null; direction: string; createdAt: string } | null;
};

type Message = {
  id: string;
  direction: "inbound" | "outbound";
  sender: string;
  text: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

const LIST_POLL_MS = 10000;
const THREAD_POLL_MS = 4000;

function contactLabel(contact: ConversationPreview["contact"]) {
  return contact.name || contact.username || "Contato sem nome";
}

function initials(label: string) {
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function InboxClient() {
  const [conversations, setConversations] = useState<ConversationPreview[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/instagram/conversations", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations);
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    const res = await fetch(`/api/instagram/conversations/${conversationId}/messages`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages);
  }, []);

  // lista de conversas: carrega e atualiza sozinha (busca em sistema externo
  // via polling — não dá pra "derivar durante o render" aqui).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations();
    const interval = setInterval(loadConversations, LIST_POLL_MS);
    return () => clearInterval(interval);
  }, [loadConversations]);

  // conversa selecionada: carrega thread e atualiza sozinha
  useEffect(() => {
    if (!selectedId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(null);
      return;
    }
    loadMessages(selectedId);
    const interval = setInterval(() => loadMessages(selectedId), THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || !selectedId || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/instagram/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar mensagem");

      setDraft("");
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  }

  const selected = conversations?.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* coluna esquerda: lista de conversas */}
      <div className="flex w-80 shrink-0 flex-col overflow-y-auto border-r">
        {conversations === null ? (
          <div className="flex flex-1 items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-1 flex-col items-center gap-3 px-6 py-16 text-center text-muted-foreground">
            <InboxIcon size={26} />
            <p className="text-sm">
              Nenhuma conversa ainda. Assim que alguém mandar uma mensagem no Direct, ela aparece
              aqui.
            </p>
          </div>
        ) : (
          conversations.map((c) => {
            const label = contactLabel(c.contact);
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={cn(
                  "flex items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-accent",
                  isSelected && "bg-accent"
                )}
              >
                <Avatar>
                  {c.contact.profilePicUrl && <AvatarImage src={c.contact.profilePicUrl} alt={label} />}
                  <AvatarFallback>{initials(label)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{label}</p>
                      {c.channel === "comment" && (
                        <span
                          className="shrink-0 rounded bg-fuchsia-100 px-1 py-px text-[9px] font-medium text-fuchsia-700"
                          title="Veio de um comentário"
                        >
                          comentário
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.lastMessage ? formatTime(c.lastMessage.createdAt) : formatTime(c.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessage?.direction === "outbound" ? "Você: " : ""}
                      {c.lastMessage?.text ?? "Sem texto"}
                    </p>
                    {c.unreadCount > 0 && (
                      <Badge className="shrink-0 px-1.5">{c.unreadCount}</Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* coluna direita: thread da conversa selecionada */}
      <div className="flex flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <InboxIcon size={28} />
            <p className="max-w-sm text-sm">Selecione uma conversa à esquerda pra ver as mensagens.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 border-b px-5 py-3">
              <Avatar>
                {selected.contact.profilePicUrl && (
                  <AvatarImage src={selected.contact.profilePicUrl} alt={contactLabel(selected.contact)} />
                )}
                <AvatarFallback>{initials(contactLabel(selected.contact))}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{contactLabel(selected.contact)}</p>
                {selected.contact.username && (
                  <p className="truncate text-xs text-muted-foreground">@{selected.contact.username}</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {messages === null ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="animate-spin" size={20} />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn("flex", m.direction === "outbound" ? "justify-end" : "justify-start")}
                    >
                      <div
                        className={cn(
                          "max-w-[70%] rounded-2xl px-3.5 py-2 text-sm",
                          m.direction === "outbound"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                        {m.mediaUrl && (
                          <a
                            href={m.mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block underline underline-offset-2"
                          >
                            Ver anexo
                          </a>
                        )}
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            m.direction === "outbound" ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {formatTime(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="border-t p-3">
              {sendError && <p className="mb-2 text-xs text-destructive">{sendError}</p>}
              <div className="flex items-end gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Escreva uma resposta..."
                  className="min-h-11 flex-1 resize-none"
                  disabled={sending}
                />
                <Button size="icon" onClick={handleSend} disabled={sending || !draft.trim()}>
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </Button>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                O Instagram só deixa responder até 24h depois da última mensagem do contato.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
