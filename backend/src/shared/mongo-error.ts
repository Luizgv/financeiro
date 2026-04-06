/**
 * Detects MongoDB duplicate key errors (e.g. parallel creates on the same unique index).
 */
export function isMongoDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const code = (err as { code?: number }).code;
  return code === 11000;
}
