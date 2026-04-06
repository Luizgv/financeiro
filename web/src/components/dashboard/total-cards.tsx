import { formatBrl } from "@/lib/format";

type Props = {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
};

/**
 * Summary metric cards for the active month.
 */
export function TotalCards({ totalIncome, totalExpenses, balance }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label="Receitas" value={totalIncome} tone="positive" />
      <Metric label="Despesas" value={totalExpenses} tone="neutral" />
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-card-dark">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">Saldo</div>
        <div
          className={`mt-2 text-2xl font-semibold tabular-nums ${
            balance >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
          }`}
        >
          {formatBrl(balance)}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-muted">Receitas − despesas neste mês.</p>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-[color:var(--success)]"
      : tone === "negative"
        ? "text-[color:var(--danger)]"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:shadow-card-dark">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{formatBrl(value)}</div>
    </div>
  );
}
