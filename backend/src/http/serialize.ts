import type { Types } from "mongoose";

/**
 * Converts Mongoose ObjectIds in plain objects to strings for JSON responses.
 */
export function serializeDoc<T extends Record<string, unknown>>(doc: T): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}

export function toIdString(id: Types.ObjectId | string): string {
  return String(id);
}
