import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

/**
 * Linear-style shell with sidebar and top bar.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card/40 px-4 py-6 md:block">
        <div className="mb-8 font-semibold tracking-tight text-foreground">Financeiro</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/"
            className="rounded-md px-2 py-1.5 text-muted hover:bg-muted/50 hover:text-foreground"
          >
            Painel
          </Link>
          <Link
            href="/history"
            className="rounded-md px-2 py-1.5 text-muted hover:bg-muted/50 hover:text-foreground"
          >
            Histórico
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3 md:px-8">
          <div className="flex items-center gap-4 md:hidden">
            <span className="font-semibold">Financeiro</span>
            <Link href="/" className="text-sm text-muted">
              Painel
            </Link>
            <Link href="/history" className="text-sm text-muted">
              Histórico
            </Link>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
