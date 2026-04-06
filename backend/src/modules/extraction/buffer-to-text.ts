import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Pulls plain text from PDF, CSV, or text files for heuristic parsing.
 */
export async function bufferToPlainText(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
  const lower = mimeType.toLowerCase();
  const ext = path.extname(originalName).toLowerCase();

  if (lower.includes("pdf") || ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const res = await pdfParse(buffer);
    return res.text ?? "";
  }

  if (
    lower.includes("text") ||
    lower.includes("csv") ||
    ext === ".csv" ||
    ext === ".txt" ||
    ext === ".tsv"
  ) {
    return buffer.toString("utf8");
  }

  if (lower.includes("image")) {
    throw new Error(
      "Arquivos de imagem ainda não têm OCR. Exporte o extrato em PDF ou CSV, ou copie o texto para um .txt."
    );
  }

  try {
    return buffer.toString("utf8");
  } catch {
    throw new Error("Formato não suportado para extração automática.");
  }
}

/**
 * Reads a stored upload from disk into UTF-8 / PDF text.
 */
export async function readUploadAsText(absPath: string, mimeType: string, originalName: string): Promise<string> {
  const buffer = await readFile(absPath);
  return bufferToPlainText(buffer, mimeType, originalName);
}
