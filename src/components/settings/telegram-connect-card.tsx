"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export function TelegramConnectCard() {
  const router = useRouter();
  const [botToken, setBotToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function connect() {
    if (!botToken.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/telegram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken: botToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao conectar");
      setSuccess(`Conectado: @${data.botUsername}`);
      setBotToken("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao conectar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="Cole aqui o token do @BotFather (ex: 123456:ABC-...)"
          className="flex-1"
        />
        <Button onClick={connect} disabled={loading || !botToken.trim()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Conectar
        </Button>
      </div>
      {success && (
        <p className="flex items-center gap-1 text-xs text-green-700">
          <CheckCircle2 size={13} /> {success}
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
