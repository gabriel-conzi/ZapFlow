export const CONTACT_FIELD_TYPES = ["text", "number", "date", "boolean"] as const;
export type ContactFieldType = (typeof CONTACT_FIELD_TYPES)[number];

export const CONTACT_FIELD_TYPE_LABELS: Record<ContactFieldType, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  boolean: "Sim / Não",
};

/**
 * Transforma o nome digitado pelo Gabriel (ex: "Cidade do cliente") na chave
 * técnica usada dentro de `contacts.customFields` e em `{{chave}}` nas
 * mensagens das automações (ex: "cidade_do_cliente") — minúscula, sem
 * acento, sem espaço.
 */
export function slugifyFieldKey(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}
