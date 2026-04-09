"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiJson, formatApiErrorMessage } from "@/lib/api";
import { formatBrl } from "@/lib/format";
import type { MonthSummaryResponse } from "@/lib/types";
import { MonthSummaryExpenseChart } from "./month-summary-expense-chart";

type Props = {
  householdId: string;
  snapshotId: string;
};

/**
 * Monthly summary: on-demand API, optional collapse, donut chart by category.
 */
export function MonthSummarySection({ householdId, snapshotId }: Props) {
  const [open, setOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);

  useEffect(() => {
    setDetailsExpanded(true);
  }, [snapshotId, householdId]);

  const summary = useQuery({
    queryKey: ["month-summary", householdId, snapshotId],
    queryFn: () =>
      apiJson<MonthSummaryResponse>(
        `/api/households/${householdId}/snapshots/${snapshotId}/month-summary`
      ),
    enabled: open,
    staleTime: 1000 * 60 * 2,
  });

  const safeMainCategories = (summary.data?.mainCategories ?? []).map((c) => ({
    ...c,
    color: c.color ?? "#64748b",
  }));

  const chartSlices =
    summary.data?.expenseChart ??
    safeMainCategories.map((c) => ({
      name: c.name,
      total: c.total,
      percentOfExpenses: c.percentOfExpenses,
      color: c.color,
    }));

  return (
    <section className="rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-accent/[0.04] p-5 shadow-sm dark:to-accent/[0.06]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Resumo do mês</h2>
          <p className="mt-0.5 text-xs text-muted">
            Texto, destaques e gráfico de despesas por categoria — só leitura, não altera lançamentos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {open && summary.isSuccess && (
            <button
              type="button"
              onClick={() => setDetailsExpanded((v) => !v)}
              className="rounded-xl border border-border bg-card/80 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:border-border hover:bg-elevated dark:bg-card/50"
            >
              {detailsExpanded ? "Recolher resumo" : "Expandir resumo"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!open) setOpen(true);
              else void summary.refetch();
            }}
            disabled={summary.isFetching}
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:bg-accent-hover hover:shadow-accent-glow disabled:opacity-50"
          >
            {summary.isFetching
              ? "Gerando…"
              : open && summary.isSuccess
                ? "Atualizar resumo"
                : "Gerar resumo do mês"}
          </button>
        </div>
      </div>

      {open && summary.isError && (
        <p className="mt-4 text-sm text-red-500">
          {formatApiErrorMessage(summary.error, "Não foi possível gerar o resumo.")}
        </p>
      )}

      {open && summary.isSuccess && summary.data && detailsExpanded && (
        <div className="mt-5 space-y-6 border-t border-border/60 pt-5">
          <blockquote className="rounded-xl border border-border/70 bg-background/60 px-4 py-3 text-sm leading-relaxed text-foreground dark:bg-background/40">
            {summary.data.narrative}
          </blockquote>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-card/80 px-3 py-3 dark:bg-card/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Entradas</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatBrl(summary.data.totals.totalIncome)}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/80 px-3 py-3 dark:bg-card/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Saídas</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {formatBrl(summary.data.totals.totalExpenses)}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/80 px-3 py-3 dark:bg-card/50">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Saldo</p>
              <p
                className={
                  summary.data.totals.balance >= 0
                    ? "mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400"
                    : "mt-1 text-lg font-bold tabular-nums text-foreground"
                }
              >
                {formatBrl(summary.data.totals.balance)}
              </p>
            </div>
          </div>

          {(summary.data.highestCategory || summary.data.highestExpense) && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-3 text-sm dark:bg-amber-500/[0.08]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
                Destaques
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-foreground/95">
                {summary.data.highestCategory && summary.data.totals.totalExpenses > 0 && (
                  <li>
                    Maior gasto por categoria: <strong>{summary.data.highestCategory.name}</strong> (
                    {formatBrl(summary.data.highestCategory.total)})
                  </li>
                )}
                {summary.data.highestExpense && (
                  <li>
                    Maior despesa avulsa: <strong>{summary.data.highestExpense.title}</strong> —{" "}
                    {formatBrl(summary.data.highestExpense.amount)} ({summary.data.highestExpense.categoryName})
                  </li>
                )}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Em pontos</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              {summary.data.highlights.map((h) => (
                <li key={h} className="flex gap-2">
                  <span className="text-accent" aria-hidden>
                    ·
                  </span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/40 p-4 dark:bg-card/25">
            <MonthSummaryExpenseChart slices={chartSlices} />
          </div>

          {safeMainCategories.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Principais categorias (top 5)
              </h3>
              <ul className="mt-2 space-y-2">
                {safeMainCategories.map((c, i) => (
                  <li
                    key={`${c.name}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/50 px-3 py-2 text-sm dark:bg-card/30"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                      <span
                        className="size-2.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/10"
                        style={{ backgroundColor: c.color }}
                        aria-hidden
                      />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {formatBrl(c.total)}
                      <span className="ml-2 text-[11px]">({c.percentOfExpenses}%)</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
