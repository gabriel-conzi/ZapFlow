"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3, Copy, Loader2, Plus, Trash2, Workflow } from "lucide-react";
import type { AutomationFlow } from "@/lib/automation-types";
import { TemplateGallery } from "@/components/automations/template-gallery";
import type { AutomationTemplate } from "@/lib/automation-templates";

type AutomationRow = {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  flow: unknown;
  updatedAt: string;
};

const statusLabel: Record<string, { label: string; variant: "success" | "secondary" | "outline" }> = {
  active: { label: "Ativa", variant: "success" },
  paused: { label: "Pausada", variant: "secondary" },
  draft: { label: "Rascunho", variant: "outline" },
};

function triggerSummary(flow: unknown) {
  const f = flow as AutomationFlow;
  const trigger = f?.nodes?.find((n) => n.type === "trigger");
  if (!trigger || trigger.type !== "trigger") return "Sem gatilho configurado";
  if (trigger.data.triggerType === "welcome") return "Gatilho: primeira mensagem";
  const keywords = trigger.data.keywords ?? [];
  const prefix = trigger.data.triggerType === "comment" ? "Gatilho: comentário" : "Gatilho: Direct";
  return keywords.length ? `${prefix} "${keywords.join(", ")}"` : `${prefix} (nenhuma palavra definida)`;
}

export function AutomationsList({ initial }: { initial: AutomationRow[] }) {
  const router = useRouter();
  const [automations, setAutomations] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // id do modelo sendo criado agora (ou "blank" pro botão "Começar do
  // zero") — usado só pra desabilitar os botões da galeria enquanto salva.
  const [pendingTemplateId, setPendingTemplateId] = useState<string | null>(null);

  async function createAutomation(body: { name: string; triggerType?: string; flow?: AutomationFlow }) {
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Erro ao criar automação");
    router.push(`/automations/${data.automation.id}`);
  }

  async function handleCreateBlank() {
    setPendingTemplateId("blank");
    try {
      await createAutomation({ name: "Nova automação" });
    } catch {
      setPendingTemplateId(null);
    }
  }

  async function handleCreateFromTemplate(template: AutomationTemplate) {
    setPendingTemplateId(template.id);
    try {
      await createAutomation({ name: template.name, triggerType: template.triggerType, flow: template.flow });
    } catch {
      setPendingTemplateId(null);
    }
  }

  async function handleDuplicate(automation: AutomationRow) {
    setDuplicatingId(automation.id);
    try {
      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${automation.name} (cópia)`,
          triggerType: automation.triggerType,
          flow: automation.flow,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao duplicar automação");
      router.push(`/automations/${data.automation.id}`);
    } catch {
      setDuplicatingId(null);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await fetch(`/api/automations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`/api/automations/${id}`, { method: "DELETE" });
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="flex justify-end">
        <Button onClick={() => setGalleryOpen(true)} disabled={pendingTemplateId !== null}>
          {pendingTemplateId ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Nova automação
        </Button>
      </div>

      <TemplateGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onStartBlank={handleCreateBlank}
        onPickTemplate={handleCreateFromTemplate}
        pendingId={pendingTemplateId}
      />

      {automations.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Workflow size={28} />
            <p className="max-w-sm text-sm">
              Nenhuma automação ainda. Crie uma pra responder automaticamente por palavra-chave ou
              na primeira mensagem de um contato.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 flex flex-col gap-2">
          {automations.map((automation) => {
            const status = statusLabel[automation.status] ?? statusLabel.draft;
            return (
              <Card key={automation.id}>
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <Link href={`/automations/${automation.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium hover:underline">{automation.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{triggerSummary(automation.flow)}</p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={automation.status}
                      onChange={(e) => handleStatusChange(automation.id, e.target.value)}
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                    >
                      <option value="draft">Rascunho</option>
                      <option value="active">Ativa</option>
                      <option value="paused">Pausada</option>
                    </select>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Link href={`/automations/${automation.id}/stats`}>
                      <Button variant="ghost" size="icon" title="Ver estatísticas">
                        <BarChart3 size={14} />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Duplicar automação"
                      onClick={() => handleDuplicate(automation)}
                      disabled={duplicatingId === automation.id}
                    >
                      {duplicatingId === automation.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(automation.id)}
                      disabled={deletingId === automation.id}
                    >
                      {deletingId === automation.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
