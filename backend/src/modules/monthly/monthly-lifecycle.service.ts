import type { Types } from "mongoose";
import { compareMonthKeys, currentMonthKey } from "../../shared/month-key.js";
import { AppError } from "../../shared/app-error.js";
import { isMongoDuplicateKeyError } from "../../shared/mongo-error.js";
import type { CategoryRepository } from "../categories/category.repository.js";
import type { FixedIncomeRepository } from "../incomes/fixed-income.repository.js";
import type { TransactionRepository } from "../transactions/transaction.repository.js";
import type { MonthlySnapshotRepository } from "./monthly-snapshot.repository.js";
import type { MonthlySnapshotDocument } from "./monthly-snapshot.model.js";
import type { FixedIncomeDocument } from "../incomes/fixed-income.model.js";

/**
 * Owns month rollover: closes past open months, creates the current snapshot, copies fixed incomes only.
 */
export class MonthlyLifecycleService {
  constructor(
    private readonly snapshots: MonthlySnapshotRepository,
    private readonly fixedIncomes: FixedIncomeRepository,
    private readonly transactions: TransactionRepository,
    private readonly categories: CategoryRepository
  ) {}

  /**
   * Ensures the household has a snapshot for the calendar month and prior months are closed.
   */
  async ensureCurrentMonth(householdId: Types.ObjectId): Promise<MonthlySnapshotDocument> {
    const todayKey = currentMonthKey();
    const existing = await this.snapshots.findByHouseholdAndMonth(householdId, todayKey);
    if (existing) {
      await this.closeStaleOpenSnapshots(householdId, todayKey);
      await this.snapshots.markActiveMetadata(existing._id);
      await this.syncFixedIncomesToOpenSnapshots(householdId);
      return existing;
    }

    await this.closeStaleOpenSnapshots(householdId, todayKey);

    let created: MonthlySnapshotDocument;
    try {
      created = await this.snapshots.create({ householdId, monthKey: todayKey });
    } catch (err: unknown) {
      if (!isMongoDuplicateKeyError(err)) throw err;
      const raced = await this.snapshots.findByHouseholdAndMonth(householdId, todayKey);
      if (!raced) throw err;
      await this.closeStaleOpenSnapshots(householdId, todayKey);
      await this.snapshots.markActiveMetadata(raced._id);
      return raced;
    }

    await this.materializeFixedIncomes(householdId, created._id, todayKey);
    await this.recalculateTotals(created._id);
    return (await this.snapshots.findById(created._id))!;
  }

  private async closeStaleOpenSnapshots(householdId: Types.ObjectId, todayKey: string): Promise<void> {
    const stale = await this.snapshots.findOpenBeforeMonth(householdId, todayKey);
    for (const s of stale) {
      await this.snapshots.close(s._id);
    }
  }

  private async materializeFixedIncomes(
    householdId: Types.ObjectId,
    snapshotId: Types.ObjectId,
    monthKey: string
  ): Promise<void> {
    const incomeCategory = await this.categories.findBySlugForHousehold("income-fixed", null);
    if (!incomeCategory) {
      throw new AppError(500, "SEED_MISSING", "Category income-fixed is not seeded");
    }

    const templates = await this.fixedIncomes.listByHousehold(householdId);
    const startOfMonth = startOfMonthDate(monthKey);

    for (const fi of templates) {
      await this.upsertFixedIncomeTransaction(
        householdId,
        snapshotId,
        monthKey,
        fi,
        incomeCategory._id,
        startOfMonth
      );
    }
  }

  /**
   * Keeps income transactions aligned with fixed-income templates for open months up to the calendar month.
   * Future months (e.g. created for installments) stay without materialized salaries until that month is current.
   */
  async syncFixedIncomesToOpenSnapshots(householdId: Types.ObjectId): Promise<void> {
    const incomeCategory = await this.categories.findBySlugForHousehold("income-fixed", null);
    if (!incomeCategory) {
      throw new AppError(500, "SEED_MISSING", "Category income-fixed is not seeded");
    }

    const todayKey = currentMonthKey();
    const open = await this.snapshots.listOpenByHousehold(householdId);
    const templates = await this.fixedIncomes.listByHousehold(householdId);
    for (const snap of open) {
      const isFutureMonth = compareMonthKeys(snap.monthKey, todayKey) > 0;
      if (isFutureMonth) {
        for (const fi of templates) {
          await this.transactions.deleteBySnapshotAndFixedIncome(snap._id, fi._id);
        }
        await this.recalculateTotals(snap._id);
        continue;
      }

      const startOfMonth = startOfMonthDate(snap.monthKey);
      for (const fi of templates) {
        await this.upsertFixedIncomeTransaction(
          householdId,
          snap._id,
          snap.monthKey,
          fi,
          incomeCategory._id,
          startOfMonth
        );
      }
      await this.recalculateTotals(snap._id);
    }
  }

  private async upsertFixedIncomeTransaction(
    householdId: Types.ObjectId,
    snapshotId: Types.ObjectId,
    monthKey: string,
    fi: FixedIncomeDocument,
    categoryId: Types.ObjectId,
    date: Date
  ): Promise<void> {
    await this.transactions.deleteBySnapshotAndFixedIncome(snapshotId, fi._id);
    if (fi.amount <= 0) return;
    const title = (fi.label && String(fi.label).trim()) || fi.description;
    await this.transactions.create({
      householdId,
      snapshotId,
      monthKey,
      title,
      amount: fi.amount,
      type: "income",
      categoryId,
      subcategory: fi.owner,
      date,
      paymentMethod: "transfer",
      fromFixedIncomeId: fi._id,
      source: "recurring_income",
    });
  }

  /**
   * Recomputes denormalized totals on the snapshot from its transactions.
   */
  async recalculateTotals(snapshotId: Types.ObjectId): Promise<void> {
    const { income, expense } = await this.transactions.sumByType(snapshotId);
    const balance = income - expense;
    const transactionCount = await this.transactions.countBySnapshot(snapshotId);
    await this.snapshots.updateTotals(snapshotId, {
      totalIncome: income,
      totalExpenses: expense,
      balance,
      transactionCount,
    });
  }
}

function startOfMonthDate(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1, 12, 0, 0, 0);
}

function endOfMonthDate(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999);
}
