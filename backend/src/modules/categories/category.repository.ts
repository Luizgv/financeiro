import type { Types } from "mongoose";
import { Category, type CategoryDocument } from "./category.model.js";
import { globalCategoryBySlug, globalCategoryWhere } from "./global-category-scope.js";

/**
 * Persistence access for categories (global + per household).
 */
export class CategoryRepository {
  async findById(id: Types.ObjectId): Promise<CategoryDocument | null> {
    return Category.findById(id);
  }

  async findBySlugForHousehold(slug: string, householdId: Types.ObjectId | null): Promise<CategoryDocument | null> {
    if (householdId) {
      const custom = await Category.findOne({ householdId, slug });
      if (custom) return custom;
    }
    return Category.findOne(globalCategoryBySlug(slug));
  }

  async listForHousehold(householdId: Types.ObjectId): Promise<CategoryDocument[]> {
    const globals = await Category.find(globalCategoryWhere()).sort({ name: 1 });
    const customs = await Category.find({ householdId }).sort({ name: 1 });
    return [...globals, ...customs];
  }

  async createCustom(input: {
    householdId: Types.ObjectId;
    name: string;
    slug: string;
    icon?: string;
    color?: string;
  }): Promise<CategoryDocument> {
    return Category.create({
      householdId: input.householdId,
      name: input.name,
      slug: input.slug,
      icon: input.icon ?? "tag",
      color: input.color ?? "#94a3b8",
      isPredefined: false,
    });
  }

  async ensurePredefinedSeed(
    items: { name: string; slug: string; icon: string; color: string }[]
  ): Promise<void> {
    for (const item of items) {
      await Category.updateOne(
        globalCategoryBySlug(item.slug),
        {
          $setOnInsert: {
            householdId: null,
            name: item.name,
            slug: item.slug,
            icon: item.icon,
            color: item.color,
            isPredefined: true,
          },
        },
        { upsert: true }
      );
    }
  }
}
