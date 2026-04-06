"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { snapshotsFromAppStart } from "@/lib/app-history";
import { apiJson, formatApiErrorMessage } from "@/lib/api";
import { formatBrl } from "@/lib/format";
import type {
  BootstrapResponse,
  CategoryRow,
  DashboardResponse,
  QuickTransactionInstallmentResponse,
  SnapshotRow,
  TransactionRow,
} from "@/lib/types";
import { useSessionStore } from "@/store/session-store";
import { CategoryChart } from "./category-chart";
import { MonthSelector } from "./month-selector";
import { QuickAdd } from "./quick-add";
import { SalarySection } from "./salary-section";
import { StatementUpload } from "./statement-upload";
import { StructuredForm } from "./structured-form";
import { TotalCards } from "./total-cards";
import { TransactionList } from "./transaction-list";

/**
 * Month workspace: salaries, imports, totals, quick entry, ledger.
 */
export function DashboardClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const householdId = useSessionStore((s) => s.householdId);
  const activeSnapshotId = useSessionStore((s) => s.activeSnapshotId);
  const setSession = useSessionStore((s) => s.setSession);
  const setActiveSnapshot = useSessionStore((s) => s.setActiveSnapshot);

  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiJson<BootstrapResponse>("/api/bootstrap", { method: "POST" }),
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const boot = bootstrap.data;
    if (!boot) return;
    const state = useSessionStore.getState();
    if (!state.householdId || state.householdId !== boot.householdId) {
      setSession({ householdId: boot.householdId, snapshotId: boot.snapshotId });
    }
  }, [bootstrap.data, setSession]);

  const hid = householdId ?? bootstrap.data?.householdId ?? null;
  const sid = activeSnapshotId ?? bootstrap.data?.snapshotId ?? null;

  const snapshots = useQuery({
    queryKey: ["snapshots", hid],
    enabled: Boolean(hid),
    queryFn: () => apiJson<SnapshotRow[]>(`/api/households/${hid}/snapshots`),
  });

  const dashboard = useQuery({
    queryKey: ["dashboard", hid, sid],
    enabled: Boolean(hid && sid),
    queryFn: () => apiJson<DashboardResponse>(`/api/households/${hid}/snapshots/${sid}/dashboard`),
  });

  const transactions = useQuery({
    queryKey: ["transactions", sid],
    enabled: Boolean(hid && sid),
    queryFn: () => apiJson<TransactionRow[]>(`/api/households/${hid}/snapshots/${sid}/transactions`),
  });

  const categories = useQuery({
    queryKey: ["categories", hid],
    enabled: Boolean(hid),
    queryFn: () => apiJson<CategoryRow[]>(`/api/households/${hid}/categories`),
  });

  const syncCalendar = useMutation({
    mutationFn: () => apiJson<BootstrapResponse>("/api/bootstrap", { method: "POST" }),
    onSuccess: (d) => {
      setSession({ householdId: d.householdId, snapshotId: d.snapshotId });
      setActiveSnapshot(d.snapshotId);
      void queryClient.invalidateQueries({ queryKey: ["snapshots", d.householdId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
      void queryClient.invalidateQueries({ queryKey: ["fixed-incomes", d.householdId] });
    },
  });

  const quick = useMutation({
    mutationFn: (text: string) =>
      apiJson<TransactionRow | QuickTransactionInstallmentResponse>(
        `/api/households/${hid}/snapshots/${sid}/transactions/quick`,
        {
          method: "POST",
          body: JSON.stringify({ text }),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["snapshots", hid] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });

  const structured = useMutation({
    mutationFn: (payload: {
      title: string;
      amount: number;
      type: "income" | "expense";
      categoryId: string;
      paymentMethod: string;
      notes?: string;
    }) =>
      apiJson<TransactionRow>(`/api/households/${hid}/snapshots/${sid}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          date: new Date().toISOString(),
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", hid, sid] });
      void queryClient.invalidateQueries({ queryKey: ["transactions", sid] });
    },
  });

  const remove = useMutation({
    mutationFn: async (transactionId: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/households/${hid}/snapshots/${sid}/transactions/${transactionId}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["dashboard", hid, sid] });
      void queryClient.invalidateQueries({ queryKey: ["transactions", sid] });
    },
  });

  if (bootstrap.isPending) {
    return <p className="text-sm text-muted">Carregando…</p>;
  }
  if (bootstrap.isError) {
    const detail = formatApiErrorMessage(
      bootstrap.error,
      "Não foi possível conectar à API. Verifique o backend."
    );
    return <p className="text-sm text-red-500">{detail}</p>;
  }

  const readOnly = dashboard.data?.isClosed ?? false;
  const snapMeta = dashboard.data?.snapshot;

  return (
    <div className="mx-auto max-w-6xl space-y-10 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Painel do mês</h1>
            {snapMeta?.isCurrentCalendarMonth && (
              <span className="rounded-full bg-success-subtle px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-inset ring-success/25">
                Mês atual
              </span>
            )}
            {readOnly && (
              <span className="rounded-full bg-warning-subtle px-2.5 py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/30">
                Somente leitura
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {snapMeta?.monthKey
              ? `Período ${snapMeta.monthKey}. Novo mês traz só salários fixos; despesas começam zeradas.`
              : "Organize receitas e despesas por mês."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => syncCalendar.mutate()}
          disabled={syncCalendar.isPending}
          className="self-start rounded-lg border border-border bg-card/50 px-3 py-1.5 text-sm text-muted transition hover:border-border hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] disabled:opacity-40 dark:bg-transparent"
        >
          Sincronizar calendário
        </button>
      </div>

      {snapshots.data && sid && (
        <div className="md:hidden">
          <p className="mb-2 text-xs text-muted">Trocar mês</p>
          <MonthSelector
            snapshots={snapshotsFromAppStart(snapshots.data)}
            activeId={sid}
            onChange={(id) => {
              router.push(`/?snapshot=${id}`);
              setActiveSnapshot(id);
              void queryClient.invalidateQueries({ queryKey: ["dashboard", hid, id] });
              void queryClient.invalidateQueries({ queryKey: ["transactions", id] });
            }}
          />
        </div>
      )}

      {hid && <SalarySection householdId={hid} disabled={readOnly} />}

      {hid && sid && (
        <StatementUpload householdId={hid} snapshotId={sid} readOnly={readOnly} />
      )}

      {readOnly && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Histórico: você pode consultar valores, mas não editar lançamentos.
        </div>
      )}

      {dashboard.data && (
        <>
          <TotalCards
            totalIncome={dashboard.data.totals.totalIncome}
            totalExpenses={dashboard.data.totals.totalExpenses}
            balance={dashboard.data.totals.balance}
          />

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/80 bg-card/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Salários no mês</h3>
              <p className="mt-3 text-sm text-foreground">
                Você: <span className="font-medium tabular-nums">{formatBrl(dashboard.data.salaryBreakdown.mySalary)}</span>
              </p>
              <p className="mt-1 text-sm text-foreground">
                Esposa:{" "}
                <span className="font-medium tabular-nums">{formatBrl(dashboard.data.salaryBreakdown.wifeSalary)}</span>
              </p>
              {dashboard.data.salaryBreakdown.otherRecurringIncome > 0 && (
                <p className="mt-1 text-sm text-muted">
                  Outras rendas fixas: {formatBrl(dashboard.data.salaryBreakdown.otherRecurringIncome)}
                </p>
              )}
            </div>
            <div className="rounded-2xl border border-border/80 bg-card/50 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Origem dos lançamentos</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {dashboard.data.entriesBySource.map((row) => (
                  <li key={row.source} className="flex justify-between gap-2">
                    <span className="text-muted">{labelSource(row.source)}</span>
                    <span className="tabular-nums text-foreground">{row.count} itens</span>
                  </li>
                ))}
                {dashboard.data.entriesBySource.length === 0 && (
                  <li className="text-muted">Nenhum lançamento ainda.</li>
                )}
              </ul>
              <p className="mt-3 border-t border-border/60 pt-3 text-xs text-muted">
                Manual/recorrente: {dashboard.data.importSummary.manualOrRecurringCount} · Importados:{" "}
                {dashboard.data.importSummary.importedCount}
              </p>
            </div>
          </section>
        </>
      )}

      <section>{dashboard.data && <CategoryChart rows={dashboard.data.expensesByCategory} />}</section>

      <section className="space-y-4 rounded-2xl border border-border/80 bg-card/60 p-6">
        <h2 className="text-sm font-medium text-muted">Entrada rápida</h2>
        <QuickAdd
          disabled={readOnly || !hid || !sid}
          onSubmit={async (t) => {
            await quick.mutateAsync(t);
          }}
        />
        {categories.data && (
          <StructuredForm
            categories={categories.data}
            disabled={readOnly || !hid || !sid}
            onSubmit={async (p) => {
              await structured.mutateAsync(p);
            }}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Lançamentos</h2>
        {transactions.data && categories.data && (
          <TransactionList
            rows={transactions.data}
            categories={categories.data}
            readOnly={readOnly}
            onDelete={readOnly ? undefined : (id) => remove.mutateAsync(id)}
          />
        )}
        {transactions.data && !categories.data && (
          <p className="text-sm text-muted">Carregando categorias…</p>
        )}
      </section>
    </div>
  );
}

function labelSource(s: string): string {
  const m: Record<string, string> = {
    manual: "Manual",
    invoice: "Fatura",
    bank_statement: "Extrato",
    recurring_income: "Salário fixo",
  };
  return m[s] ?? s;
}
