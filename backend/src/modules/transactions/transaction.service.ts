import type { Types } from "mongoose";
import { AppError } from "../../shared/app-error.js";
import { addMonthsToMonthKey, startOfMonthFromKey } from "../../shared/month-key.js";
import type { CategoryRepository } from "../categories/category.repository.js";
import type { MonthlySnapshotRepository } from "../monthly/monthly-snapshot.repository.js";
import type { MonthlyLifecycleService } from "../monthly/monthly-lifecycle.service.js";
import { parseTransactionText, type ParsedQuickTransaction } from "./transaction-text-parser.js";
import type { PaymentMethod, TransactionSource, TransactionType, TransactionDocument } from "./transaction.model.js";
import type { TransactionRepository } from "./transaction.repository.js";

export type CreateTransactionInput = {
  householdId: Types.ObjectId;
  snapshotId: Types.ObjectId;
  title: string;
  description?: string;
  amount: number;
  type: TransactionType;
  categoryId: Types.ObjectId;
  subcategory?: string;
  date: Date;
  paymentMethod: PaymentMethod;
  notes?: string;
  source?: TransactionSource;
  extractedConfidence?: number;
  rawText?: string | null;
  parsedFromText?: string | null;
  storedFileId?: Types.ObjectId | null;
  fromFixedIncomeId?: Types.ObjectId | null;
};

export type CreateTransactionRowInput = Omit<CreateTransactionInput, "householdId" | "snapshotId">;

/**
 * Application service for creating and mutating transactions with month guards.
 */
