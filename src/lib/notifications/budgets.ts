/**
 * `budget.threshold` notifications (server). After the user saves an expense or imports a statement, the
 * month's budgets are recomputed and every budget at or over 80 % / 100 % gets an inbox entry. The entry is
 * stored already read (decision 8: the toast is what the user sees) and the dedupe key makes it once per
 * threshold and month. Imports also report which budgets just crossed a threshold so the client can toast.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { loadBudgetSpentCalculator } from "@/lib/budgetHelpers";
import { budgetRatio, crossedThresholds, reachedThreshold, type CrossedBudget } from "@/lib/budgetThresholds";
import { calendarDayInAppTimeZone, monthKey, shiftMonth } from "@/lib/date";
import type { Lang } from "@/lib/i18n/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAfter, type NotifyEvent } from "./server";

export { BUDGET_THRESHOLDS, budgetRatio, crossedThresholds, reachedThreshold, type CrossedBudget } from "@/lib/budgetThresholds";

/** Spent amount of one budget in one month. */
export interface BudgetStatus {
  budgetId: string;
  /** YYYY-MM */
  month: string;
  /** Label of the budget (its top-level categories); empty for the general budget. */
  name: string;
  spent: number;
  limit: number;
}

/** How many of the latest months a statement can touch and still be checked (older ones are history). */
const MONTHS_BACK = 2;
const MAX_MONTHS = 4;

const roundCents = (value: number) => Math.round(value * 100) / 100;

/** Language of the current request (the `submana-lang` cookie). Call it inside the route handler, before `after()`. */
export async function requestLang(): Promise<Lang> {
  try {
    return (await cookies()).get("submana-lang")?.value === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}

/** Distinct "YYYY-MM" (Madrid) of the given instants, newest first, limited to the recent months worth checking. */
export function monthsOf(dates: readonly string[], now: Date = new Date()): string[] {
  const nowMonth = calendarDayInAppTimeZone(now.toISOString()).slice(0, 7);
  const [year, month] = nowMonth.split("-").map(Number);
  const oldest = shiftMonth(year, month, -MONTHS_BACK);
  const earliest = monthKey(oldest.year, oldest.month);
  const months = new Set<string>();
  for (const date of dates) {
    const key = calendarDayInAppTimeZone(date).slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(key) && key >= earliest) months.add(key);
  }
  return [...months].sort().reverse().slice(0, MAX_MONTHS);
}

type CategoryRow = { id: string; name: string; name_en: string | null; parent_id: string | null };

/** "Food, Transport": the distinct top-level categories of a budget in the given language ("" for the general budget). */
export function budgetLabel(categoryIds: readonly string[], categories: ReadonlyMap<string, CategoryRow>, lang: Lang): string {
  const roots = [...new Set(categoryIds.map((id) => categories.get(id)?.parent_id ?? id))];
  return roots
    .map((id) => {
      const category = categories.get(id);
      return lang === "en" && category?.name_en ? category.name_en : (category?.name ?? "");
    })
    .filter(Boolean)
    .join(", ");
}

/** Spent amount of every budget (with a limit) of the user in each month. Throws on a database error. */
export async function loadBudgetStatuses(client: SupabaseClient, userId: string, months: readonly string[], lang: Lang): Promise<BudgetStatus[]> {
  if (months.length === 0) return [];
  const { data: budgets, error } = await client.from("budgets").select("id, amount").eq("user_id", userId).gt("amount", 0);
  if (error) throw error;
  if (!budgets?.length) return [];

  const [{ data: links, error: linksError }, { data: categories, error: categoriesError }, calculators] = await Promise.all([
    client.from("budget_categories").select("budget_id, category_id").in("budget_id", budgets.map((b) => b.id)),
    client.from("categories").select("id, name, name_en, parent_id").or(`user_id.eq.${userId},user_id.is.null`),
    Promise.all(
      months.map((month) => {
        const [year, m] = month.split("-").map(Number);
        return loadBudgetSpentCalculator(client, userId, year, m);
      })
    ),
  ]);
  if (linksError) throw linksError;
  if (categoriesError) throw categoriesError;

  const byId = new Map((categories ?? []).map((c) => [c.id as string, c as CategoryRow]));
  return budgets.flatMap((budget) => {
    const categoryIds = (links ?? []).filter((l) => l.budget_id === budget.id).map((l) => l.category_id as string);
    const name = budgetLabel(categoryIds, byId, lang);
    return months.map((month, i) => ({ budgetId: budget.id as string, month, name, spent: roundCents(calculators[i](categoryIds)), limit: Number(budget.amount) }));
  });
}

