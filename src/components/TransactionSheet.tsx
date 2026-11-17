"use client";

import { useState } from "react";
import { Check, CircleHelp, Plus, Repeat, Trash2 } from "lucide-react";
import {
  ActionRow,
  AmountField,
  Chips,
  FieldGroup,
  FieldRow,
  FieldStack,
  FormError,
  FormHero,
  RowInput,
  Segmented,
  SheetButton,
} from "@/components/SheetFields";
import { AccountSheet } from "@/components/AccountSheet";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { parseCurrencyValue } from "@/lib/currency";
import { useAccounts } from "@/hooks/useAccounts";
import { useCategories, useCategoryLookup } from "@/hooks/useCategories";
import { useBudgetWarning } from "@/hooks/useBudgets";
import { useResolveBankReview } from "@/hooks/useBanking";
import { useLang } from "@/hooks/useLang";
import { useUnlinkCharge } from "@/components/SubscriptionCharges";
import { useChargeAction, useLinkTransaction, useResolveReview, useSubscriptions, type Subscription } from "@/hooks/useSubscriptions";
import type { ManualMatchInfo } from "@/lib/subscriptionAutoMatch";
import {
  useCategoryUsage,
  useCreateTransaction,
  useUndoableDeleteTransaction,
  useSimilarTransactions,
  useTransaction,
  useUpdateTransaction,
  type Transaction,
} from "@/hooks/useTransactions";
import { parseDateString, toDateString } from "@/lib/date";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import { formatCurrency, localeOf } from "@/lib/format";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";
import { transactionSubject } from "@/lib/toastSubjects";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { isSubscriptionActive } from "@/lib/subscriptions";
import { chargeDateFor, daysBetween, priceAt } from "@/lib/subscriptionReconciliation";

/** What "save and add another" keeps for the next transaction. */
type Carry = { type: "income" | "expense"; date: Date; accountId: string };

/** Chips shown before "+N more"; a list only a couple longer than this is shown whole. */
const TOP_CATEGORIES = 7;

