import { Suspense } from "react";
import { FinanceShell } from "@/components/shell/finance-shell";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted">
          Carregando…
        </div>
      }
    >
      <FinanceShell>
        <DashboardClient />
      </FinanceShell>
    </Suspense>
  );
}
