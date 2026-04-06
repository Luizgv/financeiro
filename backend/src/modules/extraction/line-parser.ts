import { inferCategorySlug } from "../categories/category-inference.js";
import type { StoredFileKind } from "../files/stored-file.model.js";

export type ParsedStatementLine = {
  title: string;
  amount: number;
  type: "income" | "expense";
  date: Date;
  confidence: number;
  rawLine: string;
};

const AMOUNT_RE = /-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+[.,]\d{2}|\d+/g;

const INCOME_WORDS =
  /\b(cr[eé]dito|cred\.|pix\s*receb|recebido|ted.*c|deposito|dep[oó]sito|sal[aá]rio|holerite|rendimento|transferência recebida)\b/i;

const SKIP_LINE = /^\s*(saldo|total\s+due|limite|fatura|page\s+\d)/i;

/**
 * Heuristic line parser for Brazilian statements and card PDFs (best-effort).
 */
export function parseStatementText(text: string, kind: StoredFileKind): ParsedStatementLine[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedStatementLine[] = [];
  const now = new Date();

  for (const rawLine of lines.slice(0, 400)) {
    if (rawLine.length < 4 || SKIP_LINE.test(rawLine)) continue;

    const matches = [...rawLine.matchAll(AMOUNT_RE)];
    if (matches.length === 0) continue;

    const last = matches[matches.length - 1];
    const rawAmt = parseBrAmount(last[0]);
    if (rawAmt == null) continue;
    const amount = Math.abs(rawAmt);
    if (amount < 0.01) continue;

    let title = (rawLine.slice(0, last.index) + rawLine.slice((last.index ?? 0) + last[0].length))
      .replace(/\s+/g, " ")
      .trim();
    if (!title || title.length < 2) title = "Lançamento importado";

    const parsedDate = parseLeadingDate(rawLine) ?? now;
    const incomeHint = INCOME_WORDS.test(rawLine) || INCOME_WORDS.test(title);
    let type: "income" | "expense" = "expense";
    if (kind === "bank_statement" && incomeHint) type = "income";
    if (kind === "credit_card_invoice") type = "expense";

    const neg = rawAmt < 0;
    if (kind === "bank_statement" && neg) type = "expense";

    let confidence = 0.42;
    if (parsedDate.getTime() !== now.getTime()) confidence += 0.15;
    if (inferCategorySlug(title.toLowerCase()) !== "other") confidence += 0.12;
    if (incomeHint && type === "income") confidence += 0.1;
    confidence = Math.min(0.92, confidence);

    out.push({
      title: title.slice(0, 200),
      amount,
      type,
      date: parsedDate,
      confidence,
      rawLine: rawLine.slice(0, 500),
    });
  }

  return out;
}

function parseBrAmount(token: string): number | null {
  const t = token.trim();
  const neg = t.startsWith("-");
  const n = t.replace("-", "").replace(/\./g, "").replace(",", ".");
  const v = Number.parseFloat(n);
  if (Number.isNaN(v)) return null;
  return neg ? -v : v;
}

function parseLeadingDate(line: string): Date | null {
  const m = line.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (!m) return null;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const d = new Date(y, Number(m[2]) - 1, Number(m[1]), 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function categorySlugForParsedLine(title: string, type: "income" | "expense"): string {
  if (type === "income") return "income-fixed";
  const slug = inferCategorySlug(title.toLowerCase());
  return slug === "other" ? "other" : slug;
}