function TransactionForm({ transaction, defaultAccountId, defaultDate, carry, onDone, onUseSimilar, onAddAnother }: {
  transaction: Transaction | null;
  defaultAccountId?: string;
  defaultDate?: Date;
  /** Kept from the transaction just saved with "save and add another". */
  carry?: Carry;
  onDone: () => void;
  /** Create mode only: switch to editing a bank-backed transaction that already exists. */
  onUseSimilar?: (tx: Transaction) => void;
  /** Create mode only: shows "save and add another", which saves and starts a new form. */
  onAddAnother?: (carry: Carry) => void;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts();
  const { data: categoriesData } = useCategories();
  const { data: usageData } = useCategoryUsage();
  const categoryNames = useCategoryLookup().name;
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useUndoableDeleteTransaction();
  const watchBudgets = useBudgetWarning();

  const [type, setType] = useState<"income" | "expense">(transaction?.type ?? carry?.type ?? "expense");
  const [amount, setAmount] = useState(transaction ? Number(transaction.amount).toFixed(2).replace(".", ",") : "");
  const [date, setDate] = useState(() => (transaction ? parseDateString(transaction.date) : (carry?.date ?? defaultDate ?? new Date())));
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [pickedAccountId, setAccountId] = useState(transaction?.account_id ?? carry?.accountId ?? "");
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategory_id ?? "");
  const [error, setError] = useState("");
  const [amountInvalid, setAmountInvalid] = useState(false);
  const [submitter, setSubmitter] = useState<"save" | "again">("save");
  const [allCategories, setAllCategories] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const { data: subscriptions = [] } = useSubscriptions();
  const linkTx = useLinkTransaction();
  const unlinkCharge = useUnlinkCharge();
  const chargeAction = useChargeAction();
  const resolveReview = useResolveReview();
  const linkedTo = transaction?.subscription_id ?? "";
  // A row of a joint account may be linked to another member's subscription: leave that link alone.
  const ownLink = !linkedTo || subscriptions.some((s) => s.id === linkedTo);
  const [subscriptionId, setSubscriptionId] = useState(linkedTo);

  // New transactions default to the page's account, then to the account marked as default.
  const accountId = pickedAccountId || (transaction ? "" : (defaultAccountId ?? accounts.find((a) => a.is_default)?.id ?? ""));
  // Joint accounts only use system categories: a member's personal categories mean nothing to the others.
  const jointAccount = !!accounts.find((a) => a.id === accountId)?.is_joint;
  const parents = [...(jointAccount ? [] : (categoriesData?.userCategories ?? [])), ...(categoriesData?.defaultCategories ?? [])].filter((c) => !c.parent_id);
  const category = parents.find((c) => c.id === categoryId);
  // System categories also nest the user's own subcategories; those are personal too.
  const subcategories = (category?.subcategories ?? []).filter((s) => !jointAccount || s.isDefault);
  const subcategory = subcategories.find((s) => s.id === subcategoryId);
  const excludedFromMetrics = category?.exclude_from_metrics || subcategory?.exclude_from_metrics;
  const label = (c: { id: string; name: string }) => categoryNames.get(c.id) ?? c.name;

  // Most used first (last 90 days, this type); ties keep the server's order. Long lists start collapsed.
  const usage = usageData?.[type] ?? {};
  const byUse = <T extends { id: string }>(list: T[]) => [...list].sort((a, b) => (usage[b.id] ?? 0) - (usage[a.id] ?? 0));
  const sortedParents = byUse(parents);
  const collapsible = sortedParents.length > TOP_CATEGORIES + 2;
  const topParents = sortedParents.slice(0, TOP_CATEGORIES);
  const shownParents =
    collapsible && !allCategories ? [...topParents, ...(category && !topParents.includes(category) ? [category] : [])] : sortedParents;
  const hiddenCategories = sortedParents.length - shownParents.length;
  const usedAny = parents.some((c) => usage[c.id]);

  // Subscriptions with a charge near the date, the ones paid from this account first.
  const day = toDateString(date);
  const chargeOf = (s: Subscription) => (s.id === linkedTo && transaction?.subscription_charge_date) || chargeDateFor(s, day);
  const subOptions =
    type !== "expense" || !ownLink
      ? []
      : subscriptions
          .filter((s) => s.id === subscriptionId || (isSubscriptionActive(s, date) && chargeOf(s)))
          .map((s) => ({ sub: s, charge: chargeOf(s) }))
          .sort(
            (a, b) =>
              Number(b.sub.account_id === accountId) - Number(a.sub.account_id === accountId) ||
              Math.abs(daysBetween(a.charge || day, day)) - Math.abs(daysBetween(b.charge || day, day))
          );
  const picked = subOptions.find((o) => o.sub.id === subscriptionId);

  // While creating, look for a bank movement that is probably this same one (avoids a twin the next import must reconcile).
  const { data: similar = [] } = useSimilarTransactions({
    accountId: transaction ? "" : accountId,
    amount: parseCurrencyValue(amount),
    type,
    date: toDateString(date),
    description: description.trim(),
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Enter in a field submits with the first button, "save"; only the second one asks for another.
    const again = !transaction && !!onAddAnother && !!(e.nativeEvent as SubmitEvent).submitter?.hasAttribute("data-again");
    setSubmitter(again ? "again" : "save");
    setError("");
    const num = parseCurrencyValue(amount);
    if (num <= 0) {
      setAmountInvalid(true);
      setError(t("tx.error.amount"));
      return;
    }
    if (!accountId) {
      setError(t("tx.error.account"));
      return;
    }
    const payload = {
      amount: num,
      type,
      date: toDateString(date),
      description: description.trim() || undefined,
      account_id: accountId,
      category_id: (jointAccount && !category ? "" : categoryId) || undefined,
      subcategory_id: (jointAccount && !subcategory ? "" : subcategoryId) || undefined,
    };
    const target = type === "expense" ? subscriptionId : "";
    try {
      const checkBudgets = await watchBudgets(payload);
      // A subscription picked by hand is linked below; otherwise the server looks for the charge itself.
      const saved: { id: string; subscription_match?: ManualMatchInfo } = transaction
        ? await updateTx.mutateAsync({ id: transaction.id, ...payload })
        : await createTx.mutateAsync({ ...payload, ...(target && { auto_match: "0" as const }) });
      toast.success(t(transaction ? "transactions.saved" : "transactions.created"), {
        subject: transactionSubject(payload, subcategory?.emoji ?? category?.emoji ?? undefined, t(type === "income" ? "transactions.income" : "transactions.expense")),
      });
      void checkBudgets();
      if (again) onAddAnother({ type, date, accountId });
      else onDone();
      if (ownLink && saved?.id && target !== linkedTo) void linkSubscription(saved.id, target, num);
      else if (!transaction && saved?.subscription_match) announceMatch(saved.id, saved.subscription_match, num);
    } catch (err) {
      // The server answers with codes in English: say it plainly instead.
      console.error("[TransactionSheet] save", err);
      setError(t("tx.error.save"));
    }
  };

  /** A charge whose amount isn't the saved price: asks whether it's the new one. True when it asked. */
  function askPrice(sub: Subscription, chargeDate: string, amount: number) {
    const cents = (n: number) => Math.round(n * 100);
    if (cents(amount) === cents(priceAt(sub, chargeDate)) || cents(amount) === cents(Number(sub.cost))) return false;
    const diff = amount - Number(sub.cost);
    const decide = (action: "accept_price" | "dismiss_price") =>
      chargeAction.mutateAsync({ id: sub.id, action, chargeDate }).catch(() => toast.error(t("toast.chargeError"), { description: t("toast.chargeErrorDesc") }));
    toast.warning(interpolate(t(diff > 0 ? "toast.priceUp" : "toast.priceDown"), { name: sub.service_name, amount: formatCurrency(amount) }), {
      description: interpolate(t("toast.priceChangedDesc"), { diff: `${diff > 0 ? "+" : "−"}${formatCurrency(Math.abs(diff))}`, saved: formatCurrency(Number(sub.cost)) }),
      action: { label: t("toast.update"), onClick: () => void decide("accept_price") },
      cancel: { label: t("toast.ignore"), onClick: () => void decide("dismiss_price") },
    });
    return true;
  }

  /** What automatic matching found for the transaction just created: one toast. */
  function announceMatch(transactionId: string, match: ManualMatchInfo, amount: number) {
    const sub = subscriptions.find((s) => s.id === match.subscription_id);
    const name = match.service_name;
    const date = parseDateString(match.charge_date).toLocaleDateString(localeOf(lang), { day: "numeric", month: "short" });
    if (match.kind === "unexpected") {
      toast.warning(interpolate(t("toast.unexpected"), { name }), { description: t("toast.unexpectedDesc") });
      return;
    }
    if (match.kind === "review") {
      const answer = (action: "confirm" | "dismiss") =>
        resolveReview
          .mutateAsync({ transactionId, action })
          .then(() => toast.success(interpolate(t(action === "confirm" ? "toast.chargeLinked" : "toast.reviewDismissed"), { name })))
          .catch(() => toast.error(t("toast.chargeError"), { description: t("toast.chargeErrorDesc") }));
      toast.info(interpolate(t("toast.autoReview"), { name }), {
        description: interpolate(t("toast.autoReviewDesc"), { date }),
        action: { label: t("notice.review.confirm"), onClick: () => void answer("confirm") },
        cancel: { label: t("notice.review.dismiss"), onClick: () => void answer("dismiss") },
      });
      return;
    }
    if (match.expected !== undefined && sub && askPrice(sub, match.charge_date, amount)) return;
    toast(interpolate(t("toast.autoLinked"), { name }), {
      icon: <Repeat aria-hidden />,
      description: interpolate(t("toast.autoLinkedDesc"), { date }),
      action: {
        label: t("common.undo"),
        onClick: () => void unlinkCharge(transactionId, { undo: true }).catch(() => toast.error(t("toast.chargeError"))),
      },
    });
  }

  /** Links the saved transaction to the picked subscription (or unlinks it); an amount other than the price gets its own toast. */
  async function linkSubscription(transactionId: string, target: string, amount: number) {
    const sub = subscriptions.find((s) => s.id === target);
    try {
      if (!target) {
        await unlinkCharge(transactionId);
        return;
      }
      const result = await linkTx.mutateAsync({ transactionId, subscriptionId: target });
      const chargeDate = result?.charge_date;
      if (!sub || !chargeDate) return;
      askPrice(sub, chargeDate, amount);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      toast.error(
        message === "charge_taken"
          ? t("link.chargeTaken")
          : message === "no_charge_near" && sub
            ? interpolate(t("link.noCharge"), { name: sub.service_name })
            : t("toast.chargeError")
      );
    }
  }

  const pending = createTx.isPending || updateTx.isPending;

  return (
    <>
    <SheetForm onSubmit={handleSubmit}>
      <SheetBody>
        <Segmented
          label={t("common.type")}
          value={type}
          onChange={setType}
          options={[
            { value: "expense", label: t("transactions.expense"), tone: "expense" },
            { value: "income", label: t("transactions.income"), tone: "income" },
          ]}
        />

        <FormHero>
          <AmountField
            id="tx-amount"
            label={t("common.amount")}
            value={amount}
            tone={type}
            invalid={amountInvalid}
            autoFocus={!!carry}
            onChange={(value) => {
              setAmount(value);
              setAmountInvalid(false);
            }}
          />
        </FormHero>

        {transaction?.review_match_id && <BankReviewBanner transaction={transaction} onDone={onDone} />}
        {transaction?.subscription_review_id && !transaction.subscription_id && <SubscriptionReviewBanner transaction={transaction} onDone={onDone} />}

        {!transaction && onUseSimilar && similar.length > 0 && (
          <div className="similar-banner">
            <span className="similar-banner-title">{t("tx.similar.title")}</span>
            {similar.map((tx) => (
              <div key={tx.id} className="similar-banner-item">
                <div className="similar-banner-text">
                  <span>{tx.bank_description || tx.description || "—"}</span>
                  <span>
                    {interpolate(t("tx.similar.booked"), { date: parseDateString(tx.booked_at ?? tx.date).toLocaleDateString(localeOf(lang)) })}
                    {" · "}
                    <SensitiveAmount>{formatCurrency(Number(tx.amount))}</SensitiveAmount>
                  </span>
                </div>
                <button
                  type="button"
                  className="duplicate-btn duplicate-btn-keep"
                  onClick={() =>
                    onUseSimilar({
                      ...tx,
                      // Keep what the user already typed: the bank row only gains their category and description.
                      description: description.trim() || tx.description,
                      category_id: categoryId || tx.category_id,
                      subcategory_id: subcategoryId || tx.subcategory_id,
                    })
                  }
                >
                  {t("tx.similar.use")}
                </button>
              </div>
            ))}
          </div>
        )}

        <FieldGroup>
          <FieldRow label={t("common.description")} htmlFor="tx-description">
            <RowInput
              id="tx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tx.descriptionPlaceholder")}
              enterKeyHint="done"
            />
          </FieldRow>
          <FieldRow label={t("common.date")}>
            <DatePicker value={date} onChange={(d) => d && setDate(d)} placeholder={t("tx.pickDate")} lang={lang} className="sf-picker" />
          </FieldRow>
        </FieldGroup>

        <FieldGroup title={t("common.account")} hint={!accountsLoading && accounts.length === 0 ? t("tx.noAccountHint") : undefined}>
          {!accountsLoading && accounts.length === 0 ? (
            <ActionRow tone="accent" icon={<Plus aria-hidden />} onClick={() => setAccountSheetOpen(true)}>
              {t("tx.createAccount")}
            </ActionRow>
          ) : (
            <FieldStack>
              <Chips
                scroll
                label={t("common.account")}
                value={accountId}
                onChange={(id) => {
                  setAccountId(id);
                  setError("");
                }}
                options={accounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  color: a.color || "var(--accent)",
                  icon: <span className="sf-chip-dot" aria-hidden />,
                }))}
              />
            </FieldStack>
          )}
        </FieldGroup>

        {subOptions.length > 0 && (
          <FieldGroup
            title={t("tx.subscription")}
            hint={
              picked
                ? picked.charge
                  ? interpolate(t("tx.subscription.hint"), {
                      date: parseDateString(picked.charge).toLocaleDateString(localeOf(lang), { day: "numeric", month: "short" }),
                      amount: formatCurrency(priceAt(picked.sub, picked.charge)),
                    })
                  : t("tx.subscription.noCharge")
                : undefined
            }
          >
            <FieldStack>
              <Chips
                scroll
                label={t("tx.subscription")}
                value={subscriptionId}
                onChange={setSubscriptionId}
                options={[
                  { value: "", label: t("tx.subscription.none") },
                  ...subOptions.map(({ sub }) => ({
                    value: sub.id,
                    label: sub.service_name,
                    // eslint-disable-next-line @next/next/no-img-element -- remote service logos
                    icon: <img src={sub.icon || initialsAvatarDataUri(sub.service_name)} alt="" />,
                  })),
                ]}
              />
            </FieldStack>
          </FieldGroup>
        )}

        <FieldGroup
          title={t("common.category")}
          hint={
            jointAccount
              ? t("joint.categoriesHint")
              : excludedFromMetrics
                ? t("categories.excludeFromMetricsInfo")
                : usedAny
                  ? t("tx.categories.byUse")
                  : undefined
          }
        >
          <FieldStack>
            <Chips
              label={t("common.category")}
              value={categoryId}
              onChange={(id) => {
                setCategoryId(id === categoryId ? "" : id);
                setSubcategoryId("");
              }}
              options={shownParents.map((c) => ({
                value: c.id,
                label: label(c),
                icon: c.emoji ? <span className="sf-chip-emoji">{c.emoji}</span> : undefined,
              }))}
              after={
                collapsible && (
                  <button type="button" className="sf-chip sf-chip--more" aria-expanded={allCategories} onClick={() => setAllCategories(!allCategories)}>
                    <span className="sf-chip-label">
                      {allCategories ? t("tx.categories.less") : interpolate(t("tx.categories.more"), { count: hiddenCategories })}
                    </span>
                  </button>
                )
              }
            />
          </FieldStack>
          {subcategories.length > 0 && (
            <FieldStack label={t("tx.subcategory")}>
              <Chips
                label={t("tx.subcategory")}
                value={subcategoryId}
                onChange={(id) => setSubcategoryId(id === subcategoryId ? "" : id)}
                options={byUse(subcategories).map((c) => ({
                  value: c.id,
                  label: label(c),
                  icon: c.emoji ? <span className="sf-chip-emoji">{c.emoji}</span> : undefined,
                }))}
              />
            </FieldStack>
          )}
        </FieldGroup>

        {transaction && (
          <FieldGroup>
            <ActionRow
              tone="danger"
              icon={<Trash2 aria-hidden />}
              onClick={() => {
                deleteTx(transaction);
                onDone();
              }}
            >
              {t("tx.delete")}
            </ActionRow>
          </FieldGroup>
        )}
      </SheetBody>

      <SheetFooter>
        <FormError>{error}</FormError>
        {transaction || !onAddAnother ? (
          <SheetButton type="submit" pending={pending}>
            {transaction ? t("tx.saveChanges") : t("transactions.add")}
          </SheetButton>
        ) : (
          <div className="sheet-footer-row">
            <SheetButton type="submit" pending={pending && submitter === "save"} disabled={pending}>
              {t("common.save")}
            </SheetButton>
            <SheetButton type="submit" variant="ghost" className="sf-btn--again" data-again pending={pending && submitter === "again"} disabled={pending}>
              {t("tx.saveAndAddAnother")}
            </SheetButton>
          </div>
        )}
      </SheetFooter>
    </SheetForm>

    {/* Outside the form: a submit inside the account sheet would bubble to this form's onSubmit. */}
    <AccountSheet
      open={accountSheetOpen}
      onOpenChange={setAccountSheetOpen}
      onCreated={(account) => {
        setAccountId(account.id);
        setError("");
      }}
    />
    </>
  );
}

