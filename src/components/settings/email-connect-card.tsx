"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2, Mail } from "lucide-react";

export function EmailConnectCard() {
  const router = useRouter();
  const [fromAddress, setFromAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function connect() {
    if (!fromAddress.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/email/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromAddress: fromAddress.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao conectar");
      setSuccess(`Conectado: ${data.fromAddress}`);
      setFromAddress("");
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
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          placeholder="contato@bot.seudominio.com"
          className="flex-1"
        />
        <Button onClick={connect} disabled={loading || !fromAddress.trim()}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
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
