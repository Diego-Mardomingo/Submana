"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert, CircleHelp, SquarePen, Trash2, TrendingDown, TrendingUp, Users, XCircle } from "lucide-react";
import IconPicker from "@/components/IconPicker";
import { SensitiveAmount } from "@/components/SensitiveAmount";
import {
  AmountField,
  ActionRow,
  Chips,
  FieldGroup,
  FieldRow,
  FieldStack,
  FormError,
  FormHero,
  HeroTile,
  InfoRow,
  RowInput,
  Segmented,
  SheetButton,
  Stepper,
} from "@/components/SheetFields";
import { ChargePickerSheet, ChargesGroup, PriceGroup, SubscriptionNotices } from "@/components/SubscriptionCharges";
import { useFrequencyLabel, useSubscriptionActions } from "@/components/SubscriptionDialogs";
import { initialSharing, sharingInput, SubscriptionSharingFields } from "@/components/SubscriptionSharing";
import { TransactionSheet } from "@/components/TransactionSheet";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { parseCurrencyValue } from "@/lib/currency";
import { useAccounts } from "@/hooks/useAccounts";
import { useGroups } from "@/hooks/useGroups";
import { useProfile } from "@/hooks/useProfile";
import { useLang } from "@/hooks/useLang";
import { useNotificationSettings } from "@/hooks/useNotifications";
import { useCreateSubscription, useUpdateSubscription, type Subscription } from "@/hooks/useSubscriptions";
import { parseDateString, toDateString } from "@/lib/date";
import { formatCurrency, localeOf } from "@/lib/format";
import type { UIKey } from "@/lib/i18n/ui";
import { RENEWAL_OFFSETS } from "@/lib/notifications/catalog";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { toast } from "@/lib/toast";
import { isSubscriptionActive, monthlyCost, nextPaymentDate } from "@/lib/subscriptions";
import { chargeHistory, lastCharge, pendingPriceChange, reconciledTotal } from "@/lib/subscriptionReconciliation";
import { myShareCents } from "@/lib/shared/subscriptionSplit";
import { fromCents, toCents } from "@/lib/shared/splits";

type Mode = "view" | "edit";

const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
/** Days need room for "every 90 / 365 days"; the other units stay under 100. */
const maxEvery = (frequency: Subscription["frequency"]) => (frequency === "daily" ? 999 : 99);

const offsetLabelKey = (offset: number) => `notifSettings.offset.${offset}` as UIKey;

function SubscriptionTile({ sub }: { sub: Pick<Subscription, "icon" | "service_name"> }) {
  return (
    <HeroTile>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote service logos */}
      <img src={sub.icon || initialsAvatarDataUri(sub.service_name || "?")} alt="" />
    </HeroTile>
  );
}

