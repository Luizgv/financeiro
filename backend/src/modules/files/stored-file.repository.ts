import type { Types } from "mongoose";
import { StoredFile, type ExtractionStatus, type StoredFileDocument } from "./stored-file.model.js";

/**
 * Persistence access for uploaded statement metadata.
 */
export class StoredFileRepository {
  async findById(id: Types.ObjectId): Promise<StoredFileDocument | null> {
    return StoredFile.findById(id);
  }

  async listByHouseholdAndMonth(householdId: Types.ObjectId, monthKey: string): Promise<StoredFileDocument[]> {
    return StoredFile.find({ householdId, monthKey }).sort({ createdAt: -1 });
  }

  async create(data: {
    householdId: Types.ObjectId;
    snapshotId?: Types.ObjectId | null;
    monthKey?: string;
    kind: "credit_card_invoice" | "bank_statement" | "other";
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storageRelativePath: string;
  }): Promise<StoredFileDocument> {
    return StoredFile.create({
      ...data,
      extractionStatus: "pending",
      extractionError: null,
      transactionsCreatedCount: 0,
    });
  }

  async setExtractionStatus(
    id: Types.ObjectId,
    status: ExtractionStatus,
    error: string | null
  ): Promise<void> {
    await StoredFile.updateOne({ _id: id }, { $set: { extractionStatus: status, extractionError: error } });
  }

  async setExtractionDone(id: Types.ObjectId, createdCount: number): Promise<void> {
    await StoredFile.updateOne(
      { _id: id },
      { $set: { extractionStatus: "done", transactionsCreatedCount: createdCount, extractionError: null } }
    );
  }

  async setExtractionFailed(id: Types.ObjectId, message: string): Promise<void> {
    await StoredFile.updateOne(
      { _id: id },
      { $set: { extractionStatus: "failed", extractionError: message } }
    );
  }
}
