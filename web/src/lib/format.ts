const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Formats a number as BRL for display.
 */
export function formatBrl(value: number): string {
  return brl.format(value);
}
