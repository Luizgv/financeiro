"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { apiJson } from "@/lib/api";
import { snapshotsFromAppStart } from "@/lib/app-history";
import { formatBrl } from "@/lib/format";
import type { BootstrapResponse, SnapshotRow } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";
import { ThemeToggle } from "./theme-toggle";
import clsx from "clsx";

/**
 * Premium app frame: sidebar with current month + history, synced to ?snapshot=.
 */
export function FinanceShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramSnapshot = searchParams.get("snapshot");

  const setSession = useSessionStore((s) => s.setSession);
  const setActiveSnapshot = useSessionStore((s) => s.setActiveSnapshot);
  const householdId = useSessionStore((s) => s.householdId);

  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiJson<BootstrapResponse>("/api/bootstrap", { method: "POST" }),
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const b = bootstrap.data;
    if (!b) return;
    const state = useSessionStore.getState();
    if (!state.householdId || state.householdId !== b.householdId) {
      setSession({ householdId: b.householdId, snapshotId: b.snapshotId });
    }
  }, [bootstrap.data, setSession]);

  useEffect(() => {
    const b = bootstrap.data;
    if (!b) return;
    if (!paramSnapshot) {
      setActiveSnapshot(b.snapshotId);
      return;
    }
    setActiveSnapshot(paramSnapshot);
  }, [bootstrap.data, paramSnapshot, setActiveSnapshot]);

  const hid = householdId ?? bootstrap.data?.householdId;

  const snapshots = useQuery({
    queryKey: ["snapshots", hid],
    enabled: Boolean(hid),
    queryFn: () => apiJson<SnapshotRow[]>(`/api/households/${hid}/snapshots`),
  });

  const calendarKey = bootstrap.data?.calendarMonthKey ?? bootstrap.data?.monthKey;

  /** Newest calendar month first (YYYY-MM sorts lexicographically). */
  const periods = useMemo(() => {
    if (!snapshots.data) return [];
    return [...snapshotsFromAppStart(snapshots.data)].sort((a, b) =>
      a.monthKey < b.monthKey ? 1 : -1
    );
  }, [snapshots.data]);

  const selectedId = paramSnapshot ?? bootstrap.data?.snapshotId ?? null;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-sidebar px-3 py-6 shadow-[4px_0_48px_-12px_rgba(0,0,0,0.35)] dark:shadow-[4px_0_56px_-8px_rgba(0,0,0,0.75)] md:block">
        <div className="mb-6 px-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Família</div>
          <div className="mt-1 text-lg font-semibold tracking-tight">Financeiro</div>
        </div>

        <nav className="flex flex-col gap-0.5 text-sm">
          <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted">Períodos</div>
          <p className="mb-3 px-2 text-[11px] leading-relaxed text-muted">
            Escolha o mês para ver o painel, lançamentos e totais daquele período.
          </p>
          <div className="max-h-[calc(100vh-14rem)] space-y-0.5 overflow-y-auto pr-1">
            {snapshots.isPending && (
              <div className="px-2 py-2 text-xs text-muted">Carregando meses…</div>
            )}
            {!snapshots.isPending &&
              periods.map((s) => {
                const active = selectedId === s._id;
                const isCalendarMonth = Boolean(calendarKey && s.monthKey === calendarKey);
                return (
                  <button
                    key={s._id}
                    type="button"
                    onClick={() => router.push(`/?snapshot=${s._id}`)}
                    className={clsx(
                      "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left transition",
                      active
                        ? "bg-[var(--sidebar-active)] text-foreground shadow-sm ring-1 ring-inset ring-white/10 dark:ring-white/[0.06]"
                        : "text-muted hover:bg-[var(--sidebar-active)]/60 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium capitalize text-foreground">{formatMonthTitle(s.monthKey)}</span>
                      <span className="flex shrink-0 flex-wrap justify-end gap-1">
                        {isCalendarMonth && (
                          <span className="rounded bg-success-subtle px-1.5 py-0.5 text-[10px] font-medium text-success">
                            Atual
                          </span>
                        )}
                        {s.isClosed && (
                          <span className="rounded bg-muted/15 px-1.5 py-0.5 text-[10px] text-muted">Leitura</span>
                        )}
                      </span>
                    </div>
                    <span
                      className={clsx(
                        "text-xs tabular-nums",
                        s.balance >= 0 ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
                      )}
                    >
                      Saldo {formatBrl(s.balance)}
                    </span>
                  </button>
                );
              })}
            {!snapshots.isPending && periods.length === 0 && (
              <p className="px-2 py-2 text-xs leading-relaxed text-muted">Nenhum período encontrado.</p>
            )}
            {!snapshots.isPending && periods.length === 1 && (
              <p className="mt-3 px-2 text-[11px] leading-relaxed text-muted">
                Quando o calendário avançar para outro mês, o período anterior aparece nesta lista para consulta
                (somente leitura se estiver fechado).
              </p>
            )}
          </div>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card/40 px-4 py-3 backdrop-blur-md dark:bg-card/25 md:px-8">
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            <span className="truncate font-semibold">Financeiro</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
