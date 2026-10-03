import { parseCurrencyValue } from "@/lib/currency";
import { computeShares, toCents, type SplitMode, type SplitResult } from "./splits";

/** State of the split editor: who takes part and the raw text typed for each person. */
export interface SplitDraft {
  mode: SplitMode;
  included: string[];
  /** exact: euros, percent: %, shares: weight (raw input, comma or dot). */
  values: Record<string, string>;
  title: string;
}

export function initialDraft(memberIds: string[], title = ""): SplitDraft {
  return { mode: "equal", included: memberIds, values: {}, title };
}

/** Numeric value typed for a person (shares default to 1). */
function valueOf(draft: SplitDraft, userId: string) {
  const raw = draft.values[userId];
  if (draft.mode === "shares" && (raw === undefined || raw === "")) return 1;
  return parseCurrencyValue(raw ?? "");
}

/** Participants in the units the API expects (exact in euros). */
export function draftParticipants(draft: SplitDraft) {
  return draft.included.map((user_id) => ({
    user_id,
    ...(draft.mode !== "equal" && { value: valueOf(draft, user_id) }),
  }));
}

export interface DraftEvaluation {
  result: SplitResult;
  /**
   * What is left to assign, in the unit of the mode: cents for exact (total - sum), percentage
   * points for percent (100 - sum); null for equal and shares, which always close.
   */
  remaining: number | null;
  /** Amount in cents each person pays, when the split is valid. */
  centsByUser: Map<string, number>;
}

/** Live evaluation of the editor against the expense total. */
export function evaluateDraft(draft: SplitDraft, totalCents: number, payerId: string | null): DraftEvaluation {
  const participants = draft.included.map((userId) => ({
    userId,
    value: draft.mode === "exact" ? toCents(valueOf(draft, userId)) : valueOf(draft, userId),
  }));
  const result = computeShares(totalCents, draft.mode, participants, payerId);

  let remaining: number | null = null;
  if (draft.mode === "exact") remaining = totalCents - participants.reduce((sum, p) => sum + (p.value ?? 0), 0);
  else if (draft.mode === "percent") remaining = Math.round((100 - participants.reduce((sum, p) => sum + (p.value ?? 0), 0)) * 100) / 100;

  return {
    result,
    remaining,
    centsByUser: new Map(result.ok ? result.shares.map((s) => [s.userId, s.cents]) : []),
  };
}

/** True when the split can be sent: valid result and, for percent, percentages that add up to 100. */
export function isDraftSubmittable(evaluation: DraftEvaluation, draft: SplitDraft) {
  if (!evaluation.result.ok || draft.included.length === 0) return false;
  return draft.mode !== "percent" || evaluation.remaining === 0;
}
