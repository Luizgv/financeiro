"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * Toggles light / dark / system color theme.
 */
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="h-9 w-20" />;

  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted transition hover:border-border hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-background"
    >
      {theme === "system" ? "Sistema" : resolvedTheme === "dark" ? "Escuro" : "Claro"}
    </button>
  );
}
