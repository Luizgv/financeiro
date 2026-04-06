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

function signedTotal(ts: TransactionRow[]): number {
  return ts.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
}

/**
 * Ledger list with category colors, search, category filter, and optional grouping by category.
 */
export function TransactionList({ rows, categories, readOnly, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [groupByCategory, setGroupByCategory] = useState(false);

  const categoryById = useMemo(() => {
    const m = new Map<string, CategoryRow>();
    for (const c of categories) m.set(c._id, c);
    return m;
  }, [categories]);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of rows) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    return categories
      .filter((c) => (counts.get(c._id) ?? 0) > 0)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((c) => ({ category: c, count: counts.get(c._id)! }));
  }, [rows, categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, " ");
    return rows.filter((t) => {
      if (categoryFilter && t.categoryId !== categoryFilter) return false;
      if (!q) return true;
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
  }, [rows, query, categoryFilter, categoryById]);

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const m = new Map<string, TransactionRow[]>();
    for (const t of filtered) {
      const list = m.get(t.categoryId) ?? [];
      list.push(t);
      m.set(t.categoryId, list);
    }
    return [...m.entries()]
      .map(([categoryId, list]) => {
        const cat = categoryById.get(categoryId);
        const name = cat?.name ?? "Sem categoria";
        return {
          categoryId,
          name,
          color: cat?.color ?? "#64748b",
          rows: list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [filtered, groupByCategory, categoryById]);

  function renderRow(t: TransactionRow) {
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
  }

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
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por título, categoria, valor…"
          className="min-h-[42px] w-full flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted transition focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50 sm:min-w-[12rem]"
          aria-label="Buscar lançamentos"
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[min(100%,14rem)]">
          <label htmlFor="tx-category-filter" className="text-[11px] font-medium text-muted">
            Categoria
          </label>
          <select
            id="tx-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="min-h-[42px] w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50"
          >
            <option value="">Todas as categorias</option>
            {categoryOptions.map(({ category, count }) => (
              <option key={category._id} value={category._id}>
                {category.name} ({count})
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-card/50 px-3 py-2 text-xs text-foreground sm:shrink-0 dark:bg-card/30">
          <input
            type="checkbox"
            checked={groupByCategory}
            onChange={(e) => setGroupByCategory(e.target.checked)}
            className="size-4 rounded border-border text-accent focus:ring-[color:var(--focus-ring)]"
          />
          <span className="leading-tight">Agrupar por categoria</span>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-6 text-center text-sm text-muted">
          Nenhum lançamento corresponde à busca ou ao filtro.
        </p>
      ) : groupByCategory && grouped ? (
        <div className="space-y-4">
          {grouped.map((g) => {
            const sub = signedTotal(g.rows);
            return (
              <section
                key={g.categoryId}
                className="overflow-hidden rounded-xl border border-border bg-card"
                aria-labelledby={`tx-group-${g.categoryId}`}
              >
                <div
                  id={`tx-group-${g.categoryId}`}
                  className="sticky top-0 z-[1] flex flex-wrap items-baseline justify-between gap-2 border-b border-border/80 bg-card px-4 py-2.5 text-sm dark:bg-card"
                >
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    <span
                      className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15"
                      style={{ backgroundColor: g.color }}
                      aria-hidden
                    />
                    {g.name}
                  </span>
                  <span className="tabular-nums text-xs text-muted">
                    {g.rows.length} {g.rows.length === 1 ? "lançamento" : "lançamentos"}
                    <span className="mx-1.5 text-border">·</span>
                    <span
                      className={
                        sub >= 0
                          ? "font-medium text-emerald-600 dark:text-emerald-400"
                          : "font-medium text-foreground"
                      }
                    >
                      {sub >= 0 ? "+" : "−"}
                      {formatBrl(Math.abs(sub))}
                    </span>
                  </span>
                </div>
                <ul className="divide-y divide-border">{g.rows.map((t) => renderRow(t))}</ul>
              </section>
            );
          })}
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {filtered.map((t) => renderRow(t))}
        </ul>
      )}

      {(query.trim() || categoryFilter) && (
        <p className="text-center text-[11px] text-muted">
          Mostrando {filtered.length} de {rows.length} lançamento(s)
        </p>
      )}
    </div>
  );
}
