const base = () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`);
    this.status = status;
    this.body = body;
    this.name = "ApiError";
  }
}

/**
 * Returns a short user-facing message from an API error body when JSON includes `message`.
 */
export function formatApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  try {
    const j = JSON.parse(err.body) as { message?: string; error?: string };
    if (j.message) return j.message;
    if (j.error) return `${j.error}${err.status ? ` (${err.status})` : ""}`;
  } catch {
    /* ignore */
  }
  if (err.status === 0 || err.message.includes("Failed to fetch")) {
    return "Não foi possível alcançar a API. Confira se o backend está em execução.";
  }
  return fallback;
}

/**
 * Typed JSON fetch against the finance API.
 * Avoids sending `Content-Type: application/json` with an empty body — Fastify rejects that as invalid JSON.
 */
export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const hasBody =
    init?.body != null &&
    !(typeof init.body === "string" && init.body.length === 0);
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new ApiError(res.status, text);
  }
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
