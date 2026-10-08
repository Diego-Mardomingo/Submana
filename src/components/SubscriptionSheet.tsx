"use client";

import { useState } from "react";
import { ChevronLeft, SquarePen, Trash2, XCircle } from "lucide-react";
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
import { useFrequencyLabel, useSubscriptionActions } from "@/components/SubscriptionDialogs";
import { DatePicker } from "@/components/ui/date-picker";
import { Sheet, SheetBody, SheetFooter, SheetForm, useSheetPayload } from "@/components/ui/sheet";
import { parseCurrencyValue } from "@/lib/currency";
import { useAccounts } from "@/hooks/useAccounts";
import { useLang } from "@/hooks/useLang";
import { useCreateSubscription, useUpdateSubscription, type Subscription } from "@/hooks/useSubscriptions";
import { parseDateString, toDateString } from "@/lib/date";
import { formatCurrency, localeOf } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";
import { toast } from "@/lib/toast";
import { isSubscriptionActive, monthlyCost, nextPaymentDate, totalSpent } from "@/lib/subscriptions";

type Mode = "view" | "edit";

const FREQUENCIES = ["weekly", "monthly", "yearly"] as const;

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
          </div>
        </FormHero>

        <FieldGroup>
          <InfoRow label={t("sub.nextPayment")}>{next ? <span className="lp-soon">{day(next)}</span> : muted}</InfoRow>
          {!isMonthly && (
            <InfoRow label={es ? "Equivale a" : "Works out at"}>
              <SensitiveAmount>{formatCurrency(monthlyCost(sub))}</SensitiveAmount>
              <span className="is-muted">/{es ? "mes" : "mo"}</span>
            </InfoRow>
          )}
          <InfoRow label={t("sub.totalSpent")}>
            <SensitiveAmount>{formatCurrency(totalSpent(sub))}</SensitiveAmount>
          </InfoRow>
        </FieldGroup>

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
  const [error, setError] = useState("");
  const [costInvalid, setCostInvalid] = useState(false);
  const units = { weekly: ["semana", "semanas", "week", "weeks"], monthly: ["mes", "meses", "month", "months"], yearly: ["año", "años", "year", "years"] }[frequency];
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
    const input = {
      icon: icon || undefined,
      service_name: name.trim(),
      cost: amount,
      start_date: toDateString(startDate),
      end_date: endDate ? toDateString(endDate) : null,
      frequency,
      frequency_value: every,
      account_id: accountId || null,
    };
    try {
      if (sub) await updateSub.mutateAsync({ id: sub.id, ...input });
      else await createSub.mutateAsync(input);
      toast.success(t(sub ? "sub.saved" : "sub.created"));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
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
              onChange={setFrequency}
              options={FREQUENCIES.map((f) => ({ value: f, label: t(`sub.${f}`) }))}
            />
          </FieldStack>
          <FieldRow label={es ? `Cada ${every} ${unit}` : `Every ${every} ${unit}`}>
            <Stepper value={every} onChange={setEvery} label={t("sub.every")} />
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
