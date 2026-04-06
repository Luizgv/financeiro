import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const OWNER_VALUES = ["me", "wife"] as const;

const fixedIncomeSchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", required: true },
    owner: { type: String, enum: OWNER_VALUES, required: true },
    /** Display label (e.g. "Salário — João") */
    label: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, required: true, trim: true },
    recurring: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
    startDate: { type: Date, default: () => new Date() },
    endDate: { type: Date, default: null },
  },
  { timestamps: true }
);

fixedIncomeSchema.index({ householdId: 1, owner: 1 });

export type FixedIncomeOwner = (typeof OWNER_VALUES)[number];
type FixedIncomeRaw = InferSchemaType<typeof fixedIncomeSchema>;
export type FixedIncomeDocument = HydratedDocument<FixedIncomeRaw>;
export type FixedIncomeModel = Model<FixedIncomeDocument>;

export const FixedIncome: FixedIncomeModel =
  mongoose.models.FixedIncome ?? mongoose.model<FixedIncomeDocument>("FixedIncome", fixedIncomeSchema);
