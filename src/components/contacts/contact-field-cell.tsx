"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ContactFieldType } from "@/lib/contact-fields";

export function ContactFieldCell({
  contactId,
  fieldKey,
  fieldType,
  initialValue,
}: {
  contactId: string;
  fieldKey: string;
  fieldType: ContactFieldType;
  initialValue: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  async function save(newValue: string) {
    if (newValue === initialValue) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: fieldKey, value: newValue }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-h-[28px] min-w-[60px] rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
      >
        {value ? (
          fieldType === "boolean" ? (
            value === "true" ? "Sim" : "Não"
          ) : (
            value
          )
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </button>
    );
  }

  if (fieldType === "boolean") {
    return (
      <div className="flex items-center gap-1">
        <select
          autoFocus
          className="h-8 rounded border border-input bg-transparent px-2 text-xs outline-none"
          defaultValue={value || "false"}
          disabled={saving}
          onChange={(e) => {
            setValue(e.target.value);
            save(e.target.value);
          }}
          onBlur={() => setEditing(false)}
        >
          <option value="true">Sim</option>
          <option value="false">Não</option>
        </select>
        {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        type={fieldType === "number" ? "number" : fieldType === "date" ? "date" : "text"}
        className="h-8 w-32 rounded border border-input bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => save(value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save(value);
          }
          if (e.key === "Escape") {
            setValue(initialValue);
            setEditing(false);
          }
        }}
      />
      {saving && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
    </div>
  );
}