/** Read-only card: dates, totals and the cancel / delete actions. */
function SubscriptionDetails({ sub, onEdit, onClose }: { sub: Subscription; onEdit: () => void; onClose: () => void }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const freqLabel = useFrequencyLabel();
  const { data: accounts = [] } = useAccounts();
  const actions = useSubscriptionActions();
  const account = accounts.find((a) => a.id === sub.account_id);
  const active = isSubscriptionActive(sub);
  const next = nextPaymentDate(sub);
  const isMonthly = sub.frequency === "monthly" && (sub.frequency_value || 1) === 1;
  const day = (date: Date) => date.toLocaleDateString(localeOf(lang), { day: "numeric", month: "short", year: "numeric" });
  const muted = <span className="is-muted">—</span>;
  const [pickCharge, setPickCharge] = useState<string | null>(null);
  const [openTx, setOpenTx] = useState<string | null>(null);
  const change = active ? pendingPriceChange(sub) : null;
  const missed = active && lastCharge(sub)?.status === "missed";
  const review = active && chargeHistory(sub).some((c) => c.status === "review");
  const spent = reconciledTotal(sub);
  // Shared in a Subcount group: my part of each charge at the current price.
  const { data: groups = [] } = useGroups(!!sub.shared_group_id);
  const { data: profile } = useProfile();
  const group = sub.shared_group_id ? groups.find((g) => g.id === sub.shared_group_id) : undefined;
  const myPart =
    group && sub.shared_split && profile
      ? fromCents(myShareCents(sub.shared_split, group.members.map((m) => m.user_id), toCents(sub.cost), profile.user_id, profile.user_id))
      : null;

  return (
    <>
      <SheetBody>
        <FormHero>
          <SubscriptionTile sub={sub} />
          <h3 className="sf-hero-name">{sub.service_name}</h3>
          <span className="sf-hero-value">
            <SensitiveAmount>{formatCurrency(Number(sub.cost))}</SensitiveAmount>
            <small>/ {freqLabel(sub).toLowerCase()}</small>
          </span>
          <div className="sf-hero-badges">
            <span className={`sf-badge ${active ? "sf-badge--success" : "sf-badge--muted"}`}>{t(active ? "sub.active" : "sub.inactive")}</span>
            {sub.end_date && active && (
              <span className="sf-badge sf-badge--warn">
                {es ? "Termina" : "Ends"} {day(parseDateString(sub.end_date))}
              </span>
            )}
            {change && (
              <span className="sf-badge sf-badge--warn">
                {change.diff > 0 ? <TrendingUp aria-hidden /> : <TrendingDown aria-hidden />}
                <SensitiveAmount>{interpolate(t("sub.badge.charged"), { amount: formatCurrency(change.charged) })}</SensitiveAmount>
              </span>
            )}
            {group && (
              <span className="sf-badge sf-badge--accent">
                <Users aria-hidden />
                {t("sub.share.badge")}
              </span>
            )}
            {review && (
              <span className="sf-badge sf-badge--accent">
                <CircleHelp aria-hidden />
                {t("sub.status.review")}
              </span>
            )}
            {missed && (
              <span className="sf-badge sf-badge--danger">
                <CircleAlert aria-hidden />
                {t("sub.badge.missed")}
              </span>
            )}
          </div>
        </FormHero>

        <SubscriptionNotices sub={sub} onLink={setPickCharge} />

        <FieldGroup
          hint={
            spent.linked === 0
              ? undefined
              : spent.estimated > 0
                ? interpolate(t("sub.totalHintMixed"), { linked: spent.linked, estimated: spent.estimated })
                : spent.linked === 1
                  ? t("sub.totalHintOne")
                  : interpolate(t("sub.totalHint"), { count: spent.linked })
          }
        >
          <InfoRow label={t("sub.nextPayment")}>{next ? <span className="lp-soon">{day(next)}</span> : muted}</InfoRow>
          <InfoRow label={t("subscriptions.reminders")}>
            {sub.reminder_offsets?.length ? [...sub.reminder_offsets].sort((a, b) => a - b).map((offset) => t(offsetLabelKey(offset))).join(", ") : muted}
          </InfoRow>
          {!isMonthly && (
            <InfoRow label={es ? "Equivale a" : "Works out at"}>
              <SensitiveAmount>{formatCurrency(monthlyCost(sub))}</SensitiveAmount>
              <span className="is-muted">/{es ? "mes" : "mo"}</span>
            </InfoRow>
          )}
          {myPart !== null && (
            <InfoRow label={t("sub.share.yourPart")}>
              <SensitiveAmount>{formatCurrency(myPart)}</SensitiveAmount>
              <span className="is-muted">/{freqLabel(sub).toLowerCase()}</span>
            </InfoRow>
          )}
          <InfoRow label={t("sub.totalSpent")}>
            <SensitiveAmount>{formatCurrency(spent.total)}</SensitiveAmount>
          </InfoRow>
        </FieldGroup>

        {group && sub.shared_split && (
          <FieldGroup title={t("sub.share.in")}>
            <Link href={`/subcount/${group.id}`} className="sf-row sf-action" onClick={onClose}>
              <span>{group.name}</span>
              <span className="sf-row-value" style={{ flex: "none" }}>
                {group.my_net_cents === 0 ? (
                  <span className="is-muted">{t("sub.share.settled")}</span>
                ) : (
                  <span className={group.my_net_cents > 0 ? "sc-pos" : "sc-neg"}>
                    <SensitiveAmount>
                      {interpolate(t(group.my_net_cents > 0 ? "sub.share.owedToYou" : "sub.share.youOwe"), { amount: formatCurrency(fromCents(Math.abs(group.my_net_cents))) })}
                    </SensitiveAmount>
                  </span>
                )}
              </span>
              <ChevronRight className="sf-action-chevron" aria-hidden />
            </Link>
            <InfoRow label={t("sub.share.split")}>
              {t(`split.mode.${sub.shared_split.mode}` as const)} · {sub.shared_split.participants.length}
            </InfoRow>
          </FieldGroup>
        )}

        <ChargesGroup sub={sub} onLink={setPickCharge} onOpenTransaction={setOpenTx} />
        <PriceGroup sub={sub} />

        <FieldGroup>
          <InfoRow label={t("sub.startDate")}>{day(parseDateString(sub.start_date))}</InfoRow>
          <InfoRow label={t("sub.endDate")}>{sub.end_date ? day(parseDateString(sub.end_date)) : muted}</InfoRow>
          <InfoRow label={t("sub.account")}>
            {account ? (
              <>
                <span className="sf-dot" style={{ background: account.color || "var(--accent)" }} />
                {account.name}
              </>
            ) : (
              <span className="is-muted">{es ? "Sin cuenta" : "No account"}</span>
            )}
          </InfoRow>
          {sub.match_pattern && <InfoRow label={t("sub.bankText")}>{sub.match_pattern}</InfoRow>}
        </FieldGroup>

        <FieldGroup>
          {active && !sub.end_date && (
            <ActionRow tone="warn" icon={<XCircle aria-hidden />} onClick={() => {
                void actions.cancel(sub);
                onClose();
              }}
            >
              {t("sub.cancel")}
            </ActionRow>
          )}
          <ActionRow
            tone="danger"
            icon={<Trash2 aria-hidden />}
            onClick={() => {
              actions.remove(sub);
              onClose();
            }}
          >
            {es ? "Eliminar suscripción" : "Delete subscription"}
          </ActionRow>
        </FieldGroup>
      </SheetBody>
      <SheetFooter>
        <SheetButton type="button" onClick={onEdit}>
          <SquarePen aria-hidden />
          {t("sub.edit")}
        </SheetButton>
      </SheetFooter>
      <ChargePickerSheet sub={sub} chargeDate={pickCharge} onOpenChange={(open) => !open && setPickCharge(null)} />
      <TransactionSheet open={!!openTx} onOpenChange={(open) => !open && setOpenTx(null)} transactionId={openTx} />
    </>
  );
}

