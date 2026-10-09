"use client";

import { Fragment, useEffect, useEffectEvent, useState } from "react";
import { Chips, Stepper } from "@/components/SheetFields";
import { PushDeviceSection } from "@/components/notifications/PushDeviceSection";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/hooks/useLang";
import { useNotificationSettings, useSaveNotificationSettings } from "@/hooks/useNotifications";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";
import {
  familyLabelKey,
  isToggleEnabled,
  NOTIFICATION_FAMILIES,
  NOTIFICATION_TOGGLES,
  RENEWAL_OFFSETS,
  setToggleEnabled,
  type NotificationToggle,
  type RenewalOffset,
} from "@/lib/notifications/catalog";
import type { NotificationType } from "@/lib/notifications/catalog";

const SectionHead = ({ title }: { title: string }) => (
  <div className="lp-section-head">
    <span className="lp-section-title">{title}</span>
  </div>
);

function SwitchRow({ label, description, checked, disabled, onChange }: { label: string; description?: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="lp-row lp-pref">
      <span className="lp-main">
        <span className="lp-title">
          <span>{label}</span>
        </span>
        {description && <span className="lp-desc">{description}</span>}
      </span>
      <Switch className="lp-pref-control" checked={checked} disabled={disabled} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

/** Day of the month for the summary: a stepper that saves once the user stops tapping. */
function SummaryDayRow({ saved, onSave }: { saved: number; onSave: (day: number) => void }) {
  const t = useTranslations(useLang());
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? saved;
  const save = useEffectEvent(onSave);

  useEffect(() => {
    if (draft === null || draft === saved) return;
    const timer = window.setTimeout(() => {
      save(draft);
      setDraft(null);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, saved]);

  return (
    <div className="lp-row lp-row--static lp-pref">
      <span className="lp-main">
        <span className="lp-title">
          <span>{t("notifSettings.summaryDay")}</span>
        </span>
        <span className="lp-desc">{t("notifSettings.summaryDayDesc")}</span>
      </span>
      <div className="lp-pref-control">
        <Stepper value={value} min={1} max={28} label={t("notifSettings.summaryDay")} onChange={setDraft} />
      </div>
    </div>
  );
}

/**
 * Profile section "Notifications": this device's push state, hide amounts in push, then a switch per
 * type of notification grouped by family, with the settings that belong to some of them (default
 * renewal reminders, day of the monthly summary). Everything saves right away (optimistic).
 */
export function NotificationSettingsSection() {
  const t = useTranslations(useLang());
  const { data: settings } = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const loading = !settings;
  const disabledTypes = settings?.disabled_types ?? [];

  const toggle = (item: NotificationToggle, enabled: boolean) =>
    save.mutate({ disabled_types: setToggleEnabled(item, disabledTypes, enabled) as NotificationType[] });

  const extras = (item: NotificationToggle) => {
    if (!settings || !isToggleEnabled(item, disabledTypes)) return null;
    if (item.id === "subscription.renewal") {
      return (
        <div className="lp-row lp-row--static lp-pref">
          <span className="lp-main">
            <span className="lp-title">
              <span>{t("notifSettings.renewalOffsets")}</span>
            </span>
            <span className="lp-desc">{t("notifSettings.renewalOffsetsDesc")}</span>
          </span>
          <div className="w-full">
            <Chips
              multiple
              label={t("notifSettings.renewalOffsets")}
              value={settings.default_renewal_offsets.map(String)}
              onChange={(values) => save.mutate({ default_renewal_offsets: values.map(Number).sort((a, b) => a - b) as RenewalOffset[] })}
              options={RENEWAL_OFFSETS.map((offset) => ({ value: String(offset), label: t(`notifSettings.offset.${offset}` as UIKey) }))}
            />
          </div>
        </div>
      );
    }
    if (item.id === "summary.monthly") return <SummaryDayRow saved={settings.summary_day} onSave={(day) => save.mutate({ summary_day: day })} />;
    return null;
  };

  return (
    <>
      <section className="lp-section scroll-mt-4" id="notifications">
        <SectionHead title={t("notifSettings.title")} />
        <div className="lp-card lp-group">
          <PushDeviceSection />
          <SwitchRow
            label={t("notifSettings.hideAmounts")}
            description={t("notifSettings.hideAmountsDesc")}
            checked={settings?.push_hide_amounts ?? false}
            disabled={loading}
            onChange={(hide) => save.mutate({ push_hide_amounts: hide })}
          />
        </div>
        <p className="lp-desc px-1">{t("notifSettings.desc")}</p>
      </section>

      {NOTIFICATION_FAMILIES.map((family) => (
        <section key={family} className="lp-section">
          <SectionHead title={t(familyLabelKey(family))} />
          <div className="lp-card lp-group">
            {NOTIFICATION_TOGGLES.filter((item) => item.family === family).map((item) => (
              <Fragment key={item.id}>
                <SwitchRow
                  label={t(item.labelKey)}
                  description={t(item.descKey)}
                  checked={isToggleEnabled(item, disabledTypes)}
                  disabled={loading}
                  onChange={(enabled) => toggle(item, enabled)}
                />
                {extras(item)}
              </Fragment>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
