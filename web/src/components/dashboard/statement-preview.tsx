"use client";

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

  return (
    <div className="mt-4 rounded-xl border border-accent/25 bg-accent/5 p-4 dark:border-accent/30 dark:bg-accent/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Resumo do arquivo</h3>
          <p className="mt-0.5 text-xs text-muted">
            {preview.originalName} · {kindLabel} · {preview.lineCount} linha(s) detectada(s)
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-muted/50 hover:text-foreground"
        >
          Fechar
        </button>
      </div>

      <p className="mt-3 rounded-lg border border-border/80 bg-card/80 px-3 py-2 text-[11px] leading-relaxed text-muted dark:bg-card/50">
        <span className="font-medium text-foreground">Só leitura:</span> nada foi lançado no mês. O painel e as
        estatísticas só mudam quando você registrar na{" "}
        <span className="font-medium text-foreground">entrada rápida</span> ou no formulário.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card/60 px-3 py-2 dark:bg-card/40">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Saídas (arquivo)</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatBrl(preview.totals.expense)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card/60 px-3 py-2 dark:bg-card/40">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Entradas (arquivo)</div>
          <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatBrl(preview.totals.income)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card/60 px-3 py-2 dark:bg-card/40">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted">Saldo (arquivo)</div>
          <div
            className={`mt-1 text-lg font-semibold tabular-nums ${
              preview.totals.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
            }`}
          >
            {formatBrl(preview.totals.net)}
          </div>
        </div>
      </div>

      {preview.paymentSummary.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-muted">Indício por canal (heurístico)</h4>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {preview.paymentSummary.map((row) => (
              <li
                key={row.key}
                className="flex flex-col rounded-lg border border-border/70 bg-card/40 px-3 py-2 text-xs dark:bg-card/30"
              >
                <span className="font-medium text-foreground">{HINT_LABEL[row.key] ?? row.key}</span>
                <span className="mt-1 text-muted">
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
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="mt-4 rounded-lg border border-border/70 bg-card/30 open:bg-card/50 dark:bg-card/20">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-foreground">
          Linhas extraídas (amostra)
        </summary>
        <div className="max-h-64 overflow-auto border-t border-border/60 px-2 py-2">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-card text-muted">
              <tr>
                <th className="px-2 py-1 font-medium">Data</th>
                <th className="px-2 py-1 font-medium">Descrição</th>
                <th className="px-2 py-1 font-medium">Canal</th>
                <th className="px-2 py-1 font-medium">Categoria (sug.)</th>
                <th className="px-2 py-1 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {preview.lines.map((line, i) => (
                <tr key={`${line.title}-${i}`} className="text-foreground">
                  <td className="whitespace-nowrap px-2 py-1.5 text-muted">
                    {new Date(line.date).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="max-w-[140px] truncate px-2 py-1.5" title={line.title}>
                    {line.title}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-muted">{HINT_LABEL[line.paymentHint] ?? line.paymentHint}</td>
                  <td className="max-w-[100px] truncate px-2 py-1.5 text-muted" title={line.suggestedCategory}>
                    {line.suggestedCategory}
                  </td>
                  <td
                    className={`whitespace-nowrap px-2 py-1.5 text-right font-medium tabular-nums ${
                      line.type === "income" ? "text-emerald-600 dark:text-emerald-400" : ""
                    }`}
                  >
                    {line.type === "income" ? "+" : "−"}
                    {formatBrl(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.lineCount > preview.lines.length && (
            <p className="px-2 py-2 text-center text-[10px] text-muted">
              Mostrando {preview.lines.length} de {preview.lineCount} linhas.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
