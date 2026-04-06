import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const SNAPSHOT_STATUSES = ["active", "archived", "closed"] as const;

const monthlySnapshotSchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", required: true },
    /** Canonical period id e.g. "2026-04" */
    monthKey: { type: String, required: true },
    totalIncome: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    /** Legacy flag — kept in sync with status for API compatibility */
    isClosed: { type: Boolean, default: false },
    status: { type: String, enum: SNAPSHOT_STATUSES, default: "active" },
    transactionCount: { type: Number, default: 0 },
    closedAt: { type: Date, default: null },
    /** True when this snapshot was created by month rollover with fixed incomes materialized */
    carriedFixedIncome: { type: Boolean, default: false },
  },
  { timestamps: true }
);

monthlySnapshotSchema.index({ householdId: 1, monthKey: 1 }, { unique: true });

export type SnapshotStatus = (typeof SNAPSHOT_STATUSES)[number];

type MonthlySnapshotRaw = InferSchemaType<typeof monthlySnapshotSchema>;
export type MonthlySnapshotDocument = HydratedDocument<MonthlySnapshotRaw>;

export type MonthlySnapshotModel = Model<MonthlySnapshotDocument>;

export const MonthlySnapshot: MonthlySnapshotModel =
  mongoose.models.MonthlySnapshot ??
  mongoose.model<MonthlySnapshotDocument>("MonthlySnapshot", monthlySnapshotSchema);
