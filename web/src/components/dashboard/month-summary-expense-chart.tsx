"use client";

import { formatBrl } from "@/lib/format";
import type { MonthSummaryExpenseChartSlice } from "@/lib/types";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type SlicePayload = MonthSummaryExpenseChartSlice & { value: number };

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: SlicePayload }>;
}) {
  if (!active || !payload?.[0]) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg dark:shadow-black/40">
      <p className="font-semibold text-foreground">{p.name}</p>
      <p className="tabular-nums text-muted">{formatBrl(p.total)}</p>
      <p className="text-[11px] text-muted">{p.percentOfExpenses}% das despesas do mês</p>
    </div>
  );
}

type Props = {
  slices: MonthSummaryExpenseChartSlice[];
};

/**
 * Donut chart + legend for month summary expense breakdown (Recharts).
 */
export function MonthSummaryExpenseChart({ slices }: Props) {
  if (slices.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/5 px-4 text-center text-sm text-muted">
        Não há despesas por categoria para exibir no gráfico.
      </div>
    );
  }

  const data: SlicePayload[] = slices.map((s) => ({ ...s, value: s.total }));

  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Despesas por categoria</h3>
      <p className="mt-1 text-[11px] text-muted">Valores e percentuais sobre o total de saídas do mês.</p>
      <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-8">
        <div className="mx-auto h-[220px] w-full max-w-[300px] sm:h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="54%"
                outerRadius="82%"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell
                    key={`${entry.name}-${i}`}
                    fill={entry.color}
                    stroke="var(--border)"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-2" aria-label="Legenda do gráfico">
          {slices.map((s, i) => (
            <li
              key={`${s.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-2.5 dark:bg-card/35"
            >
              <span
                className="size-3 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{s.name}</p>
                <p className="text-xs tabular-nums text-muted">
                  {formatBrl(s.total)} <span className="text-border">·</span> {s.percentOfExpenses}%
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
