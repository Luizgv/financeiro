"use client";

import { useState } from "react";
import type { CategoryRow } from "@/lib/types";

type Props = {
  categories: CategoryRow[];
  disabled: boolean;
  onSubmit: (payload: {
    title: string;
    amount: number;
    type: "income" | "expense";
    categoryId: string;
    paymentMethod: "card" | "pix" | "cash" | "debit" | "transfer" | "other";
    notes?: string;
  }) => Promise<void>;
};

/**
 * Structured transaction form with category override.
 */
export function StructuredForm({ categories, disabled, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "card" | "pix" | "cash" | "debit" | "transfer" | "other"
  >("other");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expenseCats = categories.filter((c) => c.slug !== "income-fixed");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number.parseFloat(amount.replace(",", "."));
    if (!title.trim() || !categoryId || Number.isNaN(n) || n <= 0) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        amount: n,
        type,
        categoryId,
        paymentMethod,
        notes: notes.trim() || undefined,
      });
      setTitle("");
      setAmount("");
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-muted underline-offset-4 hover:text-foreground hover:underline"
      >
        Formulário detalhado
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Novo lançamento</span>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted hover:text-foreground">
          Fechar
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">
          Título
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={disabled || loading}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted">
          Valor (R$)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={disabled || loading}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>
        <label className="text-xs text-muted">
          Tipo
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "income" | "expense")}
            disabled={disabled || loading}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </label>
        <label className="text-xs text-muted">
          Categoria
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={disabled || loading}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          >
            <option value="">Selecione</option>
            {(type === "income" ? categories : expenseCats).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted sm:col-span-2">
          Pagamento
          <select
            value={paymentMethod}
            onChange={(e) =>
              setPaymentMethod(e.target.value as typeof paymentMethod)
            }
            disabled={disabled || loading}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          >
            <option value="card">Cartão</option>
            <option value="pix">Pix</option>
            <option value="cash">Dinheiro</option>
            <option value="debit">Débito</option>
            <option value="transfer">Transferência</option>
            <option value="other">Outro</option>
          </select>
        </label>
        <label className="text-xs text-muted sm:col-span-2">
          Notas
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={disabled || loading}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={disabled || loading}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
      >
        Salvar
      </button>
    </form>
  );
}
