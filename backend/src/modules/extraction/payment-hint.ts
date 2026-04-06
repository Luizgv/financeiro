/**
 * Best-effort payment channel guess from OCR/PDF line text (PT-BR).
 */
export type PaymentHintKind = "pix" | "card" | "debit" | "transfer" | "boleto" | "unknown";

/**
 * Infers payment hint from raw statement line + title for preview summaries.
 */
export function inferPaymentHintFromText(raw: string, title: string): PaymentHintKind {
  const t = `${raw} ${title}`.toLowerCase();
  if (/\bpix\b/.test(t)) return "pix";
  if (/\bboleto\b/.test(t)) return "boleto";
  if (/\b(ted|doc|transfer[eê]ncia|transferencia)\b/.test(t)) return "transfer";
  if (/\b(d[eé]bito|debito)\b/.test(t)) return "debit";
  if (/\b(cart[aã]o|cr[eé]dito|credito|cred\.)\b/.test(t)) return "card";
  return "unknown";
}
