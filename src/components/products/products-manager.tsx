"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Copy, Loader2, Package, Plus, Trash2 } from "lucide-react";
import { MARKETPLACES, MARKETPLACE_LABELS, type Marketplace } from "@/lib/marketplaces";

const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";

export type ProductRow = {
  id: string;
  name: string;
  price: string | null;
  imageUrl: string | null;
  marketplace: string;
  destinationUrl: string;
  slug: string;
  active: boolean;
  clicks: number;
};

const emptyForm = { name: "", marketplace: "outro" as Marketplace, price: "", destinationUrl: "", imageUrl: "" };

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copiado!" : "Copiar link"}
    </Button>
  );
}

export function ProductsManager({ initialProducts, siteOrigin }: { initialProducts: ProductRow[]; siteOrigin: string }) {
  const [products, setProducts] = useState<ProductRow[]>(initialProducts);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(products.length === 0);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao cadastrar produto");
      setProducts((prev) => [{ ...data.product, clicks: 0 }, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar produto");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(product: ProductRow) {
    const next = !product.active;
    setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, active: next } : p)));
    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    }).catch(() => {
      // reverte se der erro
      setProducts((prev) => prev.map((p) => (p.id === product.id ? { ...p, active: product.active } : p)));
    });
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover esse produto? O link curto dele para de funcionar.")) return;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/products/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      {!showForm && (
        <Button size="sm" className="w-fit" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Cadastrar produto
        </Button>
      )}

      {showForm && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Nome do produto</label>
                <Input
                  className="mt-1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Fone Bluetooth XYZ"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Marketplace</label>
                <select
                  className={selectClass + " mt-1"}
                  value={form.marketplace}
                  onChange={(e) => setForm({ ...form, marketplace: e.target.value as Marketplace })}
                >
                  {MARKETPLACES.map((m) => (
                    <option key={m} value={m}>
                      {MARKETPLACE_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium">Preço (opcional, só pra exibir)</label>
                <Input
                  className="mt-1"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="R$ 89,90"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Imagem (opcional, link público)</label>
                <Input
                  className="mt-1"
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium">Link do produto (seu link de afiliado, ou o link comum)</label>
                <Input
                  className="mt-1"
                  value={form.destinationUrl}
                  onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })}
                  placeholder="https://..."
                />
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  O ZapFlow gera um link curto próprio (ex: {siteOrigin}/r/abc123) que redireciona pra
                  esse link — é esse link curto que conta os cliques na página Vendas.
                </p>
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={saving}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Salvar produto
              </Button>
              {products.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} disabled={saving}>
                  Cancelar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Package size={28} />
            <p className="max-w-sm text-sm">
              Cadastre um produto (com seu link de afiliado do Mercado Livre, Shopee, Amazon, Magalu
              etc.) pra usar no nó &quot;Enviar produto&quot; das suas automações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-4 font-medium">Produto</th>
                  <th className="p-4 font-medium">Marketplace</th>
                  <th className="p-4 font-medium">Preço</th>
                  <th className="p-4 font-medium">Cliques</th>
                  <th className="p-4 font-medium">Link rastreável</th>
                  <th className="p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="max-w-56 p-4">
                      <div className="flex items-center gap-2">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL externa escolhida pelo usuário
                          <img src={p.imageUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
                        ) : (
                          <span className="flex size-9 shrink-0 items-center justify-center rounded bg-muted">
                            <Package size={14} className="text-muted-foreground" />
                          </span>
                        )}
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-4 text-muted-foreground">
                      {MARKETPLACE_LABELS[p.marketplace as Marketplace] ?? p.marketplace}
                    </td>
                    <td className="whitespace-nowrap p-4">{p.price || "—"}</td>
                    <td className="whitespace-nowrap p-4 font-medium">{p.clicks}</td>
                    <td className="p-4">
                      <CopyLinkButton url={`${siteOrigin}/r/${p.slug}`} />
                    </td>
                    <td className="whitespace-nowrap p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(p)}
                          className={
                            "rounded-full px-2 py-1 text-[11px] font-medium " +
                            (p.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")
                          }
                          title={p.active ? "Clique pra pausar" : "Clique pra reativar"}
                        >
                          {p.active ? "Ativo" : "Pausado"}
                        </button>
                        <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => handleDelete(p.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
