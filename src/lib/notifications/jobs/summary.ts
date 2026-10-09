/** Cron job: the monthly summary (previous month's spending, income, savings, budgets over the limit, top category). */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryWithSubs } from "@/hooks/useCategories";
import { fetchAllPages } from "@/lib/apiHelpers";
import { calendarMonthsUtcHalfOpenRange } from "@/lib/date";
import type { Lang } from "@/lib/i18n/ui";
import { metricTransactions, sumByType } from "@/lib/metricsFilters";
import { DEFAULT_NOTIFICATION_SETTINGS } from "../types";
import type { NotifyEvent } from "../core";
import { previousMonth, type MadridClock } from "./time";

/** `notification_settings.summary_day` of someone with no settings row. */
export const DEFAULT_SUMMARY_DAY = DEFAULT_NOTIFICATION_SETTINGS.summary_day;

export interface SummarySettingsRow {
  user_id: string;
  summary_day: number;
  lang: Lang;
}

export interface SummaryTransaction {
  id: string;
  user_id: string;
  amount: number | string;
  type: string;
  date: string;
  account_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
}

export interface SummaryCategory {
  id: string;
  name: string;
  name_en: string | null;
  parent_id: string | null;
  /** null for the system categories, shared by everyone. */
  user_id: string | null;
  exclude_from_metrics: boolean | null;
}

export interface SummaryBudget {
  id: string;
  user_id: string;
  amount: number | string;
}

export interface SummaryBudgetLink {
  budget_id: string;
  category_id: string;
}

const roundCents = (value: number) => Math.round(value * 100) / 100;

/**
 * Who gets the summary today: users whose `summary_day` is today, where having no settings row means the
 * default day. Only people with transactions that month (`usersWithTransactions`).
 */
export function summaryUsers(day: number, settings: readonly Pick<SummarySettingsRow, "user_id" | "summary_day">[], usersWithTransactions: Iterable<string>): string[] {
  const dayOf = new Map(settings.map((row) => [row.user_id, row.summary_day]));
  return [...new Set(usersWithTransactions)].filter((userId) => (dayOf.get(userId) ?? DEFAULT_SUMMARY_DAY) === day);
}

export interface MonthlySummary {
  spent: number;
  income: number;
  savings: number;
  overBudgets: number;
  topCategory: string | null;
  /** Transactions that count for metrics; with none there is nothing to summarise. */
  count: number;
}

/**
 * One user's summary from their transactions of the month. Same rules as the dashboard and the budgets:
 * joint-account rows, transfers between own accounts and categories flagged `exclude_from_metrics` do not
 * count. `categories` are the ones visible to the user (system plus their own).
 */
export function computeMonthlySummary(input: {
  transactions: readonly SummaryTransaction[];
  categories: readonly SummaryCategory[];
  jointAccountIds: Iterable<string>;
  budgets: readonly Pick<SummaryBudget, "id" | "amount">[];
  budgetLinks: readonly SummaryBudgetLink[];
  lang: Lang;
}): MonthlySummary {
  const { categories, lang } = input;
  const roots: CategoryWithSubs[] = categories
    .filter((c) => !c.parent_id)
    .map((c) => ({
      id: c.id,
      name: c.name,
      isDefault: c.user_id == null,
      exclude_from_metrics: !!c.exclude_from_metrics,
      subcategories: categories
        .filter((sub) => sub.parent_id === c.id)
        .map((sub) => ({ id: sub.id, name: sub.name, isDefault: sub.user_id == null, exclude_from_metrics: !!sub.exclude_from_metrics })),
    }));
  const counted = metricTransactions([...input.transactions], { defaultCategories: roots, userCategories: [] }, { jointAccountIds: input.jointAccountIds });
  const { income, expense } = sumByType(counted);

  const byId = new Map(categories.map((c) => [c.id, c]));
  const parentOf = (id: string | null) => (id ? (byId.get(id)?.parent_id ?? null) : null);
  const expenses = counted.filter((tx) => tx.type !== "income").map((tx) => ({ ...tx, amount: Number(tx.amount) || 0 }));

  const spentByRoot = new Map<string, number>();
  for (const tx of expenses) {
    const root = tx.category_id ?? parentOf(tx.subcategory_id) ?? tx.subcategory_id;
    if (root) spentByRoot.set(root, (spentByRoot.get(root) ?? 0) + tx.amount);
  }
  const [topId] = [...spentByRoot].sort((a, b) => b[1] - a[1])[0] ?? [];
  const top = topId ? byId.get(topId) : undefined;

  // A budget counts what is spent on its linked categories (a parent includes its subcategories); no links: everything.
  const overBudgets = input.budgets.filter((budget) => {
    const limit = Number(budget.amount);
    if (!(limit > 0)) return false;
    const linked = new Set(input.budgetLinks.filter((l) => l.budget_id === budget.id).map((l) => l.category_id));
    const counts = (id: string | null) => !!id && (linked.has(id) || linked.has(parentOf(id) ?? ""));
    const spent = expenses.filter((tx) => linked.size === 0 || counts(tx.category_id) || counts(tx.subcategory_id)).reduce((sum, tx) => sum + tx.amount, 0);
    return spent >= limit - 1e-9;
  }).length;

  return {
    spent: roundCents(expense),
    income: roundCents(income),
    savings: roundCents(income - expense),
    overBudgets,
    topCategory: top ? (lang === "en" && top.name_en ? top.name_en : top.name) : null,
    count: counted.length,
  };
}

