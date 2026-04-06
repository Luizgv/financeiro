import type { FilterQuery } from "mongoose";
import type { CategoryDocument } from "./category.model.js";

/**
 * Global categories may be stored with `householdId: null` or with the field omitted; both must match.
 */
export function globalCategoryWhere(): FilterQuery<CategoryDocument> {
  return { $or: [{ householdId: null }, { householdId: { $exists: false } }] };
}

/**
 * Filter for one global category by slug.
 */
export function globalCategoryBySlug(slug: string): FilterQuery<CategoryDocument> {
  return { slug, ...globalCategoryWhere() };
}
