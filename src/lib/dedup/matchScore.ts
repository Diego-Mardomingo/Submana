import { calendarDayInAppTimeZone } from "@/lib/date";
import { descriptionTokens } from "./normalizeDescription";

/** A bank line may be booked this many days before / after the day the user registered it. */
export const MIN_DELTA_DAYS = -2;
export const MAX_DELTA_DAYS = 5;

const DATE_SCORES: Record<number, number> = { 0: 1, 1: 0.9, 2: 0.8, 3: 0.65, 4: 0.5, 5: 0.4, [-1]: 0.6, [-2]: 0.35 };

export interface Matchable {
  type: string;
  amount: number | string;
  date: string;
  description?: string | null;
}

export interface MatchResult {
  score: number;
  /** bankDay - manualDay, in Madrid calendar days. */
  deltaDays: number;
  /** null when the manual transaction has no usable description. */
  descScore: number | null;
}

const cents = (value: number | string) => Math.round(Number(value) * 100);

const dayNumber = (isoDate: string) => {
  const [y, m, d] = calendarDayInAppTimeZone(isoDate).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** bankDay - manualDay in calendar days of the app time zone (NaN for invalid dates). */
export function calendarDayDelta(bankDate: string, manualDate: string): number {
  return dayNumber(bankDate) - dayNumber(manualDate);
}

const tokensMatch = (a: string, b: string) => a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)));

/** Overlap of two token lists (matched / smallest list); prefixes of 4+ chars count as a match. */
export function descriptionScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const free = [...b];
  let matched = 0;
  for (const token of a) {
    const i = free.findIndex((other) => tokensMatch(token, other));
    if (i >= 0) {
      matched++;
      free.splice(i, 1);
    }
  }
  return matched / Math.min(a.length, b.length);
}

/**
 * How likely `bank` (a statement line) is the same movement as `manual` (registered by the user).
 * Returns null when a hard gate fails: same type, same cents and the bank day within [-2, +5] of the manual day.
 */
export function matchScore(bank: Matchable, manual: Matchable): MatchResult | null {
  if ((bank.type || "").toLowerCase() !== (manual.type || "").toLowerCase()) return null;
  if (cents(bank.amount) !== cents(manual.amount)) return null;
  const deltaDays = calendarDayDelta(bank.date, manual.date);
  if (!Number.isInteger(deltaDays) || deltaDays < MIN_DELTA_DAYS || deltaDays > MAX_DELTA_DAYS) return null;

  const dateScore = DATE_SCORES[deltaDays];
  const manualTokens = descriptionTokens(manual.description);
  if (manualTokens.length === 0) return { score: 0.8 * dateScore, deltaDays, descScore: null };
  const descScore = descriptionScore(descriptionTokens(bank.description), manualTokens);
  return { score: 0.55 * dateScore + 0.45 * descScore, deltaDays, descScore };
}
