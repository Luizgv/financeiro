/**
 * First calendar month shown in lists (inclusive). `monthKey` is `YYYY-MM`; string compare is valid.
 */
export const FIRST_TRACKED_MONTH_KEY = "2026-04";

/**
 * Drops snapshots before {@link FIRST_TRACKED_MONTH_KEY}.
 */
export function snapshotsFromAppStart<T extends { monthKey: string }>(rows: T[]): T[] {
  return rows.filter((s) => s.monthKey >= FIRST_TRACKED_MONTH_KEY);
}
