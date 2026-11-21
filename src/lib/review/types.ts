import type { CategoryPair, ReviewMode, ReviewReason, ReviewState, ReviewWhy } from "./classify";

/** A card of the deck, as `GET /api/review` returns it. */
export interface ReviewItem extends CategoryPair {
  id: string;
  description: string | null;
  bank_description: string | null;
  amount: number;
  type: "income" | "expense";
  date: string;
  account: { id: string; name: string; color: string | null } | null;
  review_state: ReviewState;
  review_reason: ReviewReason;
  subscription: { id: string; service_name: string; icon: string | null } | null;
  why: ReviewWhy;
  alternatives: CategoryPair[];
  /** A suggestion beyond the category: share it in Subcount, or record it as someone's payment there. */
  hint: "subcount" | "settle" | null;
  /** The bank text normalised, which a rule learnt from this card would match. */
  pattern: string;
}

export interface ReviewQueue {
  mode: ReviewMode;
  items: ReviewItem[];
  /** Whether the user has Subcount groups (the share and settle actions need one). */
  hasGroups: boolean;
}

/** What the server needs to put a card back as it was (the deck's undo). */
export interface ReviewUndo extends CategoryPair {
  review_state: ReviewState;
  pattern: string;
  /** The rule before this action, when the action wrote one (null: there was none, so it's deleted). */
  rule?: CategoryPair | null;
}

export type ReviewAction =
  | { action: "confirm"; category?: CategoryPair; learn?: boolean }
  | { action: "later" }
  | { action: "restore"; undo: ReviewUndo };

/** `GET /api/review?summary=1`: how many cards are waiting (up to the deck's size) and the first three. */
export interface ReviewSummary {
  count: number;
  preview: (CategoryPair & { id: string; description: string | null; type: "income" | "expense" })[];
}
