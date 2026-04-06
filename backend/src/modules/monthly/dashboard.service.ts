import type { Types } from "mongoose";
import { AppError } from "../../shared/app-error.js";
import { currentMonthKey } from "../../shared/month-key.js";
import type { CategoryRepository } from "../categories/category.repository.js";
import type { TransactionRepository } from "../transactions/transaction.repository.js";
import type { MonthlySnapshotRepository } from "./monthly-snapshot.repository.js";

/**
 * Read model for dashboard aggregates for a single month snapshot.
 */
export class DashboardService {
  constructor(
    private readonly snapshots: MonthlySnapshotRepository,
    private readonly transactions: TransactionRepository,
    private readonly categories: CategoryRepository
  ) {}

  /**
   * Returns totals, per-category expense breakdown, top expenses, salary and import splits.
   */
  async getDashboard(householdId: Types.ObjectId, snapshotId: Types.ObjectId) {
    const snap = await this.snapshots.findById(snapshotId);
    if (!snap || String(snap.householdId) !== String(householdId)) {
      throw new AppError(404, "NOT_FOUND", "Snapshot not found");
    }

    const byCat = await this.transactions.aggregateTotalsByCategory(snapshotId);
    const byTitle = await this.transactions.aggregateExpenseByCategoryAndTitle(snapshotId);
    const categoryDocs = await this.categories.listForHousehold(householdId);
    const catMap = new Map(categoryDocs.map((c) => [String(c._id), c]));

    const breakdownByCat = new Map<string, { label: string; total: number }[]>();
    const perCategoryLimit = 8;
    for (const row of byTitle) {
      const k = String(row.categoryId);
      const list = breakdownByCat.get(k) ?? [];
      if (list.length >= perCategoryLimit) continue;
      list.push({ label: row.title, total: row.total });
      breakdownByCat.set(k, list);
    }

    const expensesByCategory = byCat.map((row) => {
      const c = catMap.get(String(row.categoryId));
      const catTotal = row.total;
      const parts = breakdownByCat.get(String(row.categoryId)) ?? [];
      const breakdown = parts.map((p) => ({
        label: p.label,
        total: p.total,
        pctOfCategory: catTotal > 0 ? Math.round((p.total / catTotal) * 1000) / 10 : 0,
      }));
      return {
        categoryId: row.categoryId,
        name: c?.name ?? "—",
        color: c?.color ?? "#64748b",
        icon: c?.icon ?? "circle",
        total: row.total,
        breakdown,
      };
    });

    const bySource = await this.transactions.aggregateBySource(snapshotId);
    const salary = await this.transactions.salaryIncomeTotals(snapshotId);

    let manualCount = 0;
    let importedCount = 0;
    for (const row of bySource) {
      if (row.source === "manual" || row.source === "recurring_income") manualCount += row.count;
      if (row.source === "invoice" || row.source === "bank_statement") importedCount += row.count;
    }

    const calendarKey = currentMonthKey();

    return {
      monthKey: snap.monthKey,
      isClosed: snap.isClosed,
      snapshot: {
        monthKey: snap.monthKey,
        status: snap.status,
        isClosed: snap.isClosed,
        isCurrentCalendarMonth: snap.monthKey === calendarKey,
        transactionCount: snap.transactionCount ?? 0,
        closedAt: snap.closedAt,
        carriedFixedIncome: snap.carriedFixedIncome ?? false,
      },
      totals: {
        totalIncome: snap.totalIncome,
        totalExpenses: snap.totalExpenses,
        balance: snap.balance,
      },
      salaryBreakdown: {
        mySalary: salary.me,
        wifeSalary: salary.wife,
        otherRecurringIncome: salary.other,
      },
      entriesBySource: bySource.map((r) => ({
        source: r.source,
        count: r.count,
        incomeSum: r.incomeSum,
        expenseSum: r.expenseSum,
      })),
      importSummary: {
        manualOrRecurringCount: manualCount,
        importedCount,
      },
      expensesByCategory,
    };
  }
}
