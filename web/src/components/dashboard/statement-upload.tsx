"use client";

import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { apiJson } from "@/lib/api";
import type { StatementPreviewResponse } from "@/lib/types";
import { StatementPreview } from "./statement-preview";

type Props = {
  householdId: string;
  snapshotId: string;
  readOnly: boolean;
};

type StoredFileRow = {
  _id: string;
  originalName: string;
  kind: string;
  extractionStatus?: string;
  transactionsCreatedCount?: number;
};

const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Uploads statement files and shows a read-only preview (no automatic ledger import).
 */
export function StatementUpload({ householdId, snapshotId, readOnly }: Props) {
  const invRef = useRef<HTMLInputElement>(null);
  const stmtRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<StatementPreviewResponse | null>(null);

  const upload = useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: "credit_card_invoice" | "bank_statement" }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch(
        `${base()}/api/households/${householdId}/snapshots/${snapshotId}/files`,
        { method: "POST", body: fd }
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text);
      return JSON.parse(text) as StoredFileRow & { _id: string };
    },
  });

  const previewMutation = useMutation({
    mutationFn: async (fileId: string) =>
      apiJson<StatementPreviewResponse>(`/api/households/${householdId}/files/${fileId}/preview`, {
        method: "POST",
      }),
  });

  async function onPick(
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "credit_card_invoice" | "bank_statement"
  ) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || readOnly) return;
    setMsg(null);
    setPreview(null);
    try {
      const fileRow = await upload.mutateAsync({ file, kind });
      const data = await previewMutation.mutateAsync(fileRow._id);
      setPreview(data);
      setMsg(null);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Falha no upload ou na leitura do arquivo");
    }
  }

  const busy = upload.isPending || previewMutation.isPending;

  return (
    <section className="rounded-2xl border border-border bg-card/70 p-6 dark:bg-card/50 dark:shadow-card-dark">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">Ler extrato / fatura</h2>
      <p className="mt-1 text-xs text-muted">
        Envie PDF ou texto: mostramos um <span className="font-medium text-foreground">resumo só para consulta</span>{" "}
        (totais, indícios de Pix, cartão etc.). Nada entra no mês sozinho — use a entrada rápida para lançar na mão.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          ref={invRef}
          type="file"
          accept=".pdf,.csv,.txt,text/*,application/pdf"
          className="hidden"
          onChange={(e) => onPick(e, "credit_card_invoice")}
        />
        <input
          ref={stmtRef}
          type="file"
          accept=".pdf,.csv,.txt,text/*,application/pdf"
          className="hidden"
          onChange={(e) => onPick(e, "bank_statement")}
        />
        <button
          type="button"
          disabled={readOnly || busy}
          onClick={() => invRef.current?.click()}
          className="flex flex-col items-start rounded-xl border border-border bg-input/60 px-4 py-4 text-left transition hover:border-accent/40 hover:bg-elevated disabled:opacity-40 dark:bg-input/40"
        >
          <span className="text-sm font-medium text-foreground">Fatura de cartão</span>
          <span className="mt-1 text-xs text-muted">PDF ou arquivo de texto</span>
        </button>
        <button
          type="button"
          disabled={readOnly || busy}
          onClick={() => stmtRef.current?.click()}
          className="flex flex-col items-start rounded-xl border border-border bg-input/60 px-4 py-4 text-left transition hover:border-accent/40 hover:bg-elevated disabled:opacity-40 dark:bg-input/40"
        >
          <span className="text-sm font-medium text-foreground">Extrato bancário</span>
          <span className="mt-1 text-xs text-muted">PDF, CSV ou OFX exportado como texto</span>
        </button>
      </div>
      {busy && <p className="mt-3 text-xs text-muted">Lendo arquivo…</p>}
      {msg && <p className="mt-3 text-xs text-red-500">{msg}</p>}
      {preview && !busy && <StatementPreview preview={preview} onDismiss={() => setPreview(null)} />}
    </section>
  );
}
