import { config as loadEnv } from "dotenv";
import mongoose from "mongoose";
import { Category } from "../modules/categories/category.model.js";
import { globalCategoryBySlug } from "../modules/categories/global-category-scope.js";
import { PREDEFINED_CATEGORIES } from "../modules/categories/predefined-categories.js";

loadEnv();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is required");
  await mongoose.connect(uri);
  for (const item of PREDEFINED_CATEGORIES) {
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
  console.log("Categories seeded.");
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
