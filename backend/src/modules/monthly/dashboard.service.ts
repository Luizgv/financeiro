import type { Types } from "mongoose";
import { AppError } from "../../shared/app-error.js";
import { currentMonthKey } from "../../shared/month-key.js";
import type { CategoryRepository } from "../categories/category.repository.js";
import type { TransactionRepository } from "../transactions/transaction.repository.js";
import type { MonthlySnapshotRepository } from "./monthly-snapshot.repository.js";

function formatBrlPt(n: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function monthKeyToLabelPt(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

  /**
   * Builds a read-only textual and structured month summary from dashboard data and ledger.
   */
  async getMonthSummary(householdId: Types.ObjectId, snapshotId: Types.ObjectId) {
    const dash = await this.getDashboard(householdId, snapshotId);
    const totalIncome = dash.totals.totalIncome;
    const totalExpenses = dash.totals.totalExpenses;
    const balance = dash.totals.balance;
    const monthLabel = monthKeyToLabelPt(dash.monthKey);

    const categoriesSorted = [...dash.expensesByCategory].sort((a, b) => b.total - a.total);
    const mainCategories = categoriesSorted.slice(0, 5).map((c) => ({
      name: c.name,
      total: Math.round(c.total * 100) / 100,
      percentOfExpenses:
        totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 1000) / 10 : 0,
      color: c.color ?? "#64748b",
    }));

    const withExpense = categoriesSorted.filter((c) => c.total > 0);
    const maxSlices = 10;
    let expenseChart: { name: string; total: number; percentOfExpenses: number; color: string }[];
    if (withExpense.length === 0) {
      expenseChart = [];
    } else if (withExpense.length <= maxSlices) {
      expenseChart = withExpense.map((c) => ({
        name: c.name,
        total: Math.round(c.total * 100) / 100,
        percentOfExpenses:
          totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 1000) / 10 : 0,
        color: c.color ?? "#64748b",
      }));
    } else {
      const head = withExpense.slice(0, maxSlices - 1);
      const tail = withExpense.slice(maxSlices - 1);
      const othersTotal = tail.reduce((s, c) => s + c.total, 0);
      expenseChart = [
        ...head.map((c) => ({
          name: c.name,
          total: Math.round(c.total * 100) / 100,
          percentOfExpenses:
            totalExpenses > 0 ? Math.round((c.total / totalExpenses) * 1000) / 10 : 0,
          color: c.color ?? "#64748b",
        })),
        {
          name: "Outros",
          total: Math.round(othersTotal * 100) / 100,
          percentOfExpenses:
            totalExpenses > 0 ? Math.round((othersTotal / totalExpenses) * 1000) / 10 : 0,
          color: "#64748b",
        },
      ];
    }

    const highestCategory =
      categoriesSorted[0] && categoriesSorted[0].total > 0
        ? {
            name: categoriesSorted[0].name,
            total: Math.round(categoriesSorted[0].total * 100) / 100,
            percentOfExpenses:
              totalExpenses > 0
                ? Math.round((categoriesSorted[0].total / totalExpenses) * 1000) / 10
                : 0,
          }
        : null;

    const largest = await this.transactions.findLargestExpense(snapshotId);
    let highestExpense: { title: string; amount: number; categoryName: string } | null = null;
    if (largest && largest.amount > 0) {
      const cat = await this.categories.findById(largest.categoryId);
      highestExpense = {
        title: largest.title || "Despesa",
        amount: Math.round(largest.amount * 100) / 100,
        categoryName: cat?.name ?? "—",
      };
    }

    const incStr = formatBrlPt(totalIncome);
    const expStr = formatBrlPt(totalExpenses);
    const balStr = formatBrlPt(balance);

    let narrative: string;
    if (totalExpenses === 0 && totalIncome === 0) {
      narrative = `Em ${monthLabel} ainda não há entradas nem saídas registradas neste período.`;
    } else if (totalExpenses === 0 && totalIncome > 0) {
      narrative = `Em ${monthLabel}, suas entradas somaram ${incStr} e não há despesas registradas. O saldo ficou em ${balStr}.`;
    } else {
      narrative = `Em ${monthLabel}, suas entradas somaram ${incStr} e suas saídas ${expStr}. O saldo do mês ficou em ${balStr}.`;
      if (highestCategory && totalExpenses > 0) {
        narrative += ` O maior volume de gastos foi em ${highestCategory.name} (${formatBrlPt(highestCategory.total)}, cerca de ${highestCategory.percentOfExpenses}% das despesas).`;
      }
      if (highestExpense) {
        narrative += ` O maior lançamento de despesa foi "${highestExpense.title}" (${highestExpense.categoryName}): ${formatBrlPt(highestExpense.amount)}.`;
      }
    }

    const highlights: string[] = [
      `Entradas do mês: ${incStr}`,
      `Saídas do mês: ${expStr}`,
      `Saldo: ${balStr}`,
    ];
    if (highestCategory && totalExpenses > 0) {
      highlights.push(
        `Categoria que mais concentrou gastos: ${highestCategory.name} (${formatBrlPt(highestCategory.total)})`
      );
    }
    if (highestExpense) {
      highlights.push(
        `Maior despesa individual: ${highestExpense.title} — ${formatBrlPt(highestExpense.amount)}`
      );
    }

    return {
      monthKey: dash.monthKey,
      monthLabel,
      totals: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpenses: Math.round(totalExpenses * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      },
      mainCategories,
      expenseChart,
      highestCategory,
      highestExpense,
      narrative,
      highlights,
    };
  }
}
