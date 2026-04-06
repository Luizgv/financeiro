import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const TRANSACTION_TYPES = ["income", "expense"] as const;

const PAYMENT_METHODS = ["card", "pix", "cash", "debit", "transfer", "other"] as const;

const TRANSACTION_SOURCES = ["manual", "invoice", "bank_statement", "recurring_income"] as const;

const transactionSchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", required: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "MonthlySnapshot", required: true },
    monthKey: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    amount: { type: Number, required: true, min: 0 },
    type: { type: String, enum: TRANSACTION_TYPES, required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subcategory: { type: String, trim: true },
    date: { type: Date, required: true },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "other" },
    notes: { type: String, trim: true },
    source: { type: String, enum: TRANSACTION_SOURCES, default: "manual", required: true },
    extractedConfidence: { type: Number, min: 0, max: 1 },
    rawText: { type: String, default: null },
    fromFixedIncomeId: { type: Schema.Types.ObjectId, ref: "FixedIncome", default: null },
    /** Same id on every row of a quick-add installment plan (delete one removes all). */
    installmentGroupId: { type: Schema.Types.ObjectId, default: null },
    parsedFromText: { type: String, default: null },
    storedFileId: { type: Schema.Types.ObjectId, ref: "StoredFile", default: null },
  },
  { timestamps: true }
);

transactionSchema.index({ snapshotId: 1, date: -1 });
transactionSchema.index({ householdId: 1, monthKey: 1 });
transactionSchema.index({ snapshotId: 1, source: 1 });
transactionSchema.index({ householdId: 1, installmentGroupId: 1 }, { sparse: true });

export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type TransactionSource = (typeof TRANSACTION_SOURCES)[number];

type TransactionRaw = InferSchemaType<typeof transactionSchema>;
export type TransactionDocument = HydratedDocument<TransactionRaw>;

export type TransactionModel = Model<TransactionDocument>;

export const Transaction: TransactionModel =
  mongoose.models.Transaction ?? mongoose.model<TransactionDocument>("Transaction", transactionSchema);