/** One `budget.threshold` event for each budget at or over a threshold (the highest it reached), stored already read. */
export function budgetThresholdEvents(userId: string, statuses: readonly BudgetStatus[]): NotifyEvent[] {
  return statuses.flatMap((status) => {
    const reached = reachedThreshold(budgetRatio(status.spent, status.limit));
    if (reached == null) return [];
    const threshold = Math.round(reached * 100) as 80 | 100;
    const event: NotifyEvent = {
      userId,
      type: "budget.threshold",
      actorId: userId,
      entityType: "budget",
      entityId: status.budgetId,
      params: { budgetId: status.budgetId, name: status.name, threshold, month: status.month, spent: status.spent, limit: status.limit },
      dedupeKey: `budget.threshold:${status.budgetId}:${status.month}:${threshold}`,
      selfInitiated: true,
    };
    return [event];
  });
}

/** Budgets that went from under a threshold to at or over it between two snapshots (the highest threshold of each). */
export function crossedBudgets(before: readonly BudgetStatus[], after: readonly BudgetStatus[]): CrossedBudget[] {
  return after.flatMap((status) => {
    const previous = before.find((b) => b.budgetId === status.budgetId && b.month === status.month);
    const ratio = budgetRatio(status.spent, status.limit);
    const crossed = crossedThresholds(previous ? budgetRatio(previous.spent, previous.limit) : 0, ratio);
    if (crossed.length === 0) return [];
    return [{ id: status.budgetId, name: status.name, pct: Math.round(ratio * 100), threshold: Math.round(Math.max(...crossed) * 100), month: status.month }];
  });
}

/**
 * After the user saved an expense: records the thresholds the month's budgets are at (after the response).
 * `dates` are the transaction dates; nothing happens when they are all too old to matter.
 */
export function notifyBudgetThresholds(userId: string, dates: readonly string[], lang: Lang) {
  const months = monthsOf(dates);
  if (months.length === 0) return;
  notifyAfter(async () => budgetThresholdEvents(userId, await loadBudgetStatuses(createAdminClient(), userId, months, lang)));
}

export interface BudgetWatch {
  /** Recomputes the budgets, schedules their notifications and returns the ones that just crossed a threshold. */
  finish(): Promise<CrossedBudget[]>;
}

const NO_WATCH: BudgetWatch = { finish: async () => [] };

/**
 * For imports: snapshots the budgets of the months the statement touches BEFORE importing, so `finish()`
 * can tell which ones crossed a threshold because of it. Never throws: a failed check is just no toast.
 * `expenseDates` are the dates of the expense rows being imported.
 */
export async function watchBudgets(client: SupabaseClient, userId: string, expenseDates: readonly string[]): Promise<BudgetWatch> {
  const months = monthsOf(expenseDates);
  if (months.length === 0) return NO_WATCH;
  const lang = await requestLang();
  let before: BudgetStatus[] | null = null;
  try {
    before = await loadBudgetStatuses(client, userId, months, lang);
    if (before.length === 0) return NO_WATCH;
  } catch (error) {
    console.error("[notifications] budgets before", error);
  }
  return {
    finish: async () => {
      try {
        const after = await loadBudgetStatuses(client, userId, months, lang);
        notifyAfter(budgetThresholdEvents(userId, after));
        return before ? crossedBudgets(before, after) : [];
      } catch (error) {
        console.error("[notifications] budgets after", error);
        return [];
      }
    },
  };
}

/** `watchBudgets` for a statement: only its expense rows can move a budget. */
export const watchImportBudgets = (client: SupabaseClient, userId: string, rows: readonly { type: string; date: string }[]) =>
  watchBudgets(client, userId, rows.filter((row) => row.type === "expense").map((row) => row.date));

