"use client";

import { useState } from "react";

type Props = {
  disabled: boolean;
  onSubmit: (text: string) => Promise<void>;
};

/**
 * Command-bar style input for natural-language expenses.
 */
export function QuickAdd({ disabled, onSubmit }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(text.trim());
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted">
            ›
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={disabled || loading}
            placeholder="Ex: uber 32 · purificador 3*120 · amazon geladeira 12*450"
            className="w-full rounded-xl border border-border bg-card py-3 pl-8 pr-4 font-mono text-sm text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={disabled || loading || !text.trim()}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-40"
        >
          {loading ? "…" : "Adicionar"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <p className="text-xs text-muted">
        Parcelas: <span className="font-mono">descrição N*valor</span> (ex.: purificador 3*120) cria N despesas nos N meses
        seguintes. Palavras-chave sugerem categoria.
      </p>
    </form>
  );
}
