"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import Link from "next/link";
import { apiJson } from "@/lib/api";
import { snapshotsFromAppStart } from "@/lib/app-history";
import { formatBrl } from "@/lib/format";
import type { BootstrapResponse, SnapshotRow } from "@/lib/types";
import { useSessionStore } from "@/store/session-store";

/**
 * Read-focused list of past monthly snapshots with balances.
 */
export function HistoryClient() {
  const householdId = useSessionStore((s) => s.householdId);
  const setSession = useSessionStore((s) => s.setSession);

  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => apiJson<BootstrapResponse>("/api/bootstrap", { method: "POST" }),
    staleTime: 1000 * 60 * 30,
  });

  useEffect(() => {
    if (bootstrap.data && !householdId) {
      setSession({
        householdId: bootstrap.data.householdId,
        snapshotId: bootstrap.data.snapshotId,
      });
    }
  }, [bootstrap.data, householdId, setSession]);

  const hid = householdId ?? bootstrap.data?.householdId;

  const snapshots = useQuery({
    queryKey: ["snapshots", hid],
    enabled: Boolean(hid),
    queryFn: () => apiJson<SnapshotRow[]>(`/api/households/${hid}/snapshots`),
  });

  if (snapshots.isPending) return <p className="text-sm text-muted">Carregando histórico…</p>;
  if (snapshots.isError) return <p className="text-sm text-red-500">Erro ao carregar.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico</h1>
        <p className="mt-1 text-sm text-muted">Meses anteriores permanecem imutáveis.</p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {snapshotsFromAppStart(snapshots.data!).map((s) => (
          <li key={s._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-4">
            <div>
              <div className="font-medium">{s.monthKey}</div>
              <div className="text-xs text-muted">{s.isClosed ? "Fechado" : "Aberto"}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted">Saldo</div>
              <div className="font-semibold tabular-nums">{formatBrl(s.balance)}</div>
            </div>
            <Link
              href="/"
              className="w-full rounded-lg border border-border px-3 py-1.5 text-center text-sm text-muted hover:bg-muted/40 sm:w-auto"
              onClick={() => useSessionStore.getState().setActiveSnapshot(s._id)}
            >
              Ver no painel
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