export class TransactionService {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly snapshots: MonthlySnapshotRepository,
    private readonly categories: CategoryRepository,
    private readonly lifecycle: MonthlyLifecycleService
  ) {}

  /**
   * Parses quick text and persists one transaction, or N installment expenses across consecutive months.
   */
  async createFromQuickText(
    householdId: Types.ObjectId,
    snapshotId: Types.ObjectId,
    text: string,
    categoryIdOverride?: Types.ObjectId
  ): Promise<TransactionDocument | TransactionDocument[]> {
    const snapshot = await this.requireWritableSnapshot(snapshotId);
    if (String(snapshot.householdId) !== String(householdId)) {
      throw new AppError(403, "FORBIDDEN", "Snapshot does not belong to household");
    }

    const parsed = parseTransactionText(text);
    let slug = parsed.inferredCategorySlug;
    if (parsed.type === "income" && slug === "other") {
      slug = "income-fixed";
    }
    const category =
      categoryIdOverride != null
        ? await this.categories.findById(categoryIdOverride)
        : await this.categories.findBySlugForHousehold(slug, householdId);

    if (!category) {
      throw new AppError(400, "CATEGORY_NOT_FOUND", "Category could not be resolved");
    }

    if (parsed.installments && parsed.type === "expense") {
      return this.createInstallmentSeries(householdId, snapshotId, parsed, category._id, text);
    }

    return this.create({
      householdId,
      snapshotId,
      title: parsed.title,
      description: parsed.title,
      amount: parsed.amount,
      type: parsed.type,
      categoryId: category._id,
      date: new Date(),
      paymentMethod: parsed.inferredPaymentMethod,
      parsedFromText: text,
      source: "manual",
      extractedConfidence: parsed.confidence,
    });
  }

  /**
   * Creates one expense per installment month (current month = parcela 1/N).
   */
  private async createInstallmentSeries(
    householdId: Types.ObjectId,
    anchorSnapshotId: Types.ObjectId,
    parsed: ParsedQuickTransaction,
    categoryId: Types.ObjectId,
    text: string
  ): Promise<TransactionDocument[]> {
    const anchor = await this.requireWritableSnapshot(anchorSnapshotId);
    const inst = parsed.installments!;
    const docs: TransactionDocument[] = [];
    for (let i = 0; i < inst.count; i++) {
      const monthKey = addMonthsToMonthKey(anchor.monthKey, i);
      const snap = await this.snapshots.ensureOpenSnapshotForMonth(householdId, monthKey);
      const title = `${parsed.title} (${i + 1}/${inst.count})`;
      const doc = await this.create({
        householdId,
        snapshotId: snap._id,
        title,
        description: parsed.title,
        amount: inst.amountEach,
        type: "expense",
        categoryId,
        date: startOfMonthFromKey(monthKey),
        paymentMethod: parsed.inferredPaymentMethod,
        notes: `Parcela ${i + 1}/${inst.count}`,
        parsedFromText: text,
        source: "manual",
        extractedConfidence: parsed.confidence,
      });
      docs.push(doc);
    }
    return docs;
  }

  async create(input: CreateTransactionInput) {
    const snap = await this.requireWritableSnapshot(input.snapshotId);
    const doc = await this.transactions.create({
      householdId: input.householdId,
      snapshotId: input.snapshotId,
      monthKey: snap.monthKey,
      title: input.title,
      description: input.description ?? "",
      amount: input.amount,
      type: input.type,
      categoryId: input.categoryId,
      subcategory: input.subcategory,
      date: input.date,
      paymentMethod: input.paymentMethod,
      notes: input.notes,
      source: input.source ?? "manual",
      extractedConfidence: input.extractedConfidence,
      rawText: input.rawText ?? null,
      parsedFromText: input.parsedFromText ?? null,
      storedFileId: input.storedFileId ?? null,
      fromFixedIncomeId: input.fromFixedIncomeId ?? null,
    });
    await this.lifecycle.recalculateTotals(input.snapshotId);
    return doc;
  }

  /**
   * Inserts many rows then recalculates once (used by extraction pipeline).
   */
  async createBatch(
    householdId: Types.ObjectId,
    snapshotId: Types.ObjectId,
    rows: CreateTransactionRowInput[]
  ) {
    const snap = await this.requireWritableSnapshot(snapshotId);
    if (String(snap.householdId) !== String(householdId)) {
      throw new AppError(403, "FORBIDDEN", "Snapshot does not belong to household");
    }
    for (const row of rows) {
      await this.transactions.create({
        householdId,
        snapshotId,
        monthKey: snap.monthKey,
        title: row.title,
        description: row.description ?? "",
        amount: row.amount,
        type: row.type,
        categoryId: row.categoryId,
        subcategory: row.subcategory,
        date: row.date,
        paymentMethod: row.paymentMethod,
        notes: row.notes,
        source: row.source ?? "manual",
        extractedConfidence: row.extractedConfidence,
        rawText: row.rawText ?? null,
        parsedFromText: row.parsedFromText ?? null,
        storedFileId: row.storedFileId ?? null,
        fromFixedIncomeId: row.fromFixedIncomeId ?? null,
      });
    }
    await this.lifecycle.recalculateTotals(snapshotId);
    return rows.length;
  }

  async update(
    snapshotId: Types.ObjectId,
    transactionId: Types.ObjectId,
    patch: Partial<{
      title: string;
      description: string;
      amount: number;
      categoryId: Types.ObjectId;
      subcategory: string;
      date: Date;
      paymentMethod: PaymentMethod;
      notes: string;
    }>
  ) {
    await this.requireWritableSnapshot(snapshotId);
    const tx = await this.transactions.findById(transactionId);
    if (!tx || String(tx.snapshotId) !== String(snapshotId)) {
      throw new AppError(404, "NOT_FOUND", "Transaction not found");
    }
    const updated = await this.transactions.update(transactionId, patch);
    await this.lifecycle.recalculateTotals(snapshotId);
    return updated;
  }

  async delete(snapshotId: Types.ObjectId, transactionId: Types.ObjectId) {
    await this.requireWritableSnapshot(snapshotId);
    const tx = await this.transactions.findById(transactionId);
    if (!tx || String(tx.snapshotId) !== String(snapshotId)) {
      throw new AppError(404, "NOT_FOUND", "Transaction not found");
    }
    await this.transactions.delete(transactionId);
    await this.lifecycle.recalculateTotals(snapshotId);
    return { ok: true };
  }

  private async requireWritableSnapshot(snapshotId: Types.ObjectId) {
    const snap = await this.snapshots.findById(snapshotId);
    if (!snap) throw new AppError(404, "NOT_FOUND", "Month snapshot not found");
    if (snap.isClosed) {
      throw new AppError(409, "MONTH_CLOSED", "This month is read-only");
    }
    return snap;
  }
}