export function summaryEvent(userId: string, month: string, summary: MonthlySummary): NotifyEvent {
  const { spent, income, savings, overBudgets, topCategory } = summary;
  return { userId, type: "summary.monthly", params: { month, spent, income, savings, overBudgets, topCategory }, dedupeKey: `summary.monthly:${month}` };
}

/** Loads what the summaries need (one query per table, for every user at once) and returns the events. */
export async function loadSummaryEvents(admin: SupabaseClient, clock: MadridClock): Promise<NotifyEvent[]> {
  const previous = previousMonth(clock);
  const { data: settingsRows, error: settingsError } = await admin.from("notification_settings").select("user_id, summary_day, lang");
  if (settingsError) throw settingsError;
  const settings = (settingsRows ?? []) as SummarySettingsRow[];

  // Users with their own day only matter when it is today; users without a row are on the default day.
  const explicit = settings.filter((row) => row.summary_day === clock.day).map((row) => row.user_id);
  if (clock.day !== DEFAULT_SUMMARY_DAY && explicit.length === 0) return [];

  const { startIso, endExclusiveIso } = calendarMonthsUtcHalfOpenRange(previous.year, previous.month, previous.year, previous.month);
  const transactions = await fetchAllPages<SummaryTransaction>((from, to) => {
    const query = admin
      .from("transactions")
      .select("id, user_id, amount, type, date, account_id, category_id, subcategory_id")
      .gte("date", startIso)
      .lt("date", endExclusiveIso)
      .order("id")
      .range(from, to);
    return clock.day === DEFAULT_SUMMARY_DAY ? query : query.in("user_id", explicit);
  });

  const userIds = summaryUsers(clock.day, settings, transactions.map((tx) => tx.user_id));
  if (userIds.length === 0) return [];

  const [{ data: categoryRows, error: categoriesError }, { data: jointRows, error: jointError }, { data: budgetRows, error: budgetsError }] = await Promise.all([
    admin.from("categories").select("id, name, name_en, parent_id, user_id, exclude_from_metrics"),
    admin.from("accounts").select("id").eq("is_joint", true),
    admin.from("budgets").select("id, user_id, amount").in("user_id", userIds).gt("amount", 0),
  ]);
  if (categoriesError) throw categoriesError;
  if (jointError) throw jointError;
  if (budgetsError) throw budgetsError;
  const budgets = (budgetRows ?? []) as SummaryBudget[];
  const { data: linkRows, error: linksError } = budgets.length
    ? await admin.from("budget_categories").select("budget_id, category_id").in("budget_id", budgets.map((b) => b.id))
    : { data: [], error: null };
  if (linksError) throw linksError;

  const categories = (categoryRows ?? []) as SummaryCategory[];
  const jointAccountIds = new Set((jointRows ?? []).map((row) => row.id as string));
  const langOf = new Map(settings.map((row) => [row.user_id, row.lang]));

  return userIds.flatMap((userId) => {
    const summary = computeMonthlySummary({
      transactions: transactions.filter((tx) => tx.user_id === userId),
      categories: categories.filter((c) => c.user_id == null || c.user_id === userId),
      jointAccountIds,
      budgets: budgets.filter((b) => b.user_id === userId),
      budgetLinks: (linkRows ?? []) as SummaryBudgetLink[],
      lang: langOf.get(userId) ?? DEFAULT_NOTIFICATION_SETTINGS.lang,
    });
    return summary.count > 0 ? [summaryEvent(userId, previous.key, summary)] : [];
  });
}
