/**
 * Review deck logic (pure, no I/O): how sure the app is about a new bank movement's category, what it
 * suggests instead, and why. Used when the import writes the movement (`review_state`, `review_reason`,
 * the suggested category) and when the deck reads it back (alternatives and the "why" line).
 */

export type ReviewReason = "sure" | "doubt" | "new" | "transfer" | "settle";
export type ReviewState = "pending" | "later" | "done";
/** What the deck shows: only what the app isn't sure about, or every new movement. */
export type ReviewMode = "doubt" | "all";

export interface CategoryPair {
  category_id: string | null;
  subcategory_id: string | null;
}

/** An earlier movement the user already categorised (or confirmed), used as evidence. */
export interface HistoryRow extends CategoryPair {
  id: string;
  description: string | null;
  bank_description?: string | null;
}

/** A movement only enters the deck if it is this recent (an old statement shouldn't flood it). */
export const REVIEW_MAX_AGE_DAYS = 45;
/** How long after an expense an incoming Bizum/transfer still looks like someone's share of it. */
export const SETTLE_WINDOW_HOURS = 24;

const STOP_WORDS = new Set([
  "COMPRA", "COMPRAS", "TARJ", "TARJETA", "TPV", "PAGO", "PAGOS", "CARGO", "RECIBO", "ADEUDO", "EN", "DE", "DEL", "LA",
  "EL", "LOS", "LAS", "CON", "POR", "SL", "SA", "SLU", "WWW", "COM", "ES", "NET", "PAYMENT", "CARD", "PURCHASE", "TO",
  "FROM", "AT", "THE", "OF", "LU", "IE", "NL", "GB", "US",
]);

/** Upper case, no accents, words only (numbers, references and card digits dropped). */
function merchantTokens(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length >= 2 && !/\d/.test(token) && !STOP_WORDS.has(token));
}

/**
 * The merchant behind a bank text, stable across its references: "AMAZON MKTPLACE*2K4L19 LU" and
 * "AMAZON MKTPLACE*9Q1ZZ0 LU" are both "AMAZON MKTPLACE". Empty when nothing recognisable is left.
 */
export function normalizeMerchant(text: string | null | undefined): string {
  return merchantTokens(text).slice(0, 2).join(" ");
}

/**
 * A readable name for a bank text in capitals: "TPV 4402 LA TASQUITA MADRID" → "Tasquita Madrid", keeping accents.
 * Text someone already wrote in lower case (an edited description, Revolut's "Mercadona") is left as it is.
 */
export function merchantName(text: string | null | undefined): string {
  const raw = (text ?? "").trim();
  if (!raw || /\p{Ll}/u.test(raw)) return raw;
  const words = raw
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => {
      const key = word.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
      return key.length >= 2 && !/\d/.test(key) && !STOP_WORDS.has(key);
    })
    .slice(0, 3);
  if (words.length === 0) return raw;
  return words.map((word) => word.charAt(0) + word.slice(1).toLocaleLowerCase("es")).join(" ");
}

/** The text a movement is recognised by: what the bank sent, or the description when there is none. */
export const merchantOf = (tx: { description?: string | null; bank_description?: string | null }) =>
  normalizeMerchant(tx.bank_description || tx.description);

export const pairKey = (pair: CategoryPair) => `${pair.category_id ?? ""}/${pair.subcategory_id ?? ""}`;
export const samePair = (a: CategoryPair | null | undefined, b: CategoryPair | null | undefined) =>
  !!a && !!b && a.category_id === b.category_id && a.subcategory_id === b.subcategory_id;

export interface PairCount {
  pair: CategoryPair;
  count: number;
}

/** Earlier movements grouped by merchant (only those with a category). */
export function indexHistory(history: readonly HistoryRow[]): Map<string, HistoryRow[]> {
  const index = new Map<string, HistoryRow[]>();
  for (const row of history) {
    if (!row.category_id) continue;
    const merchant = merchantOf(row);
    if (!merchant) continue;
    index.set(merchant, [...(index.get(merchant) ?? []), row]);
  }
  return index;
}

