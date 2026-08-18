"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, X } from "lucide-react";
import { CONTACT_FIELD_TYPE_LABELS, type ContactFieldType } from "@/lib/contact-fields";

type FieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: string;
};

const selectClass =
  "flex h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export function CustomFieldsManager({ fields }: { fields: FieldDefinition[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ContactFieldType>("text");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createField() {
    if (!label.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim(), type }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não deu pra criar o campo.");
        return;
      }
      setLabel("");
      setType("text");
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteField(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/contacts/fields/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Card className="mt-4">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Campos:</span>
          {fields.length === 0 && (
            <span className="text-xs text-muted-foreground">Nenhum campo criado ainda.</span>
          )}
          {fields.map((f) => (
            <span
              key={f.id}
              className="flex items-center gap-1.5 rounded-full border bg-muted py-1 pl-2.5 pr-1 text-xs"
              title={`Use {{${f.key}}} nas mensagens das automações`}
            >
              {f.label}
              <span className="text-muted-foreground">
                ({CONTACT_FIELD_TYPE_LABELS[f.type as ContactFieldType] ?? f.type})
              </span>
              <button
                type="button"
                onClick={() => deleteField(f.id)}
                disabled={deletingId === f.id}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-foreground/70 hover:bg-destructive/15 hover:text-destructive"
                aria-label={`Remover campo ${f.label}`}
                title={`Remover o campo "${f.label}"`}
              >
                {deletingId === f.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              </button>
            </span>
          ))}

          {!open && (
            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => setOpen(true)}>
              <Plus size={12} /> Novo campo
            </Button>
          )}
        </div>

        {open && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
            <div className="min-w-[180px] flex-1">
              <label className="text-xs font-medium">Nome do campo</label>
              <Input
                className="mt-1 h-8 text-xs"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Cidade, Plano, Data de nascimento"
                autoFocus
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium">Tipo</label>
              <select
                className={selectClass + " mt-1"}
                value={type}
                onChange={(e) => setType(e.target.value as ContactFieldType)}
              >
                {Object.entries(CONTACT_FIELD_TYPE_LABELS).map(([value, l]) => (
                  <option key={value} value={value}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" className="h-8 text-xs" onClick={createField} disabled={loading || !label.trim()}>
              {loading && <Loader2 size={12} className="mr-1 animate-spin" />}
              Salvar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        )}
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
