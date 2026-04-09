"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api";
import { formatBrl } from "@/lib/format";
import type { FixedIncomeRow } from "@/lib/types";

type Props = {
  householdId: string;
  disabled: boolean;
};

/**
 * Two clear salary fields (me + wife) persisted as recurring fixed income templates.
 */
export function SalarySection({ householdId, disabled }: Props) {
  const qc = useQueryClient();
  const { data, isPending } = useQuery({
    queryKey: ["fixed-incomes", householdId],
    queryFn: () => apiJson<FixedIncomeRow[]>(`/api/households/${householdId}/fixed-incomes`),
    enabled: Boolean(householdId),
  });

  const mine = data?.find((r) => r.owner === "me");
  const wife = data?.find((r) => r.owner === "wife");

  const [myAmount, setMyAmount] = useState("");
  const [wifeAmount, setWifeAmount] = useState("");
  const [myLabel, setMyLabel] = useState("Meu salário");
  const [wifeLabel, setWifeLabel] = useState("Salário — esposa");

  useEffect(() => {
    if (mine) {
      setMyAmount(String(mine.amount));
      setMyLabel(mine.label || mine.description || "Meu salário");
    }
    if (wife) {
      setWifeAmount(String(wife.amount));
      setWifeLabel(wife.label || wife.description || "Salário — esposa");
    }
  }, [mine, wife]);

  const save = useMutation({
    mutationFn: () =>
      apiJson<{ me: FixedIncomeRow; wife: FixedIncomeRow }>(`/api/households/${householdId}/salaries`, {
        method: "PUT",
        body: JSON.stringify({
          mySalary: Number.parseFloat(myAmount.replace(",", ".")) || 0,
          wifeSalary: Number.parseFloat(wifeAmount.replace(",", ".")) || 0,
          myLabel: myLabel.trim() || "Meu salário",
          wifeLabel: wifeLabel.trim() || "Salário — esposa",
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["fixed-incomes", householdId] });
      void qc.invalidateQueries({ queryKey: ["snapshots", householdId] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["month-summary"] });
    },
  });

  if (isPending) {
    return (
      <div className="rounded-2xl border border-border bg-card/50 p-6 text-sm text-muted dark:bg-card/40 dark:shadow-card-dark">
        Carregando salários…
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-gradient-to-br from-card to-card/90 p-6 shadow-sm dark:from-card dark:to-elevated/80 dark:shadow-card-dark">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Salários mensais</h2>
          <p className="mt-1 text-xs text-muted">
            Rendimentos fixos copiados automaticamente para cada mês novo. Não são despesas.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || save.isPending}
          onClick={() => save.mutate()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm transition hover:bg-accent-hover hover:shadow-accent-glow disabled:opacity-40"
        >
          Salvar salários
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">Meu salário</span>
          <input
            value={myLabel}
            onChange={(e) => setMyLabel(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm transition focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50"
          />
          <input
            inputMode="decimal"
            value={myAmount}
            onChange={(e) => setMyAmount(e.target.value)}
            disabled={disabled}
            placeholder="0,00"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-sm tabular-nums transition focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50"
          />
          {mine && (
            <span className="text-[11px] text-muted">Próximo mês: {formatBrl(mine.amount)} como renda fixa</span>
          )}
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">Salário da esposa</span>
          <input
            value={wifeLabel}
            onChange={(e) => setWifeLabel(e.target.value)}
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm transition focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50"
          />
          <input
            inputMode="decimal"
            value={wifeAmount}
            onChange={(e) => setWifeAmount(e.target.value)}
            disabled={disabled}
            placeholder="0,00"
            className="w-full rounded-lg border border-border bg-input px-3 py-2 font-mono text-sm tabular-nums transition focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-[color:var(--focus-ring)]/50"
          />
          {wife && (
            <span className="text-[11px] text-muted">Próximo mês: {formatBrl(wife.amount)} como renda fixa</span>
          )}
        </label>
      </div>
    </section>
  );
}
