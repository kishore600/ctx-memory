import type { MemoryEntry } from "./schema.js";

export interface ScoredEntry {
  entry: MemoryEntry;
  score: number;
}

type Field = "title" | "tags" | "refs" | "body";

// Title/tags/refs are short, deliberate strings an author chose — a query term matching one
// of those is a much stronger signal than the same term appearing somewhere in a paragraph.
const FIELD_WEIGHTS: Record<Field, number> = { title: 3, tags: 2, refs: 1.5, body: 1 };

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

interface FieldToken {
  field: Field;
  token: string;
}

function documentTokens(entry: MemoryEntry): FieldToken[] {
  const out: FieldToken[] = [];
  for (const token of tokenize(entry.frontmatter.title)) out.push({ field: "title", token });
  for (const tag of entry.frontmatter.tags) for (const token of tokenize(tag)) out.push({ field: "tags", token });
  for (const ref of entry.frontmatter.refs) for (const token of tokenize(ref)) out.push({ field: "refs", token });
  for (const token of tokenize(entry.body)) out.push({ field: "body", token });
  return out;
}

// Loose match so "postgres" in a query still finds "postgresql" in a title, without pulling in
// a stemming library. Guarded by a minimum length so short terms ("a", "is") don't fuzzy-match
// half the corpus.
function termMatches(token: string, queryTerm: string): boolean {
  return token === queryTerm || (queryTerm.length >= 4 && token.startsWith(queryTerm));
}

/**
 * Ranks entries against a free-text query using local TF-IDF-style scoring over title, tags,
 * refs and body — no embeddings, no network calls, no external model. Rare query terms (and
 * matches in title/tags/refs over body) score higher. Entries with a score of 0 share no term
 * with the query at all; callers typically filter those out.
 */
export function rankEntries(entries: MemoryEntry[], query: string): ScoredEntry[] {
  const queryTerms = [...new Set(tokenize(query))];
  if (queryTerms.length === 0) return entries.map((entry) => ({ entry, score: 0 }));

  const docsTokens = entries.map((entry) => documentTokens(entry));

  const docFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    const df = docsTokens.filter((tokens) => tokens.some((t) => termMatches(t.token, term))).length;
    docFrequency.set(term, df);
  }

  const n = entries.length;
  const scored = entries.map((entry, i) => {
    const tokens = docsTokens[i];
    let score = 0;
    for (const term of queryTerms) {
      const df = docFrequency.get(term) ?? 0;
      if (df === 0) continue;
      const idf = Math.log(1 + n / df);
      const tf = tokens.filter((t) => termMatches(t.token, term)).reduce((sum, t) => sum + FIELD_WEIGHTS[t.field], 0);
      score += tf * idf;
    }
    return { entry, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}
