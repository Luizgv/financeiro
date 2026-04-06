import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const householdSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** Reserved for future auth — optional external user ids */
    memberUserIds: [{ type: Schema.Types.ObjectId }],
  },
  { timestamps: true }
);

type HouseholdRaw = InferSchemaType<typeof householdSchema>;
export type HouseholdDocument = HydratedDocument<HouseholdRaw>;

export type HouseholdModel = Model<HouseholdDocument>;

export const Household: HouseholdModel =
  mongoose.models.Household ?? mongoose.model<HouseholdDocument>("Household", householdSchema);
