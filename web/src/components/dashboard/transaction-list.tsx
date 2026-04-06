"use client";

import { useMemo, useState } from "react";
import { formatBrl } from "@/lib/format";
import type { CategoryRow, TransactionRow } from "@/lib/types";

const pm: Record<string, string> = {
  card: "Cartão",
  pix: "Pix",
  cash: "Dinheiro",
  debit: "Débito",
  transfer: "Transferência",
  other: "—",
};

const srcLabel: Record<string, string> = {
  manual: "Manual",
  invoice: "Fatura",
  bank_statement: "Extrato",
  recurring_income: "Salário fixo",
};

type Props = {
  rows: TransactionRow[];
  categories: CategoryRow[];
  readOnly: boolean;
  onDelete?: (id: string) => Promise<void>;
};

/**
 * Ledger list with category colors, search, and optional delete for open months.
 */
export function TransactionList({ rows, categories, readOnly, onDelete }: Props) {
  const [query, setQuery] = useState("");

  const categoryById = useMemo(() => {
    const m = new Map<string, CategoryRow>();
    for (const c of categories) m.set(c._id, c);
    return m;
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, " ");
    if (!q) return rows;
    return rows.filter((t) => {
      const cat = categoryById.get(t.categoryId);
      const catName = cat?.name?.toLowerCase() ?? "";
      const amountStr = String(t.amount);
      const brl = formatBrl(t.amount).toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.notes?.toLowerCase().includes(q) ?? false) ||
        catName.includes(q) ||
        amountStr.includes(q) ||
        brl.includes(q)
      );
    });
  }, [rows, query, categoryById]);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-card/40 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Nada neste mês ainda</p>
        <p className="mt-1 text-xs text-muted">
          Use a entrada rápida, o formulário ou importe um extrato. O saldo atualiza automaticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por título, categoria, valor…"
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted transition focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50"
        aria-label="Buscar lançamentos"
      />
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-6 text-center text-sm text-muted">
          Nenhum lançamento corresponde à busca.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((t) => {
            const cat = categoryById.get(t.categoryId);
            const accent = cat?.color ?? "#64748b";
            return (
              <li
                key={t._id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                style={{ borderLeftWidth: 4, borderLeftStyle: "solid", borderLeftColor: accent }}
              >
                <div className="min-w-0 flex-1 pl-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{t.title}</span>
                    {cat && (
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground/90"
                        style={{
                          backgroundColor: `color-mix(in srgb, ${accent} 22%, transparent)`,
                          color: "var(--foreground)",
                        }}
                      >
                        {cat.name}
                      </span>
                    )}
                    {t.source && (
                      <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {srcLabel[t.source] ?? t.source}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {new Date(t.date).toLocaleDateString("pt-BR")} · {pm[t.paymentMethod] ?? t.paymentMethod}
                    {t.parsedFromText ? " · texto" : ""}
                    {typeof t.extractedConfidence === "number"
                      ? ` · conf. ${Math.round(t.extractedConfidence * 100)}%`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      t.type === "income"
                        ? "font-medium tabular-nums text-emerald-600 dark:text-emerald-400"
                        : "font-medium tabular-nums text-foreground"
                    }
                  >
                    {t.type === "income" ? "+" : "−"}
                    {formatBrl(t.amount)}
                  </span>
                  {!readOnly && onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(t._id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Excluir
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {query.trim() && (
        <p className="text-center text-[11px] text-muted">
          Mostrando {filtered.length} de {rows.length} lançamento(s)
        </p>
      )}
    </div>
  );
}
