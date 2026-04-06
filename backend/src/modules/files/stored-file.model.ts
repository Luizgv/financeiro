import mongoose, { Schema, type HydratedDocument, type InferSchemaType, type Model } from "mongoose";

const FILE_KINDS = ["credit_card_invoice", "bank_statement", "other"] as const;

const EXTRACTION_STATUSES = ["pending", "processing", "done", "failed"] as const;

const storedFileSchema = new Schema(
  {
    householdId: { type: Schema.Types.ObjectId, ref: "Household", required: true },
    snapshotId: { type: Schema.Types.ObjectId, ref: "MonthlySnapshot", default: null },
    monthKey: { type: String, trim: true },
    kind: { type: String, enum: FILE_KINDS, default: "other" },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    storageRelativePath: { type: String, required: true },
    extractionStatus: { type: String, enum: EXTRACTION_STATUSES, default: "pending" },
    extractionError: { type: String, default: null },
    transactionsCreatedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

storedFileSchema.index({ householdId: 1, monthKey: 1 });

export type StoredFileKind = (typeof FILE_KINDS)[number];
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

type StoredFileRaw = InferSchemaType<typeof storedFileSchema>;
export type StoredFileDocument = HydratedDocument<StoredFileRaw>;
export type StoredFileModel = Model<StoredFileDocument>;

export const StoredFile: StoredFileModel =
  mongoose.models.StoredFile ?? mongoose.model<StoredFileDocument>("StoredFile", storedFileSchema);
