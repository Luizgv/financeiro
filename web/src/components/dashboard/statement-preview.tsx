"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { formatBrl } from "@/lib/format";
import type { StatementPreviewResponse } from "@/lib/types";

const HINT_LABEL: Record<string, string> = {
  pix: "Pix",
  card: "Cartão",
  debit: "Débito",
  transfer: "TED / DOC / transferência",
  boleto: "Boleto",
  unknown: "Canal não identificado",
};

const KIND_LABEL: Record<string, string> = {
  credit_card_invoice: "Fatura de cartão",
  bank_statement: "Extrato bancário",
  other: "Arquivo",
};

type Props = {
  preview: StatementPreviewResponse;
  onDismiss: () => void;
};

/**
 * Read-only summary of a parsed statement (does not affect month totals).
 */
export function StatementPreview({ preview, onDismiss }: Props) {
  const kindLabel = KIND_LABEL[preview.kind] ?? preview.kind;
  const [lineFilter, setLineFilter] = useState<"all" | "pix">("all");

  const pixSummary = useMemo(
    () => preview.paymentSummary.find((p) => p.key === "pix"),
    [preview.paymentSummary]
  );

  const pixList = useMemo(() => {
    const fromApi = preview.pixLines?.length ? preview.pixLines : [];
    const fallback = preview.lines.filter((l) => l.paymentHint === "pix");
    const raw = fromApi.length ? fromApi : fallback;
    return [...raw].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [preview.pixLines, preview.lines]);

  const hasPixActivity =
    (pixSummary && (pixSummary.incomeCount > 0 || pixSummary.expenseCount > 0)) || pixList.length > 0;

  const pixTotalsFromSummary =
    pixSummary != null && (pixSummary.incomeCount > 0 || pixSummary.expenseCount > 0);

  const pixInTotal = pixTotalsFromSummary
    ? pixSummary!.incomeTotal
    : pixList.filter((l) => l.type === "income").reduce((s, l) => s + l.amount, 0);
  const pixOutTotal = pixTotalsFromSummary
    ? pixSummary!.expenseTotal
    : pixList.filter((l) => l.type === "expense").reduce((s, l) => s + l.amount, 0);
  const pixInCount = pixTotalsFromSummary
    ? pixSummary!.incomeCount
    : pixList.filter((l) => l.type === "income").length;
  const pixOutCount = pixTotalsFromSummary
    ? pixSummary!.expenseCount
    : pixList.filter((l) => l.type === "expense").length;

  const tableLines = useMemo(() => {
    const base = preview.lines;
    if (lineFilter === "pix") return base.filter((l) => l.paymentHint === "pix");
    return base;
  }, [preview.lines, lineFilter]);

  const otherChannels = preview.paymentSummary.filter((p) => p.key !== "pix");

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-b from-accent/[0.07] to-card/40 shadow-sm dark:border-accent/25 dark:from-accent/10 dark:to-card/30">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">Resumo do arquivo</h3>
          <p className="mt-1 text-xs text-muted">
            {preview.originalName} · {kindLabel} · {preview.lineCount} linha(s) detectada(s)
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg border border-border/80 bg-card/80 px-3 py-1.5 text-xs font-medium text-muted transition hover:border-border hover:bg-elevated hover:text-foreground dark:bg-card/50"
        >
          Fechar
        </button>
      </div>

      <div className="space-y-5 px-4 py-4 sm:px-5">
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-muted dark:border-amber-500/20 dark:bg-amber-500/[0.08]">
          <span className="font-semibold text-foreground">Só leitura:</span> nada foi lançado no mês. O painel só
          muda quando você usar a <span className="font-medium text-foreground">entrada rápida</span> ou o{" "}
          <span className="font-medium text-foreground">formulário</span>.
        </p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm dark:bg-card/60">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <span className="flex size-7 items-center justify-center rounded-lg bg-rose-500/15 text-sm" aria-hidden>
                ↓
              </span>
              Saídas (arquivo)
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-foreground">
              {formatBrl(preview.totals.expense)}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm dark:bg-card/60">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-sm" aria-hidden>
                ↑
              </span>
              Entradas (arquivo)
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
              {formatBrl(preview.totals.income)}
            </p>
          </div>
          <div className="rounded-xl border border-border/80 bg-card/90 p-4 shadow-sm dark:bg-card/60 sm:col-span-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
              <span className="flex size-7 items-center justify-center rounded-lg bg-muted/50 text-sm" aria-hidden>
                =
              </span>
              Saldo (arquivo)
            </div>
            <p
              className={clsx(
                "mt-2 text-xl font-bold tabular-nums tracking-tight",
                preview.totals.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
              )}
            >
              {formatBrl(preview.totals.net)}
            </p>
          </div>
        </div>

        <section
          className="rounded-2xl border border-cyan-500/35 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-teal-500/[0.05] p-4 dark:border-cyan-400/25 dark:from-cyan-500/10"
          aria-labelledby="pix-section-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 id="pix-section-title" className="text-sm font-semibold text-foreground">
              Pix no extrato
            </h4>
            <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-[10px] font-medium text-cyan-800 dark:text-cyan-200">
              Heurístico · não lança no mês
            </span>
          </div>

          {hasPixActivity ? (
            <>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4 dark:bg-emerald-500/[0.08]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/90 dark:text-emerald-200/90">
                    Entradas (Pix)
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {formatBrl(pixInTotal)}
                  </p>
                  <p className="mt-1 text-xs text-muted">{pixInCount} lançamento(s)</p>
                </div>
                <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.05] p-4 dark:bg-rose-500/[0.08]">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-rose-900/80 dark:text-rose-200/90">
                    Saídas (Pix)
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatBrl(pixOutTotal)}</p>
                  <p className="mt-1 text-xs text-muted">{pixOutCount} lançamento(s)</p>
                </div>
              </div>

              {!pixTotalsFromSummary && pixList.length > 0 && (
                <p className="mt-2 text-[10px] text-muted">
                  Totais Pix acima refletem só as linhas da amostra; o resumo geral do arquivo continua nos três cards.
                </p>
              )}

              {pixList.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-medium text-muted">
                    Linhas classificadas como Pix (rolagem; amostra dedicada do arquivo)
                  </p>
                  <ul className="max-h-52 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/70 bg-card/80 text-sm dark:bg-card/50">
                    {pixList.map((line, i) => (
                      <li key={`${line.date}-${line.title}-${i}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground" title={line.title}>
                            {line.title}
                          </p>
                          <p className="text-[11px] text-muted">
                            {new Date(line.date).toLocaleDateString("pt-BR")} · {line.suggestedCategory}
                          </p>
                        </div>
                        <span
                          className={clsx(
                            "shrink-0 font-semibold tabular-nums",
                            line.type === "income"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-foreground"
                          )}
                        >
                          {line.type === "income" ? "+" : "−"}
                          {formatBrl(line.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Nenhuma linha foi rotulada como <strong className="text-foreground">Pix</strong> automaticamente. Bancos
              usam textos diferentes; use a tabela abaixo e o filtro &quot;Só Pix&quot; para conferir. A detecção foi
              ampliada para frases comuns (transferência Pix, via Pix, etc.).
            </p>
          )}
        </section>

        {otherChannels.length > 0 && (
          <section aria-labelledby="channels-title">
            <h4 id="channels-title" className="text-xs font-medium text-muted">
              Demais canais (heurístico)
            </h4>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
              {otherChannels.map((row) => (
                <div
                  key={row.key}
                  className="min-w-[200px] shrink-0 rounded-xl border border-border/80 bg-card/70 px-3 py-2.5 text-xs shadow-sm dark:bg-card/40 sm:min-w-0"
                >
                  <p className="font-semibold text-foreground">{HINT_LABEL[row.key] ?? row.key}</p>
                  <p className="mt-1 text-muted">
                    {row.expenseCount > 0 && (
                      <span className="tabular-nums">
                        {row.expenseCount} saída(s) · {formatBrl(row.expenseTotal)}
                      </span>
                    )}
                    {row.expenseCount > 0 && row.incomeCount > 0 && <span> · </span>}
                    {row.incomeCount > 0 && (
                      <span className="tabular-nums">
                        {row.incomeCount} entrada(s) · {formatBrl(row.incomeTotal)}
                      </span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <details className="group rounded-xl border border-border/70 bg-card/40 open:bg-card/60 dark:bg-card/25 dark:open:bg-card/35">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground transition hover:bg-muted/20">
            <span className="mr-1 inline-block transition group-open:rotate-90">▶</span>
            Linhas extraídas (amostra)
          </summary>
          <div className="border-t border-border/60 px-3 pb-3 pt-2">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label htmlFor="stmt-line-filter" className="text-[11px] text-muted">
                Filtrar tabela
              </label>
              <select
                id="stmt-line-filter"
                value={lineFilter}
                onChange={(e) => setLineFilter(e.target.value as "all" | "pix")}
                className="rounded-lg border border-border bg-input px-2 py-1.5 text-xs text-foreground"
              >
                <option value="all">Todas ({preview.lines.length} na amostra)</option>
                <option value="pix">Só Pix</option>
              </select>
            </div>
            <div className="max-h-64 overflow-auto rounded-lg border border-border/50">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 z-[1] bg-elevated text-muted dark:bg-card">
                  <tr>
                    <th className="px-2 py-2 font-medium">Data</th>
                    <th className="px-2 py-2 font-medium">Descrição</th>
                    <th className="px-2 py-2 font-medium">Canal</th>
                    <th className="px-2 py-2 font-medium">Categoria (sug.)</th>
                    <th className="px-2 py-2 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 bg-card/30 dark:bg-card/20">
                  {tableLines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-muted">
                        Nenhuma linha neste filtro na amostra.
                      </td>
                    </tr>
                  ) : (
                    tableLines.map((line, i) => (
                      <tr key={`${line.title}-${i}`} className="text-foreground">
                        <td className="whitespace-nowrap px-2 py-2 text-muted">
                          {new Date(line.date).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="max-w-[140px] truncate px-2 py-2" title={line.title}>
                          {line.title}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2">
                          <span
                            className={clsx(
                              "rounded-md px-1.5 py-0.5 font-medium",
                              line.paymentHint === "pix"
                                ? "bg-cyan-500/15 text-cyan-900 dark:text-cyan-200"
                                : "text-muted"
                            )}
                          >
                            {HINT_LABEL[line.paymentHint] ?? line.paymentHint}
                          </span>
                        </td>
                        <td className="max-w-[100px] truncate px-2 py-2 text-muted" title={line.suggestedCategory}>
                          {line.suggestedCategory}
                        </td>
                        <td
                          className={clsx(
                            "whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums",
                            line.type === "income" ? "text-emerald-600 dark:text-emerald-400" : ""
                          )}
                        >
                          {line.type === "income" ? "+" : "−"}
                          {formatBrl(line.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {preview.lineCount > preview.lines.length && (
              <p className="mt-2 text-center text-[10px] text-muted">
                Mostrando {preview.lines.length} de {preview.lineCount} linhas na amostra geral.
              </p>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}