/** Categories used for a merchant, most used first (ties: the most recent, since history comes newest first). */
export function tally(rows: readonly HistoryRow[]): PairCount[] {
  const counts = new Map<string, PairCount>();
  for (const row of rows) {
    const key = pairKey(row);
    const entry = counts.get(key) ?? { pair: { category_id: row.category_id, subcategory_id: row.subcategory_id }, count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

// --- First guess for a merchant never seen before --------------------------------------------------

const C = "11111111-1111-1111-1111-111111111";
/** System categories (root, sub) by id suffix: see the categories seeded in the database. */
const SYSTEM = {
  groceries: [`${C}301`, `${C}302`],
  restaurants: [`${C}301`, `${C}303`],
  fuel: [`${C}201`, `${C}202`],
  publicTransport: [`${C}201`, `${C}204`],
  travel: [`${C}401`, `${C}404`],
  streaming: [`${C}401`, `${C}402`],
  pharmacy: [`${C}501`, `${C}503`],
  gym: [`${C}501`, `${C}504`],
  clothing: [`${C}701`, `${C}702`],
  technology: [`${C}701`, `${C}703`],
  utilities: [`${C}101`, `${C}103`],
  salary: [`${C}901`, `${C}902`],
} as const;

/** Words in a bank text that give its category away. Only expenses, except the salary. */
const KEYWORDS: [keyof typeof SYSTEM, string[]][] = [
  ["groceries", ["MERCADONA", "CARREFOUR", "LIDL", "ALDI", "EROSKI", "ALCAMPO", "CONSUM", "HIPERCOR", "SUPERMERCADO", "SUPERMERCADOS", "AHORRAMAS", "CAPRABO", "BONPREU", "SUPERCOR", "SPAR", "FROIZ", "GADIS"]],
  ["restaurants", ["RESTAURANTE", "RESTAURANT", "TASCA", "TASQUITA", "TABERNA", "BAR", "CAFE", "CAFETERIA", "BURGER", "MCDONALDS", "KFC", "TELEPIZZA", "DOMINOS", "GLOVO", "DELIVEROO", "JUST EAT", "UBER EATS", "PIZZERIA", "SUSHI", "STARBUCKS", "VIPS", "GOIKO", "FOODHOOD"]],
  ["fuel", ["REPSOL", "CEPSA", "GALP", "SHELL", "BP", "GASOLINERA", "PETRONOR", "PLENOIL", "BALLENOIL", "MOEVE"]],
  ["publicTransport", ["RENFE", "METRO", "EMT", "ALSA", "CABIFY", "UBER", "BOLT", "FREENOW", "TMB", "BICIMAD"]],
  ["travel", ["IBERIA", "RYANAIR", "VUELING", "EASYJET", "BOOKING", "AIRBNB", "HOTEL", "HOTELES", "EXPEDIA", "IRYO", "OUIGO"]],
  ["streaming", ["NETFLIX", "SPOTIFY", "HBO", "HBO MAX", "DISNEY", "DAZN", "FILMIN", "PRIME VIDEO", "YOUTUBE", "CRUNCHYROLL"]],
  ["pharmacy", ["FARMACIA", "PHARMACY", "PARAFARMACIA"]],
  ["gym", ["GYM", "GIMNASIO", "BASIC FIT", "ALTAFIT", "MCFIT", "VIVAGYM", "SMARTFIT", "FITNESS"]],
  ["clothing", ["ZARA", "PRIMARK", "MANGO", "BERSHKA", "PULL BEAR", "STRADIVARIUS", "UNIQLO", "SHEIN", "LEFTIES", "SPRINGFIELD"]],
  ["technology", ["MEDIAMARKT", "MEDIA MARKT", "PCCOMPONENTES", "FNAC", "APPLE STORE", "WORTEN", "BACKMARKET"]],
  ["utilities", ["IBERDROLA", "ENDESA", "NATURGY", "MOVISTAR", "VODAFONE", "ORANGE", "DIGI", "JAZZTEL", "HOLALUZ", "TOTALENERGIES", "LOWI", "PEPEPHONE"]],
  ["salary", ["NOMINA", "SALARIO", "PAYROLL", "SALARY"]],
];

/** A category from the words of a merchant never seen before, or null. */
export function guessCategory(text: string | null | undefined, type: string): CategoryPair | null {
  const words = ` ${merchantTokens(text).join(" ")} `;
  if (words.trim() === "") return null;
  for (const [name, keys] of KEYWORDS) {
    if ((name === "salary") !== (type === "income")) continue;
    if (keys.some((key) => words.includes(` ${key} `))) {
      const [category_id, subcategory_id] = SYSTEM[name];
      return { category_id, subcategory_id };
    }
  }
  return null;
}

// --- Settling up --------------------------------------------------------------------------------

export interface MovementLite {
  id: string;
  amount: number | string;
  type: string;
  date: string;
  description?: string | null;
}

const MONEY_FROM_SOMEONE = /\b(BIZUM|TRANSFERENCIA|TRANSFER|TRASPASO DE|PAYPAL DE)\b/;

/**
 * An incoming Bizum or transfer that looks like someone paying back their share of an expense I just made:
 * less than that expense and within `SETTLE_WINDOW_HOURS` after it. Returns the expense (the closest one).
 */
export function settleMatch(income: MovementLite & { bank_description?: string | null }, expenses: readonly MovementLite[]): MovementLite | null {
  if (income.type !== "income") return null;
  const text = (income.bank_description || income.description || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (!MONEY_FROM_SOMEONE.test(text)) return null;
  const at = Date.parse(income.date);
  const amount = Number(income.amount);
  let best: MovementLite | null = null;
  for (const expense of expenses) {
    if (expense.type !== "expense") continue;
    const gap = at - Date.parse(expense.date);
    if (gap < 0 || gap > SETTLE_WINDOW_HOURS * 3_600_000) continue;
    if (!(Number(expense.amount) > amount)) continue;
    if (!best || Date.parse(expense.date) > Date.parse(best.date)) best = expense;
  }
  return best;
}

// --- Classification when a movement arrives -----------------------------------------------------

const TRANSFER_TEXT = /\b(TRANSFERENCIA|TRANSFER|TRASPASO|TRANSF)\b/;

export interface Classification {
  reason: ReviewReason;
  /** The category the movement gets right away (it counts in spending and budgets while it waits). */
  pair: CategoryPair | null;
}

/**
 * How sure the app is about a new movement: a rule the user taught, or every earlier movement of the merchant in
 * one category (two or more), is "sure"; no history is "new"; anything else (spread over categories, or seen
 * only once) is "doubt". `inherited` is the category of an earlier movement with exactly the same text, which
 * the import already used before the deck existed: it still wins over the merchant's most used one.
 */
export function classifyMovement(input: {
  tx: { description: string | null; bank_description?: string | null; type: string };
  rule: CategoryPair | null;
  inherited: CategoryPair | null;
  merchantHistory: readonly HistoryRow[];
}): Classification {
  const { tx, rule, inherited, merchantHistory } = input;
  if (rule) return { reason: "sure", pair: rule };
  const counts = tally(merchantHistory);
  // A transfer is left without a category so the import can pair it with its other half in another account.
  const transferLike = TRANSFER_TEXT.test(merchantTokens(tx.bank_description || tx.description).join(" "));
  const pair = inherited ?? (transferLike ? null : (counts[0]?.pair ?? guessCategory(tx.bank_description || tx.description, tx.type)));
  if (counts.length === 0) return { reason: "new", pair };
  if (counts.length === 1 && counts[0].count >= 2) return { reason: "sure", pair };
  return { reason: "doubt", pair };
}

/** Whether a movement of this reason shows in the deck in this mode (charges of a subscription are the reconciliation's job). */
export function shownInDeck(row: { review_reason: string | null; subscription_id?: string | null }, mode: ReviewMode) {
  if (mode === "all") return true;
  return row.review_reason !== "sure" && !row.subscription_id;
}

// --- What the card explains ---------------------------------------------------------------------

export type ReviewWhy =
  | { kind: "rule"; pattern: string }
  | { kind: "same"; count: number }
  | { kind: "split"; counts: PairCount[] }
  | { kind: "once" }
  | { kind: "new"; guessed: boolean }
  | { kind: "transfer" }
  | { kind: "settle"; merchant: string; minutes: number }
  | { kind: "linked" };

export interface CardInsight {
  why: ReviewWhy;
  /** Other likely categories, most likely first, without the current one (up to 3). */
  alternatives: CategoryPair[];
}

/** The "why" line and the alternative chips of a card, from what the movement has now and the merchant's history. */
export function explainCard(input: {
  tx: CategoryPair & { review_reason: string | null; subscription_id?: string | null; description: string | null; bank_description?: string | null; type: string };
  rule: CategoryPair | null;
  merchantHistory: readonly HistoryRow[];
  settleWith?: { description: string | null; minutes: number } | null;
}): CardInsight {
  const { tx, rule, merchantHistory, settleWith } = input;
  const counts = tally(merchantHistory);
  const alternatives = counts.map((c) => c.pair).filter((p) => !samePair(p, tx) && p.category_id).slice(0, 3);
  let why: ReviewWhy;
  if (tx.subscription_id) why = { kind: "linked" };
  else if (tx.review_reason === "transfer") why = { kind: "transfer" };
  else if (tx.review_reason === "settle" && settleWith) why = { kind: "settle", merchant: settleWith.description ?? "", minutes: settleWith.minutes };
  else if (rule && samePair(rule, tx)) why = { kind: "rule", pattern: merchantOf(tx) };
  else if (counts.length === 0) why = { kind: "new", guessed: !!tx.category_id };
  else if (counts.length === 1) why = counts[0].count === 1 ? { kind: "once" } : { kind: "same", count: counts[0].count };
  else why = { kind: "split", counts: counts.slice(0, 3) };
  return { why, alternatives };
}
