export type BootstrapResponse = {
  householdId: string;
  householdName: string;
  snapshotId: string;
  monthKey: string;
  isClosed: boolean;
  calendarMonthKey: string;
  snapshotStatus?: string;
};

export type SnapshotRow = {
  _id: string;
  monthKey: string;
  isClosed: boolean;
  status?: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount?: number;
  carriedFixedIncome?: boolean;
  closedAt?: string | null;
};

export type DashboardResponse = {
  monthKey: string;
  isClosed: boolean;
  snapshot: {
    monthKey: string;
    status?: string;
    isClosed: boolean;
    isCurrentCalendarMonth: boolean;
    transactionCount: number;
    closedAt?: string | null;
    carriedFixedIncome: boolean;
  };
  totals: { totalIncome: number; totalExpenses: number; balance: number };
  salaryBreakdown: {
    mySalary: number;
    wifeSalary: number;
    otherRecurringIncome: number;
  };
  entriesBySource: {
    source: string;
    count: number;
    incomeSum: number;
    expenseSum: number;
  }[];
  importSummary: {
    manualOrRecurringCount: number;
    importedCount: number;
  };
  expensesByCategory: {
    categoryId: string;
    name: string;
    color: string;
    icon: string;
    total: number;
    breakdown: { label: string; total: number; pctOfCategory: number }[];
  }[];
};

export type MonthSummaryExpenseChartSlice = {
  name: string;
  total: number;
  percentOfExpenses: number;
  color: string;
};

export type MonthSummaryResponse = {
  monthKey: string;
  monthLabel: string;
  totals: { totalIncome: number; totalExpenses: number; balance: number };
  mainCategories: { name: string; total: number; percentOfExpenses: number; color: string }[];
  /** All expense categories for the donut (top slices + "Outros" when many). */
  expenseChart?: MonthSummaryExpenseChartSlice[];
  highestCategory: { name: string; total: number; percentOfExpenses: number } | null;
  highestExpense: { title: string; amount: number; categoryName: string } | null;
  narrative: string;
  highlights: string[];
};

export type TransactionRow = {
  _id: string;
  title: string;
  description?: string;
  amount: number;
  type: "income" | "expense";
  categoryId: string;
  date: string;
  paymentMethod: string;
  notes?: string;
  source?: string;
  extractedConfidence?: number;
  rawText?: string | null;
  parsedFromText?: string | null;
};

export type QuickTransactionInstallmentResponse = {
  installmentPlan: true;
  count: number;
  transactions: TransactionRow[];
};

export type CategoryRow = {
  _id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  isPredefined: boolean;
};

export type StatementPreviewPaymentRow = {
  key: string;
  expenseCount: number;
  incomeCount: number;
  expenseTotal: number;
  incomeTotal: number;
};

export type StatementPreviewLine = {
  title: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  paymentHint: string;
  suggestedCategory: string;
  confidence: number;
};

export type StatementPreviewResponse = {
  fileId: string;
  originalName: string;
  kind: string;
  lineCount: number;
  totals: { expense: number; income: number; net: number };
  paymentSummary: StatementPreviewPaymentRow[];
  /** Sample of lines classified as PIX (full file scan; not limited to general line cap). */
  pixLines?: StatementPreviewLine[];
  lines: StatementPreviewLine[];
};

export type FixedIncomeRow = {
  _id: string;
  owner: "me" | "wife";
  label?: string;
  amount: number;
  description: string;
  active?: boolean;
};
