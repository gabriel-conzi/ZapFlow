"use client";

// Modal que abre ao clicar em "Nova automação" — mostra os modelos prontos
// (ver lib/automation-templates.ts) lado a lado com a opção de começar do
// zero, parecido com a galeria de modelos do Manychat.

import { Loader2, MessageSquareText, Plus, Sparkles, Split, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTOMATION_TEMPLATES, type AutomationTemplate } from "@/lib/automation-templates";

const TRIGGER_TYPE_LABEL: Record<AutomationTemplate["triggerType"], string> = {
  keyword: "Palavra-chave no Direct",
  comment: "Comentário em post/reels",
  welcome: "Primeira mensagem",
};

// Um ícone por modelo, só pra dar uma cara diferente pra cada card — não
// precisa bater 1 a 1 com os tipos de nó do fluxo.
const TEMPLATE_ICON: Record<string, React.ReactNode> = {
  "auto-reply-dm": <MessageSquareText size={15} />,
  "comment-to-link": <Sparkles size={15} />,
  "faq-keyword": <MessageSquareText size={15} />,
  "capture-name-before-offer": <Tag size={15} />,
  "menu-with-buttons": <Split size={15} />,
};

export function TemplateGallery({
  open,
  onClose,
  onStartBlank,
  onPickTemplate,
  pendingId,
}: {
  open: boolean;
  onClose: () => void;
  onStartBlank: () => void;
  onPickTemplate: (template: AutomationTemplate) => void;
  pendingId: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12 sm:p-6 sm:pt-16">
      <div className="w-full max-w-3xl rounded-xl border bg-background shadow-lg">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="text-base font-semibold">Modelos</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Comece com um modelo pronto e ajuste o texto pro seu negócio, ou monte do zero.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <button
            type="button"
            onClick={onStartBlank}
            disabled={pendingId !== null}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-3 text-sm font-medium hover:bg-accent disabled:opacity-60"
          >
            {pendingId === "blank" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Começar do zero
          </button>

          <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Modelos prontos
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {AUTOMATION_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onPickTemplate(template)}
                disabled={pendingId !== null}
                className="flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left hover:border-primary hover:bg-accent disabled:opacity-60"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                    {TEMPLATE_ICON[template.id] ?? <Sparkles size={15} />}
                  </span>
                  {pendingId === template.id && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </div>
                <p className="text-sm font-medium leading-snug">{template.name}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{template.description}</p>
                <span className="mt-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Gatilho: {TRIGGER_TYPE_LABEL[template.triggerType]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
