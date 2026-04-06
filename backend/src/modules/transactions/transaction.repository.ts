import mongoose, { type Types } from "mongoose";
import { Transaction, type TransactionDocument } from "./transaction.model.js";

/**
 * Normalizes id for aggregation $match (avoids type mismatches vs stored ObjectIds).
 */
function snapshotOid(snapshotId: Types.ObjectId): Types.ObjectId {
  return new mongoose.Types.ObjectId(String(snapshotId));
}

/**
 * Persistence access for ledger lines tied to a monthly snapshot.
 */
export class TransactionRepository {
  async listBySnapshot(snapshotId: Types.ObjectId): Promise<TransactionDocument[]> {
    return Transaction.find({ snapshotId }).sort({ date: -1, createdAt: -1 });
  }

  async countBySnapshot(snapshotId: Types.ObjectId): Promise<number> {
    return Transaction.countDocuments({ snapshotId });
  }

  async aggregateTotalsByCategory(snapshotId: Types.ObjectId): Promise<
    { categoryId: Types.ObjectId; total: number }[]
  > {
    const sid = snapshotOid(snapshotId);
    const rows = await Transaction.aggregate<{ _id: Types.ObjectId; total: number }>([
      { $match: { snapshotId: sid, type: "expense" } },
      { $group: { _id: "$categoryId", total: { $sum: "$amount" } } },
    ]);
    return rows.map((r) => ({ categoryId: r._id, total: r.total }));
  }

  /**
   * Expense amounts grouped by category and transaction title (for dashboard drill-down).
   */
  async aggregateExpenseByCategoryAndTitle(
    snapshotId: Types.ObjectId
  ): Promise<{ categoryId: Types.ObjectId; title: string; total: number }[]> {
    const sid = snapshotOid(snapshotId);
    type AggRow = { categoryId: Types.ObjectId; title: string; total: number };
    return Transaction.aggregate<AggRow>([
      { $match: { snapshotId: sid, type: "expense" } },
      {
        $group: {
          _id: { cat: "$categoryId", t: { $ifNull: ["$title", ""] } },
          total: { $sum: "$amount" },
        },
      },
      {
        $project: {
          categoryId: "$_id.cat",
          total: 1,
          title: {
            $let: {
              vars: { tr: { $trim: { input: "$_id.t" } } },
              in: { $cond: [{ $eq: ["$$tr", ""] }, "Sem descrição", "$$tr"] },
            },
          },
          _id: 0,
        },
      },
      { $sort: { categoryId: 1, total: -1 } },
    ]);
  }

  async sumByType(snapshotId: Types.ObjectId): Promise<{ income: number; expense: number }> {
    const sid = snapshotOid(snapshotId);
    const rows = await Transaction.aggregate<{ _id: string; total: number }>([
      { $match: { snapshotId: sid } },
      { $group: { _id: "$type", total: { $sum: "$amount" } } },
    ]);
    let income = 0;
    let expense = 0;
    for (const r of rows) {
      if (r._id === "income") income = r.total;
      if (r._id === "expense") expense = r.total;
    }
    return { income, expense };
  }

  async aggregateBySource(snapshotId: Types.ObjectId): Promise<
    {
      source: string;
      count: number;
      incomeSum: number;
      expenseSum: number;
    }[]
  > {
    const sid = snapshotOid(snapshotId);
    return Transaction.aggregate([
      { $match: { snapshotId: sid } },
      {
        $group: {
          _id: "$source",
          count: { $sum: 1 },
          incomeSum: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
          expenseSum: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
        },
      },
      { $project: { source: "$_id", count: 1, incomeSum: 1, expenseSum: 1, _id: 0 } },
    ]);
  }

  async salaryIncomeTotals(snapshotId: Types.ObjectId): Promise<{ me: number; wife: number; other: number }> {
    const sid = snapshotOid(snapshotId);
    const rows = await Transaction.aggregate<{ _id: string | null; total: number }>([
      {
        $match: {
          snapshotId: sid,
          type: "income",
          $or: [{ source: "recurring_income" }, { fromFixedIncomeId: { $ne: null } }],
        },
      },
      { $group: { _id: "$subcategory", total: { $sum: "$amount" } } },
    ]);
    let me = 0;
    let wife = 0;
    let other = 0;
    for (const r of rows) {
      if (r._id === "me") me += r.total;
      else if (r._id === "wife") wife += r.total;
      else other += r.total;
    }
    return { me, wife, other };
  }

  async create(data: Partial<TransactionDocument> & Record<string, unknown>): Promise<TransactionDocument> {
    return Transaction.create(data);
  }

  async findById(id: Types.ObjectId): Promise<TransactionDocument | null> {
    return Transaction.findById(id);
  }

  async update(
    id: Types.ObjectId,
    patch: Partial<
      Pick<
        TransactionDocument,
        "title" | "description" | "amount" | "categoryId" | "subcategory" | "date" | "paymentMethod" | "notes"
      >
    >
  ): Promise<TransactionDocument | null> {
    return Transaction.findByIdAndUpdate(id, { $set: patch }, { new: true });
  }

  async delete(id: Types.ObjectId): Promise<boolean> {
    const res = await Transaction.deleteOne({ _id: id });
    return res.deletedCount === 1;
  }

  /**
   * Removes ledger lines materialized from a fixed-income template in one snapshot (before re-upsert).
   */
  async deleteBySnapshotAndFixedIncome(
    snapshotId: Types.ObjectId,
    fromFixedIncomeId: Types.ObjectId
  ): Promise<void> {
    const sid = snapshotOid(snapshotId);
    await Transaction.deleteMany({ snapshotId: sid, fromFixedIncomeId });
  }
}
