import path from "node:path";
import type { Types } from "mongoose";
import type { Env } from "../../config/env.js";
import { AppError } from "../../shared/app-error.js";
import type { CategoryRepository } from "../categories/category.repository.js";
import type { StoredFileRepository } from "../files/stored-file.repository.js";
import type { MonthlySnapshotRepository } from "../monthly/monthly-snapshot.repository.js";
import type { TransactionSource } from "../transactions/transaction.model.js";
import type { TransactionService } from "../transactions/transaction.service.js";
import { categorySlugForParsedLine, parseStatementText } from "./line-parser.js";
import { readUploadAsText } from "./buffer-to-text.js";
import { inferPaymentHintFromText, type PaymentHintKind } from "./payment-hint.js";

const PREVIEW_LINE_CAP = 50;
const PAYMENT_KEYS: PaymentHintKind[] = ["pix", "card", "debit", "transfer", "boleto", "unknown"];

export type StatementPreviewLine = {
  title: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  paymentHint: PaymentHintKind;
  suggestedCategory: string;
  confidence: number;
};

export type StatementPreviewPaymentRow = {
  key: PaymentHintKind;
  expenseCount: number;
  incomeCount: number;
  expenseTotal: number;
  incomeTotal: number;
};

export type StatementPreviewResult = {
  fileId: string;
  originalName: string;
  kind: string;
  lineCount: number;
  totals: { expense: number; income: number; net: number };
  paymentSummary: StatementPreviewPaymentRow[];
  lines: StatementPreviewLine[];
};

/**
 * Runs the extraction pipeline on a stored upload and persists transactions.
 */
export class StatementExtractionService {
  constructor(
    private readonly env: Env,
    private readonly files: StoredFileRepository,
    private readonly snapshots: MonthlySnapshotRepository,
    private readonly categories: CategoryRepository,
    private readonly transactions: TransactionService
  ) {}

  /**
   * Parses upload text and returns a read-only summary (no ledger writes, no stats change).
   */
  async previewFile(householdId: Types.ObjectId, fileId: Types.ObjectId): Promise<StatementPreviewResult> {
    const file = await this.files.findById(fileId);
    if (!file || String(file.householdId) !== String(householdId)) {
      throw new AppError(404, "NOT_FOUND", "Arquivo não encontrado");
    }

    const abs = path.join(this.env.UPLOAD_DIR, file.storageRelativePath);
    const text = await readUploadAsText(abs, file.mimeType, file.originalName);
    if (!text || text.trim().length < 20) {
      throw new AppError(400, "PARSE_EMPTY", "Não foi possível extrair texto suficiente do arquivo.");
    }

    const parsed = parseStatementText(text, file.kind);
    const slugSet = new Set<string>();
    for (const line of parsed) {
      slugSet.add(categorySlugForParsedLine(line.title, line.type));
    }
    const slugToName = new Map<string, string>();
    for (const slug of slugSet) {
      const cat = await this.categories.findBySlugForHousehold(slug, householdId);
      slugToName.set(slug, cat?.name ?? slug);
    }

    const agg = new Map<PaymentHintKind, { ec: number; ic: number; et: number; it: number }>();
    for (const h of PAYMENT_KEYS) agg.set(h, { ec: 0, ic: 0, et: 0, it: 0 });

    let expense = 0;
    let income = 0;
    const lines: StatementPreviewLine[] = [];

    for (const line of parsed) {
      if (line.type === "expense") expense += line.amount;
      else income += line.amount;

      const hint = inferPaymentHintFromText(line.rawLine, line.title);
      const bucket = agg.get(hint)!;
      if (line.type === "expense") {
        bucket.ec += 1;
        bucket.et += line.amount;
      } else {
        bucket.ic += 1;
        bucket.it += line.amount;
      }

      const slug = categorySlugForParsedLine(line.title, line.type);
      if (lines.length < PREVIEW_LINE_CAP) {
        lines.push({
          title: line.title,
          amount: line.amount,
          type: line.type,
          date: line.date.toISOString(),
          paymentHint: hint,
          suggestedCategory: slugToName.get(slug) ?? slug,
          confidence: line.confidence,
        });
      }
    }

    const paymentSummary: StatementPreviewPaymentRow[] = PAYMENT_KEYS.map((key) => {
      const a = agg.get(key)!;
      return {
        key,
        expenseCount: a.ec,
        incomeCount: a.ic,
        expenseTotal: Math.round(a.et * 100) / 100,
        incomeTotal: Math.round(a.it * 100) / 100,
      };
    }).filter((r) => r.expenseCount + r.incomeCount > 0);

    return {
      fileId: String(fileId),
      originalName: file.originalName,
      kind: file.kind,
      lineCount: parsed.length,
      totals: {
        expense: Math.round(expense * 100) / 100,
        income: Math.round(income * 100) / 100,
        net: Math.round((income - expense) * 100) / 100,
      },
      paymentSummary,
      lines,
    };
  }

  /**
   * Parses file text into transactions for the snapshot linked to the upload.
   */
  async extractFile(householdId: Types.ObjectId, fileId: Types.ObjectId): Promise<{ created: number }> {
    const file = await this.files.findById(fileId);
    if (!file || String(file.householdId) !== String(householdId)) {
      throw new AppError(404, "NOT_FOUND", "Arquivo não encontrado");
    }
    if (!file.snapshotId) {
      throw new AppError(400, "NO_SNAPSHOT", "Arquivo sem vínculo com mês");
    }

    const snap = await this.snapshots.findById(file.snapshotId);
    if (!snap || String(snap.householdId) !== String(householdId)) {
      throw new AppError(404, "NOT_FOUND", "Mês não encontrado");
    }
    if (snap.isClosed) {
      throw new AppError(409, "MONTH_CLOSED", "Mês encerrado — não é possível importar");
    }

    await this.files.setExtractionStatus(fileId, "processing", null);

    try {
      const abs = path.join(this.env.UPLOAD_DIR, file.storageRelativePath);
      const text = await readUploadAsText(abs, file.mimeType, file.originalName);
      if (!text || text.trim().length < 20) {
        throw new Error("Não foi possível extrair texto suficiente do arquivo.");
      }

      const parsed = parseStatementText(text, file.kind);
      const rows = [];
      for (const line of parsed) {
        const slug = categorySlugForParsedLine(line.title, line.type);
        const cat = await this.categories.findBySlugForHousehold(slug, householdId);
        if (!cat) continue;
        const source: TransactionSource =
          file.kind === "credit_card_invoice" ? "invoice" : "bank_statement";
        rows.push({
          title: line.title,
          description: line.title,
          amount: line.amount,
          type: line.type,
          categoryId: cat._id,
          date: line.date,
          paymentMethod: "other" as const,
          source,
          extractedConfidence: line.confidence,
          rawText: line.rawLine,
          storedFileId: fileId,
        });
      }

      const n = await this.transactions.createBatch(householdId, file.snapshotId, rows);
      await this.files.setExtractionDone(fileId, n);
      return { created: n };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha na extração";
      await this.files.setExtractionFailed(fileId, msg);
      throw err;
    }
  }
}
