"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, CheckCircle2, Loader2 } from "lucide-react";

type AiSettings = {
  enabled: boolean;
  systemPrompt: string;
  model: string;
};

export function AiSettingsCard() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings/ai")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => setError("Erro ao carregar configurações da IA"));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Erro ao salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mt-6 max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot size={17} /> Assistente de IA
        </CardTitle>
        <CardDescription>
          Quando nenhuma automação bater com a mensagem recebida (Direct do Instagram/Facebook), a IA
          responde no seu lugar usando as instruções abaixo. Requer <code>OPENAI_API_KEY</code>{" "}
          configurada no Netlify.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!settings ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Carregando...
          </p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="size-4"
              />
              Ativar respostas com IA
            </label>

            <div>
              <label className="text-xs font-medium">
                Instruções pra IA (quem é a empresa, produtos, tom de voz, o que ela pode/não pode
                responder)
              </label>
              <Textarea
                className="mt-1 min-h-40"
                value={settings.systemPrompt}
                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                placeholder={
                  'Ex: "Você atende pela conta do UsePostFlow, uma plataforma de automação de conteúdo com IA. ' +
                  "Responda dúvidas gerais sobre a ferramenta de forma simpática e breve. Não invente preços — " +
                  'se perguntarem, diga que os planos começam a partir de X e chame pra ver os planos."'
                }
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Se deixar em branco, a IA usa um comportamento padrão genérico de atendimento.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </Button>
              {saved && (
                <span className="flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 size={13} /> Salvo
                </span>
              )}
            </div>
          </>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          A IA só entra em ação nas mensagens de Direct que não batem com nenhuma automação ativa —
          suas automações por palavra-chave continuam tendo prioridade. Comentários públicos não usam
          IA por enquanto.
        </p>
      </CardContent>
    </Card>
  );
}
