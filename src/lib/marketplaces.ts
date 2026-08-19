// Constantes puras (sem importar nada de banco) — pode ser usado tanto em
// código de servidor (rotas de API) quanto em componentes de cliente (forms),
// diferente de lib/products.ts, que usa `db` e por isso não pode ser
// importado de um componente "use client".

export const MARKETPLACES = ["mercado_livre", "shopee", "amazon", "magalu", "outro"] as const;
export type Marketplace = (typeof MARKETPLACES)[number];

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  mercado_livre: "Mercado Livre",
  shopee: "Shopee",
  amazon: "Amazon",
  magalu: "Magalu",
  outro: "Outro",
};
