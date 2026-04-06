import { CATEGORY_KEYWORD_RULES } from "./category-keyword-rules.js";

/**
 * Lowercase + strip accents for matching user text to keywords.
 */
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Whether a keyword matches in normalized text. Long / multi-word → substring; short → whole token (no "bar" in "baralho").
 */
export function keywordMatches(normalizedText: string, keyword: string): boolean {
  const t = normalizeForMatch(normalizedText);
  const k = normalizeForMatch(keyword);
  if (!k) return false;
  if (k.includes(" ") || k.length >= 6) {
    return t.includes(k);
  }
  // Whole token only for short keywords (avoids "bar" inside unrelated words).
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${esc}(?:$|[^a-z0-9])`).test(t);
}

/**
 * Picks category slug from PT-BR text; longest matching keyword wins.
 */
export function inferCategorySlug(normalizedText: string): string {
  let best: { slug: string; len: number } | null = null;
  for (const rule of CATEGORY_KEYWORD_RULES) {
    for (const kw of rule.keywords) {
      if (!keywordMatches(normalizedText, kw)) continue;
      if (!best || kw.length > best.len) {
        best = { slug: rule.slug, len: kw.length };
      }
    }
  }
  return best?.slug ?? "other";
}
