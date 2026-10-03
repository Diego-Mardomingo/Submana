import { matchScore, type MatchResult, type Matchable } from "./matchScore";

/**
 * Minimum score to auto-merge. The plan said 0.85, but with its own date table a perfect description
 * at +3 days (the Trade Republic case) scores 0.8075, so 0.80 is the value that makes it "sure".
 */
export const SURE_THRESHOLD = 0.8;
export const POSSIBLE_THRESHOLD = 0.45;
/** A "sure" match must beat every other candidate by at least this much. */
export const AMBIGUITY_MARGIN = 0.1;

/** What a saved import_duplicate_decisions resolution means for a bank line. */
export function decisionAction(resolution: string | undefined | null): "skip" | "insert" | undefined {
  if (resolution === "keep_existing" || resolution === "skip_bank_line") return "skip";
  if (resolution === "keep_import" || resolution === "keep_both") return "insert";
  return undefined;
}

export interface ClassifyRow extends Matchable {
  /** Saved decision for this line (already looked up by the caller). */
  decision?: string | null;
}

export interface ClassifyCandidate extends Matchable {
  id: string;
}

export interface RowClassification<C extends ClassifyCandidate> {
  status: "new" | "sure" | "possible" | "skipped";
  match?: MatchResult & { candidate: C };
}

/**
 * Pairs bank lines with unreconciled manual transactions 1:1, greedily from the highest score.
 * `sure`: score >= SURE_THRESHOLD and no other candidate (for the line or for the manual row) within
 * AMBIGUITY_MARGIN, and the manual row has a description. `possible`: score >= POSSIBLE_THRESHOLD. Saved decisions skip or force an insert.
 */
export function classifyImportRows<C extends ClassifyCandidate>(rows: ClassifyRow[], candidates: C[]): RowClassification<C>[] {
  const result: RowClassification<C>[] = rows.map(() => ({ status: "new" }));
  const pairs: { row: number; cand: number; match: MatchResult }[] = [];

  rows.forEach((row, i) => {
    const action = decisionAction(row.decision);
    if (action === "skip") result[i] = { status: "skipped" };
    if (action) return;
    candidates.forEach((candidate, j) => {
      const match = matchScore(row, candidate);
      if (match && match.score >= POSSIBLE_THRESHOLD) pairs.push({ row: i, cand: j, match });
    });
  });

  pairs.sort((a, b) => b.match.score - a.match.score || Math.abs(a.match.deltaDays) - Math.abs(b.match.deltaDays) || a.row - b.row || a.cand - b.cand);

  const rowTaken = new Set<number>();
  const candTaken = new Set<number>();
  for (const pair of pairs) {
    if (rowTaken.has(pair.row) || candTaken.has(pair.cand)) continue;
    rowTaken.add(pair.row);
    candTaken.add(pair.cand);
    const rival = pairs.some(
      (other) =>
        other !== pair &&
        (other.row === pair.row || other.cand === pair.cand) &&
        other.match.score > pair.match.score - AMBIGUITY_MARGIN
    );
    result[pair.row] = {
      status: pair.match.score >= SURE_THRESHOLD && pair.match.descScore !== null && !rival ? "sure" : "possible",
      match: { ...pair.match, candidate: candidates[pair.cand] },
    };
  }
  return result;
}
