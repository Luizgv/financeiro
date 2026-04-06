/**
 * Builds a month key in YYYY-MM from a Date (local calendar).
 */
export function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Returns today's month key in local time.
 */
export function currentMonthKey(): string {
  return monthKeyFromDate(new Date());
}

/**
 * Compares two YYYY-MM keys: negative if a < b, 0 if equal, positive if a > b.
 */
export function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

/**
 * Adds calendar months to a YYYY-MM key (local calendar).
 */
export function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1, 12, 0, 0, 0);
  return monthKeyFromDate(d);
}

/**
 * First day of month at noon (stable for DB) from YYYY-MM.
 */
export function startOfMonthFromKey(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1, 12, 0, 0, 0);
}
