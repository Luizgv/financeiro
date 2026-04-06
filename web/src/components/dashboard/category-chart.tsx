"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBrl } from "@/lib/format";

type BreakdownItem = { label: string; total: number; pctOfCategory: number };

export type CategoryChartRow = {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  breakdown?: BreakdownItem[];
};

type SortMode = "total-desc" | "total-asc" | "name-asc";

type Props = { rows: CategoryChartRow[] };

/** Same track color for every bar (list + breakdown); theme-aware via `--border`. */
const progressTrackClass =
  "overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--border)_65%,var(--background))]";

/**
 * Expense bars with detail panel updated only on click (or Enter/Space); hover does not change the panel.
 */
export function CategoryChart({ rows }: Props) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>("total-desc");

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    if (sortBy === "total-desc") copy.sort((a, b) => b.total - a.total);
    else if (sortBy === "total-asc") copy.sort((a, b) => a.total - b.total);
    else copy.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    return copy;
  }, [rows, sortBy]);

  const maxBar = Math.max(...rows.map((r) => r.total), 1);
  const sumExpenses = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows]);

  const defaultId = useMemo(() => {
    if (rows.length === 0) return null;
    return rows.reduce((a, b) => (a.total >= b.total ? a : b)).categoryId;
  }, [rows]);

  useEffect(() => {
    setSelectedCategoryId((prev) => {
      if (!prev) return null;
      return rows.some((r) => r.categoryId === prev) ? prev : null;
    });
  }, [rows]);

  const activeId =
    selectedCategoryId && rows.some((r) => r.categoryId === selectedCategoryId)
      ? selectedCategoryId
      : defaultId;
  const active = rows.find((r) => r.categoryId === activeId) ?? null;
  const breakdown = useMemo(() => {
    const b = active?.breakdown ?? [];
    return [...b].sort((a, b) => b.total - a.total);
  }, [active]);
  const pctOfMonth =
    active && sumExpenses > 0 ? Math.round((active.total / sumExpenses) * 1000) / 10 : 0;

  function selectCategory(id: string) {
    setSelectedCategoryId(id);
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted">
        Sem despesas categorizadas neste mês.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium text-muted">Despesas por categoria</h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="shrink-0">Ordenar</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="rounded-lg border border-border bg-input px-2 py-1.5 text-sm text-foreground focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50"
            aria-label="Ordenar categorias por gasto"
          >
            <option value="total-desc">Maior gasto primeiro</option>
            <option value="total-asc">Menor gasto primeiro</option>
            <option value="name-asc">Nome (A–Z)</option>
          </select>
        </label>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
      <div className="space-y-3">
        {sortedRows.map((r) => {
          const pctBar = Math.min(100, Math.round((r.total / maxBar) * 100));
          const isActive = r.categoryId === activeId;
          const activeRing = isActive ? `0 0 0 1px color-mix(in srgb, ${r.color} 35%, transparent)` : undefined;
          return (
            <div
              key={r.categoryId}
              className="group cursor-pointer rounded-lg px-1 py-0.5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)]"
              onClick={() => selectCategory(r.categoryId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  selectCategory(r.categoryId);
                }
              }}
              tabIndex={0}
              role="button"
              aria-pressed={isActive}
              aria-label={`${r.name}, ${formatBrl(r.total)}. Clique para ver o detalhe fixo à direita.`}
            >
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className={isActive ? "font-medium text-foreground" : "text-foreground"}>{r.name}</span>
                <span className="shrink-0 tabular-nums text-muted">{formatBrl(r.total)}</span>
              </div>
              <div
                className={`h-2.5 ${progressTrackClass} transition-[height] duration-300 group-hover:h-3`}
                style={{ boxShadow: activeRing }}
              >
                <div
                  className="h-full min-h-0 max-w-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-safe:group-hover:brightness-110"
                  style={{
                    width: `${pctBar}%`,
                    backgroundColor: r.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <aside className="rounded-xl border border-border bg-card/60 p-4 shadow-sm dark:bg-card/40 dark:shadow-card-dark">
        {active ? (
          <>
            <div className="border-b border-border/70 pb-3">
              <h3 className="text-sm font-semibold text-foreground">{active.name}</h3>
              <p className="mt-1 text-xs text-muted">
                {formatBrl(active.total)} no mês
                {sumExpenses > 0 && (
                  <span className="tabular-nums"> · {pctOfMonth}% das despesas totais</span>
                )}
              </p>
            </div>
            {breakdown.length === 0 ? (
              <p className="mt-4 text-xs text-muted">Nenhum detalhe disponível.</p>
            ) : (
              <ul className="mt-4 max-h-[min(320px,50vh)] space-y-3 overflow-y-auto pr-1">
                {breakdown.map((item) => (
                  <li key={`${active.categoryId}-${item.label}`}>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-foreground" title={item.label}>
                        {item.label}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted">
                        <span className="font-medium text-foreground">{item.pctOfCategory}%</span>
                        {" · "}
                        {formatBrl(item.total)}
                      </span>
                    </div>
                    <div className={`h-1.5 ${progressTrackClass}`}>
                      <div
                        className="h-full min-h-0 max-w-full transition-[width] duration-500 ease-out"
                        style={{
                          width: `${Math.min(100, item.pctOfCategory)}%`,
                          backgroundColor: active.color,
                          opacity: 0.85,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </aside>
      </div>
    </div>
  );
}
