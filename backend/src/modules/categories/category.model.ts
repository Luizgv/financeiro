import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const categorySchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", default: null },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    icon: { type: String, default: "circle" },
    color: { type: String, default: "#6366f1" },
    isPredefined: { type: Boolean, default: false },
  },
  { timestamps: true }
);

categorySchema.index({ householdId: 1, slug: 1 }, { unique: true, partialFilterExpression: { householdId: { $ne: null } } });
categorySchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { householdId: null } });

type CategoryRaw = InferSchemaType<typeof categorySchema>;
export type CategoryDocument = HydratedDocument<CategoryRaw>;

export type CategoryModel = Model<CategoryDocument>;

export const Category: CategoryModel =
  mongoose.models.Category ?? mongoose.model<CategoryDocument>("Category", categorySchema);