function SubscriptionFormBody({ sub, onDone, onBack }: { sub: Subscription | null; onDone: () => void; onBack?: () => void }) {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const { data: accounts = [] } = useAccounts();
  const createSub = useCreateSubscription();
  const updateSub = useUpdateSubscription({ silentError: true }); // errors show inline

  const [icon, setIcon] = useState(sub?.icon || "");
  const [name, setName] = useState(sub?.service_name ?? "");
  const [cost, setCost] = useState(sub ? Number(sub.cost).toFixed(2).replace(".", ",") : "");
  const [startDate, setStartDate] = useState(() => (sub?.start_date ? parseDateString(sub.start_date) : new Date()));
  const [endDate, setEndDate] = useState(() => (sub?.end_date ? parseDateString(sub.end_date) : undefined));
  const [frequency, setFrequency] = useState<Subscription["frequency"]>(sub?.frequency ?? "monthly");
  const [every, setEvery] = useState(sub?.frequency_value || 1);
  const [accountId, setAccountId] = useState(sub?.account_id ?? "");
  const [matchPattern, setMatchPattern] = useState(sub?.match_pattern ?? "");
  const [sharing, setSharing] = useState(() => initialSharing(sub));
  const { data: profile } = useProfile();
  // Reminders: a new subscription starts with the default of the profile (still loading? the default of the app).
  const { data: notificationSettings } = useNotificationSettings();
  const [pickedOffsets, setPickedOffsets] = useState<number[] | null>(null);
  const offsets = pickedOffsets ?? (sub ? sub.reminder_offsets : notificationSettings?.default_renewal_offsets) ?? [1];
  const [error, setError] = useState("");
  const [costInvalid, setCostInvalid] = useState(false);
  const units = { daily: ["día", "días", "day", "days"], weekly: ["semana", "semanas", "week", "weeks"], monthly: ["mes", "meses", "month", "months"], yearly: ["año", "años", "year", "years"] }[frequency];
  const unit = units[(es ? 0 : 2) + (every === 1 ? 0 : 1)];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amount = parseCurrencyValue(cost);
    if (amount <= 0) {
      setCostInvalid(true);
      setError(es ? "Introduce un coste mayor que 0" : "Enter a cost greater than 0");
      return;
    }
    if (!name.trim()) {
      setError(es ? "Ponle un nombre a la suscripción" : "Give the subscription a name");
      return;
    }
    if (endDate && endDate < startDate) {
      setError(es ? "La fecha de fin no puede ser anterior al inicio" : "The end date can't be before the start date");
      return;
    }
    const share = sharingInput(sharing, sub, toCents(amount), profile?.user_id ?? "");
    if (share === "invalid") {
      setError(t("sub.share.invalid"));
      return;
    }
    const input = {
      icon: icon || undefined,
      service_name: name.trim(),
      cost: amount,
      start_date: toDateString(startDate),
      end_date: endDate ? toDateString(endDate) : null,
      frequency,
      frequency_value: every,
      account_id: accountId || null,
      reminder_offsets: offsets,
      ...(sub && { match_pattern: matchPattern.trim() || null }),
      ...share,
    };
    try {
      if (sub) await updateSub.mutateAsync({ id: sub.id, ...input });
      else await createSub.mutateAsync(input);
      toast.success(t(sub ? "sub.saved" : "sub.created"));
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error";
      setError(message === "group_not_found" ? t("sub.share.groupGone") : message === "invalid_shares" ? t("sub.share.invalid") : message);
    }
  };

  return (
    <SheetForm onSubmit={handleSubmit}>
      <SheetBody>
        <FormHero>
          <SubscriptionTile sub={{ icon, service_name: name }} />
          <AmountField
            id="sub-cost"
            label={t("sub.cost")}
            value={cost}
            invalid={costInvalid}
            onChange={(value) => {
              setCost(value);
              setCostInvalid(false);
            }}
          />
        </FormHero>

        <FieldGroup>
          <FieldRow label={t("sub.name")} htmlFor="sub-name">
            <RowInput
              id="sub-name"
              placeholder={t("sub.namePlaceholder")}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              enterKeyHint="done"
            />
          </FieldRow>
          <IconPicker value={icon} onChange={setIcon} name={name} />
        </FieldGroup>

        <FieldGroup title={t("sub.frequency")}>
          <FieldStack>
            <Segmented
              label={t("sub.frequency")}
              value={frequency}
              onChange={(next) => {
                setFrequency(next);
                setEvery((n) => Math.min(n, maxEvery(next)));
              }}
              options={FREQUENCIES.map((f) => ({ value: f, label: t(`sub.${f}`) }))}
            />
          </FieldStack>
          <FieldRow label={es ? `Cada ${every} ${unit}` : `Every ${every} ${unit}`}>
            <Stepper value={every} onChange={setEvery} max={maxEvery(frequency)} label={t("sub.every")} />
          </FieldRow>
        </FieldGroup>

        <FieldGroup title={es ? "Fechas" : "Dates"}>
          <FieldRow label={es ? "Inicio" : "Start"}>
            <DatePicker value={startDate} onChange={(date) => date && setStartDate(date)} placeholder={es ? "Elegir" : "Pick"} lang={lang} className="sf-picker" />
          </FieldRow>
          <FieldRow label={es ? "Fin" : "End"}>
            <DatePicker value={endDate} onChange={setEndDate} placeholder={es ? "Sin fecha de fin" : "No end date"} lang={lang} clearable className="sf-picker" />
          </FieldRow>
        </FieldGroup>

        <FieldGroup title={t("subscriptions.reminders")} hint={t("subscriptions.remindersHint")}>
          <FieldStack>
            <Chips
              multiple
              scroll
              label={t("subscriptions.reminders")}
              value={offsets.map(String)}
              onChange={(values) => setPickedOffsets(values.map(Number).sort((a, b) => a - b))}
              options={RENEWAL_OFFSETS.map((offset) => ({ value: String(offset), label: t(offsetLabelKey(offset)) }))}
            />
          </FieldStack>
        </FieldGroup>

        <FieldGroup title={t("sub.account")} hint={es ? "Opcional: la cuenta desde la que se paga" : "Optional: the account it's paid from"}>
          <FieldStack>
            <Chips
              scroll
              label={t("sub.account")}
              value={accountId}
              onChange={setAccountId}
              options={[
                { value: "", label: es ? "Sin cuenta" : "None" },
                ...accounts.map((a) => ({ value: a.id, label: a.name, color: a.color || "var(--accent)", icon: <span className="sf-chip-dot" aria-hidden /> })),
              ]}
            />
          </FieldStack>
        </FieldGroup>

        <SubscriptionSharingFields sub={sub} state={sharing} onChange={setSharing} costCents={toCents(parseCurrencyValue(cost) || 0)} />

        {sub && (
          <FieldGroup hint={t("sub.bankTextHint")}>
            <FieldRow label={t("sub.bankTextField")} htmlFor="sub-bank-text">
              <RowInput
                id="sub-bank-text"
                placeholder={t("sub.bankTextPlaceholder")}
                value={matchPattern}
                maxLength={200}
                onChange={(e) => setMatchPattern(e.target.value)}
                enterKeyHint="done"
              />
            </FieldRow>
          </FieldGroup>
        )}
      </SheetBody>

      <SheetFooter>
        <FormError>{error}</FormError>
        <div className="sheet-footer-row">
          {onBack && (
            <SheetButton type="button" variant="ghost" onClick={onBack} className="!flex-none">
              <ChevronLeft aria-hidden />
              {es ? "Volver" : "Back"}
            </SheetButton>
          )}
          <SheetButton type="submit" pending={createSub.isPending || updateSub.isPending}>
            {t(sub ? "sub.saveChanges" : "sub.create")}
          </SheetButton>
        </div>
      </SheetFooter>
    </SheetForm>
  );
}

/**
 * Subscription sheet: its details (with cancel / delete), the edit form, or the create form
 * when there is no `subscription`.
 */
export function SubscriptionSheet({ open, onOpenChange, subscription, mode = "view" }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription?: Subscription | null;
  /** What an existing subscription opens on. */
  mode?: Mode;
}) {
  const lang = useLang();
  const t = useTranslations(lang);
  const sub = useSheetPayload(open, subscription ?? null);
  const [current, setCurrent] = useState<Mode>(mode);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setCurrent(mode);
  }
  const close = () => onOpenChange(false);
  const title = !sub ? t("sub.new") : current === "view" ? sub.service_name : lang === "es" ? "Editar suscripción" : "Edit subscription";

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title}>
      {sub && current === "view" ? (
        <SubscriptionDetails sub={sub} onEdit={() => setCurrent("edit")} onClose={close} />
      ) : (
        <SubscriptionFormBody
          key={current}
          sub={sub}
          onDone={mode === "view" && sub ? () => setCurrent("view") : close}
          onBack={mode === "view" && sub ? () => setCurrent("view") : undefined}
        />
      )}
    </Sheet>
  );
}