/** Automatic matching thinks this may be a subscription charge: confirm it or say it's not. */
function SubscriptionReviewBanner({ transaction, onDone }: { transaction: Transaction; onDone: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: subscriptions = [] } = useSubscriptions();
  const resolve = useResolveReview();
  const sub = subscriptions.find((s) => s.id === transaction.subscription_review_id);
  const chargeDate = transaction.subscription_review_date;
  if (!sub || !chargeDate) return null;
  const date = parseDateString(chargeDate).toLocaleDateString(localeOf(lang), { day: "numeric", month: "short" });

  const run = async (action: "confirm" | "dismiss") => {
    try {
      await resolve.mutateAsync({ transactionId: transaction.id, action });
      toast.success(interpolate(t(action === "confirm" ? "toast.chargeLinked" : "toast.reviewDismissed"), { name: sub.service_name }));
      onDone();
    } catch (error) {
      toast.error(error instanceof Error && error.message === "charge_taken" ? t("link.chargeTaken") : t("toast.chargeError"));
    }
  };

  return (
    <div className="sf-notice sf-notice--accent" role="status">
      <span className="sf-notice-icon">
        <CircleHelp aria-hidden />
      </span>
      <div className="sf-notice-body">
        <span className="sf-notice-title">{interpolate(t("review.banner"), { name: sub.service_name, date })}</span>
        <span className="sf-notice-text">{interpolate(t("tx.subscription.hint"), { date, amount: formatCurrency(priceAt(sub, chargeDate)) })}</span>
        <div className="sf-notice-actions">
          <button type="button" className="sf-notice-btn sf-notice-btn--primary" disabled={resolve.isPending} onClick={() => run("confirm")}>
            <Check aria-hidden />
            {t("notice.review.confirm")}
          </button>
          <button type="button" className="sf-notice-btn" disabled={resolve.isPending} onClick={() => run("dismiss")}>
            {t("notice.review.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A bank-synced movement that may repeat a manual one: merge them (the manual one stays) or keep both. */
function BankReviewBanner({ transaction, onDone }: { transaction: Transaction; onDone: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: twin, isError } = useTransaction(transaction.review_match_id);
  const resolve = useResolveBankReview();

  const run = async (action: "merge" | "dismiss") => {
    try {
      await resolve.mutateAsync({ transactionId: transaction.id, action });
      toast.success(t(action === "merge" ? "bank.review.merged" : "bank.review.dismissed"));
      onDone();
    } catch (error) {
      if (error instanceof Error && error.message === "match_gone") toast.error(t("bank.review.gone"));
      else toast.error(t("bank.sync.error"), { description: t("bank.sync.errorDesc") });
    }
  };

  return (
    <div className="similar-banner" role="status">
      <span className="similar-banner-title">{t("bank.review.title")}</span>
      <span className="similar-banner-text">{t("bank.review.text")}</span>
      {twin && (
        <div className="similar-banner-text">
          <span>{twin.description || "—"}</span>
          <span>
            {parseDateString(twin.date).toLocaleDateString(localeOf(lang))}
            {" · "}
            <SensitiveAmount>{formatCurrency(Number(twin.amount))}</SensitiveAmount>
          </span>
        </div>
      )}
      {isError && <span className="similar-banner-text">{t("bank.review.gone")}</span>}
      <div className="flex flex-wrap gap-2">
        {twin && (
          <button type="button" className="duplicate-btn duplicate-btn-keep" disabled={resolve.isPending} onClick={() => run("merge")}>
            {t("bank.review.merge")}
          </button>
        )}
        <button type="button" className="duplicate-btn" disabled={resolve.isPending} onClick={() => run("dismiss")}>
          {t("bank.review.dismiss")}
        </button>
      </div>
    </div>
  );
}

/**
 * Create/edit form; while creating, "use it" on a similar bank movement swaps to editing that one, and
 * "save and add another" starts a fresh form that keeps the type, date and account.
 */
function TransactionFormBody(props: {
  transaction: Transaction | null;
  defaultAccountId?: string;
  defaultDate?: Date;
  onDone: () => void;
  onAddAnother?: () => void;
}) {
  const [adopted, setAdopted] = useState<Transaction | null>(null);
  const [round, setRound] = useState<{ n: number; carry?: Carry }>({ n: 0 });
  const creating = !props.transaction && !adopted;
  return (
    <TransactionForm
      key={adopted?.id ?? `form-${round.n}`}
      {...props}
      carry={round.carry}
      transaction={adopted ?? props.transaction}
      onUseSimilar={props.transaction ? undefined : setAdopted}
      onAddAnother={
        creating
          ? (carry) => {
              setRound((r) => ({ n: r.n + 1, carry }));
              props.onAddAnother?.();
            }
          : undefined
      }
    />
  );
}

/** Loads a transaction known only by id (e.g. from a notification) before showing the form. */
function TransactionById({ id, onDone }: { id: string; onDone: () => void }) {
  const t = useTranslations(useLang());
  const { data, isLoading, isError } = useTransaction(id);
  if (data) return <TransactionFormBody transaction={data} onDone={onDone} />;
  return (
    <SheetBody className="items-center justify-center py-12 text-sm text-[var(--gris-claro)]">
      {isLoading ? <Spinner className="size-6" /> : isError && t("tx.notFound")}
    </SheetBody>
  );
}

/** Create, edit or delete a transaction: pass the `transaction`, or only its `transactionId`. */
export function TransactionSheet({ open, onOpenChange, transaction, transactionId, defaultAccountId, defaultDate }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  transactionId?: string | null;
  /** Preselected account for new transactions (e.g. from an account's page). */
  defaultAccountId?: string;
  /** Preselected date for new transactions (e.g. the day picked in the calendar). */
  defaultDate?: Date;
}) {
  const t = useTranslations(useLang());
  const shown = useSheetPayload(open, transaction ?? null);
  const shownId = useSheetPayload(open, transactionId ?? null);
  // Saved with "save and add another" since the sheet opened.
  const [added, setAdded] = useState(0);
  const change = (next: boolean) => {
    if (!next) setAdded(0);
    onOpenChange(next);
  };
  const close = () => change(false);
  const editing = !!shown || !!shownId;
  return (
    <Sheet
      open={open}
      onOpenChange={change}
      title={t(editing ? "transactions.edit" : "transactions.add")}
      description={added > 0 ? (added === 1 ? t("tx.addedOne") : interpolate(t("tx.addedMany"), { count: added })) : undefined}
    >
      {shown || !shownId ? (
        <TransactionFormBody
          transaction={shown}
          defaultAccountId={defaultAccountId}
          defaultDate={defaultDate}
          onDone={close}
          onAddAnother={() => setAdded((n) => n + 1)}
        />
      ) : (
        <TransactionById id={shownId} onDone={close} />
      )}
    </Sheet>
  );
}
