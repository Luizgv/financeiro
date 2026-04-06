import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

/**
 * Optional auth-ready user record; household membership can be linked later.
 */
const userSchema = new Schema(
  {
    email: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    displayName: { type: String, trim: true },
    householdId: { type: Schema.Types.ObjectId, ref: "Household", default: null },
  },
  { timestamps: true }
);

type UserRaw = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserRaw>;
export type UserModel = Model<UserDocument>;

export const User: UserModel = mongoose.models.User ?? mongoose.model<UserDocument>("User", userSchema);
