/**
 * Best-effort payment channel guess from OCR/PDF line text (PT-BR).
 */
export type PaymentHintKind = "pix" | "card" | "debit" | "transfer" | "boleto" | "unknown";

/**
 * Infers payment hint from raw statement line + title for preview summaries.
 */
export function inferPaymentHintFromText(raw: string, title: string): PaymentHintKind {
  const t = `${raw} ${title}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");

  const pixLike =
    /\bpix\b/.test(t) ||
    /\bvia\s+pix\b/.test(t) ||
    /\bpagamento\s+pix\b/.test(t) ||
    /\brecebimento\s+pix\b/.test(t) ||
    /\bpix\s*[-–/]/.test(t) ||
    /\bpix\s+(enviad|receb)/.test(t) ||
    /pix\s+(enviad|receb)/.test(t) ||
    /\benviad[oa]?\s+por\s+pix\b/.test(t) ||
    /\btransf(erencia)?\.?\s+pix\b/.test(t) ||
    /\btransferencia\s+pix\b/.test(t) ||
    /\bpix\s+qr\b/.test(t) ||
    /\bqr\s*pix\b/.test(t) ||
    /\bpix\s+ted\b/.test(t) ||
    /\bted\s+pix\b/.test(t);
  if (pixLike) return "pix";

  if (/\bboleto\b/.test(t)) return "boleto";
  if (/\b(ted|doc|transfer[eê]ncia|transferencia)\b/.test(t)) return "transfer";
  if (/\b(d[eé]bito|debito)\b/.test(t)) return "debit";
  if (/\b(cart[aã]o|cr[eé]dito|credito|cred\.)\b/.test(t)) return "card";
  return "unknown";
}
