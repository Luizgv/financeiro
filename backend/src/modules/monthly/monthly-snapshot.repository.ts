import type { Types } from "mongoose";
import { AppError } from "../../shared/app-error.js";
import { isMongoDuplicateKeyError } from "../../shared/mongo-error.js";
import { MonthlySnapshot, type MonthlySnapshotDocument } from "./monthly-snapshot.model.js";

/**
 * Persistence access for monthly financial snapshots.
 */
export class MonthlySnapshotRepository {
  async findById(id: Types.ObjectId): Promise<MonthlySnapshotDocument | null> {
    return MonthlySnapshot.findById(id);
  }

  async findByHouseholdAndMonth(
    householdId: Types.ObjectId,
    monthKey: string
  ): Promise<MonthlySnapshotDocument | null> {
    return MonthlySnapshot.findOne({ householdId, monthKey });
  }

  async listByHousehold(householdId: Types.ObjectId): Promise<MonthlySnapshotDocument[]> {
    return MonthlySnapshot.find({ householdId }).sort({ monthKey: -1 });
  }

  /** Snapshots still open for editing (salaries and fixed income should stay in sync). */
  async listOpenByHousehold(householdId: Types.ObjectId): Promise<MonthlySnapshotDocument[]> {
    return MonthlySnapshot.find({ householdId, isClosed: false }).sort({ monthKey: -1 });
  }

  async findOpenBeforeMonth(
    householdId: Types.ObjectId,
    beforeMonthKey: string
  ): Promise<MonthlySnapshotDocument[]> {
    return MonthlySnapshot.find({
      householdId,
      isClosed: false,
      monthKey: { $lt: beforeMonthKey },
    });
  }

  async create(input: { householdId: Types.ObjectId; monthKey: string }): Promise<MonthlySnapshotDocument> {
    return MonthlySnapshot.create({
      householdId: input.householdId,
      monthKey: input.monthKey,
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      isClosed: false,
      status: "active",
      transactionCount: 0,
      closedAt: null,
      carriedFixedIncome: true,
    });
  }

  /**
   * Returns an open snapshot for the month, creating one if missing (e.g. future installment months).
   */
  async ensureOpenSnapshotForMonth(
    householdId: Types.ObjectId,
    monthKey: string
  ): Promise<MonthlySnapshotDocument> {
    const existing = await this.findByHouseholdAndMonth(householdId, monthKey);
    if (existing) {
      if (existing.isClosed) {
        throw new AppError(
          409,
          "MONTH_CLOSED",
          `O mês ${monthKey} está fechado. Não dá para lançar parcelas nele.`
        );
      }
      return existing;
    }
    try {
      return await this.create({ householdId, monthKey });
    } catch (err: unknown) {
      if (!isMongoDuplicateKeyError(err)) throw err;
      const raced = await this.findByHouseholdAndMonth(householdId, monthKey);
      if (!raced) throw err;
      if (raced.isClosed) {
        throw new AppError(
          409,
          "MONTH_CLOSED",
          `O mês ${monthKey} está fechado. Não dá para lançar parcelas nele.`
        );
      }
      return raced;
    }
  }

  async updateTotals(
    id: Types.ObjectId,
    totals: { totalIncome: number; totalExpenses: number; balance: number; transactionCount: number }
  ): Promise<void> {
    await MonthlySnapshot.updateOne({ _id: id }, { $set: totals });
  }

  async close(id: Types.ObjectId): Promise<void> {
    await MonthlySnapshot.updateOne(
      { _id: id },
      { $set: { isClosed: true, status: "archived", closedAt: new Date() } }
    );
  }

  /** Marks the only calendar-current snapshot as active (others already archived when closed). */
  async markActiveMetadata(id: Types.ObjectId): Promise<void> {
    await MonthlySnapshot.updateOne({ _id: id }, { $set: { status: "active", isClosed: false } });
  }
}
