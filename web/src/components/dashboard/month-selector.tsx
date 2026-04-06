"use client";

import clsx from "clsx";
import type { SnapshotRow } from "@/lib/types";

type Props = {
  snapshots: SnapshotRow[];
  activeId: string | null;
  onChange: (snapshotId: string) => void;
};

/**
 * Pill selector for switching the active month snapshot.
 */
export function MonthSelector({ snapshots, activeId, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {snapshots.map((s) => {
        const active = s._id === activeId;
        return (
          <button
            key={s._id}
            type="button"
            onClick={() => onChange(s._id)}
            className={clsx(
              "rounded-full border px-3 py-1 text-sm transition",
              active
                ? "border-accent bg-accent/15 text-foreground"
                : "border-border bg-card text-muted hover:border-border/80 hover:text-foreground",
              s.isClosed && "opacity-80"
            )}
          >
            {formatMonthLabel(s.monthKey)}
            {s.isClosed ? " · fechado" : ""}
          </button>
        );
      })}
    </div>
  );
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}
