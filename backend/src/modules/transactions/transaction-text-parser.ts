import { inferCategorySlug } from "../categories/category-inference.js";
import type { PaymentMethod } from "./transaction.model.js";

export type ParsedInstallments = { count: number; amountEach: number };

export type ParsedQuickTransaction = {
  title: string;
  amount: number;
  type: "income" | "expense";
  inferredCategorySlug: string;
  inferredPaymentMethod: PaymentMethod;
  /** 0–1 heuristic confidence for UI hints */
  confidence: number;
  /** When set, create N expenses of amountEach in consecutive months from the active month */
  installments?: ParsedInstallments;
};

const INCOME_HINTS = [
  "salário",
  "salario",
  "freela",
  "reembolso",
  "cashback",
  "esposa",
  "esposo",
  "wife",
  "folha",
  "holerite",
  "depósito salarial",
  "deposito salarial",
  "adiantamento",
];

const PAYMENT_MAP: { words: string[]; method: PaymentMethod }[] = [
  { words: ["cartão", "cartao", "credito", "crédito"], method: "card" },
  { words: ["pix"], method: "pix" },
  { words: ["dinheiro"], method: "cash" },
  { words: ["débito", "debito"], method: "debit" },
  { words: ["transferência", "transferencia", "ted", "doc"], method: "transfer" },
];

const AMOUNT_RE = /\d+(?:[.,]\d{1,2})?/g;

const MAX_INSTALLMENTS = 48;

/** Trailing: `Purificador 3*120`, `3 parcelas de 120`, `3x de 120` */
const INSTALL_END_STAR = /\s+(\d{1,2})\s*[*x×]\s*(\d+(?:[.,]\d{1,2})?)\s*$/i;
const INSTALL_END_PARC = /\s+(\d{1,2})\s+parcelas?\s+de\s+(\d+(?:[.,]\d{1,2})?)\s*$/i;
const INSTALL_END_XDE = /\s+(\d{1,2})\s*x\s*de\s+(\d+(?:[.,]\d{1,2})?)\s*$/i;
/** Leading: `3*120 Purificador` */
const INSTALL_START_STAR = /^(\d{1,2})\s*[*x×]\s*(\d+(?:[.,]\d{1,2})?)\s+/i;

/**
 * Parses a single-line PT-BR quick entry into structured transaction fields.
 */
export function parseTransactionText(raw: string): ParsedQuickTransaction {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty input");
  }

  const normalized = trimmed.toLowerCase();
  let working = trimmed;
  let payment: PaymentMethod = "other";

  outer: for (const { words, method } of PAYMENT_MAP) {
    for (const w of words) {
      const tokenRe = new RegExp(`\\b${escapeRegExp(w)}\\b`, "i");
      if (!tokenRe.test(normalized)) continue;
      payment = method;
      working = working
        .replace(new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi"), " ")
        .replace(/\s+/g, " ")
        .trim();
      break outer;
    }
  }

  const { rest: afterInstall, installments } = extractInstallmentPattern(working);
  working = afterInstall;

  let amount: number;
  let title: string;

  if (installments) {
    amount = installments.amountEach;
    title = working.replace(/\s+/g, " ").trim();
    if (!title) title = "Compra parcelada";
  } else {
    const matches = [...working.matchAll(AMOUNT_RE)];
    if (matches.length === 0) {
      throw new Error("Não foi possível encontrar um valor numérico");
    }
    const last = matches[matches.length - 1];
    amount = parseBrazilianNumber(last[0]);
    if (amount <= 0 || Number.isNaN(amount)) {
      throw new Error("Valor inválido");
    }
    title = `${working.slice(0, last.index)}${working.slice((last.index ?? 0) + last[0].length)}`
      .replace(/\s+/g, " ")
      .trim();
    if (!title) {
      title = "Sem descrição";
    }
  }

  const incomeHint = INCOME_HINTS.some((h) => normalized.includes(h));
  const type: "income" | "expense" = incomeHint ? "income" : "expense";

  let effectiveInstallments = installments;
  if (type === "income" && installments) {
    effectiveInstallments = undefined;
  }

  const slugSource = `${normalized} ${title}`.toLowerCase();
  const inferredCategorySlug = inferCategorySlug(slugSource);
  const categoryHit = inferredCategorySlug !== "other";
  let confidence = 0.55;
  if (incomeHint && type === "income") confidence = 0.88;
  else if (categoryHit) confidence = 0.72;
  if (payment !== "other") confidence = Math.min(0.95, confidence + 0.08);
  if (effectiveInstallments) confidence = Math.min(0.95, confidence + 0.05);

  return {
    title,
    amount,
    type,
    inferredCategorySlug,
    inferredPaymentMethod: payment,
    confidence,
    installments: effectiveInstallments,
  };
}

function extractInstallmentPattern(working: string): {
  rest: string;
  installments?: ParsedInstallments;
} {
  let w = working.trim();

  const tryEnd = (re: RegExp): ParsedInstallments | null => {
    const m = w.match(re);
    if (!m || m.index === undefined) return null;
    const n = Number.parseInt(m[1], 10);
    const a = parseBrazilianNumber(m[2]);
    if (n < 2 || n > MAX_INSTALLMENTS || a <= 0 || Number.isNaN(a)) return null;
    w = w.slice(0, m.index).trim();
    return { count: n, amountEach: a };
  };

  let inst = tryEnd(INSTALL_END_STAR);
  if (!inst) inst = tryEnd(INSTALL_END_PARC);
  if (!inst) inst = tryEnd(INSTALL_END_XDE);
  if (inst) {
    return { rest: w, installments: inst };
  }

  const sm = w.match(INSTALL_START_STAR);
  if (sm) {
    const n = Number.parseInt(sm[1], 10);
    const a = parseBrazilianNumber(sm[2]);
    if (n >= 2 && n <= MAX_INSTALLMENTS && a > 0 && !Number.isNaN(a)) {
      return {
        rest: w.slice(sm[0].length).trim(),
        installments: { count: n, amountEach: a },
      };
    }
  }

  return { rest: working.trim() };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseBrazilianNumber(token: string): number {
  const t = token.replace(/\./g, "").replace(",", ".");
  return Number.parseFloat(t);
}
