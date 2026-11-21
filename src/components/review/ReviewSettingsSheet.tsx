"use client";

import { FieldGroup, FieldStack, Segmented } from "@/components/SheetFields";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useLang } from "@/hooks/useLang";
import { useNotificationSettings, useSaveNotificationSettings } from "@/hooks/useNotifications";
import { interpolate, useTranslations } from "@/lib/i18n/utils";
import { isToggleEnabled, NOTIFICATION_TOGGLES, setToggleEnabled, type NotificationType } from "@/lib/notifications/catalog";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notifications/types";
import type { ReviewMode } from "@/lib/review/classify";
import { weekdayName } from "@/lib/review/weekdays";

const REVIEW_TOGGLE = NOTIFICATION_TOGGLES.find((toggle) => toggle.id === "review.pending")!;

/** "What to review" (also in My profile) and whether to get the weekly notification. */
export function ReviewModeFields({ onModeChange }: { onModeChange?: (mode: ReviewMode) => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: settings } = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const mode = settings?.review_mode ?? DEFAULT_NOTIFICATION_SETTINGS.review_mode;
  return (
    <FieldGroup hint={t(mode === "all" ? "review.settings.allHint" : "review.settings.doubtHint")}>
      <FieldStack>
        <Segmented<ReviewMode>
          label={t("review.settings")}
          value={mode}
          onChange={(value) => {
            if (value === mode) return;
            save.mutate({ review_mode: value }, { onSuccess: () => onModeChange?.(value) });
          }}
          options={[
            { value: "doubt", label: t("review.settings.doubt") },
            { value: "all", label: t("review.settings.all") },
          ]}
        />
      </FieldStack>
    </FieldGroup>
  );
}

export function ReviewSettingsSheet({ open, onOpenChange, onModeChange }: { open: boolean; onOpenChange: (open: boolean) => void; onModeChange: () => void }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: settings } = useNotificationSettings();
  const save = useSaveNotificationSettings();
  const disabled = settings?.disabled_types ?? [];
  const notify = isToggleEnabled(REVIEW_TOGGLE, disabled);
  const day = weekdayName(settings?.review_day ?? DEFAULT_NOTIFICATION_SETTINGS.review_day, lang);
  const min = settings?.review_min ?? DEFAULT_NOTIFICATION_SETTINGS.review_min;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("review.settings")}>
      <SheetBody>
        <ReviewModeFields
          onModeChange={() => {
            onOpenChange(false);
            onModeChange();
          }}
        />
        <FieldGroup hint={t("review.settings.notifyWhere")}>
          <label className="lp-row lp-pref">
            <span className="lp-main">
              <span className="lp-title">
                <span>{t("review.settings.notify")}</span>
              </span>
              <span className="lp-desc">{interpolate(t(min === 1 ? "review.settings.notifyDescOne" : "review.settings.notifyDesc"), { day, min: String(min) })}</span>
            </span>
            <Switch
              className="lp-pref-control"
              checked={notify}
              disabled={!settings}
              onCheckedChange={(enabled) => save.mutate({ disabled_types: setToggleEnabled(REVIEW_TOGGLE, disabled, enabled) as NotificationType[] })}
              aria-label={t("review.settings.notify")}
            />
          </label>
        </FieldGroup>
      </SheetBody>
    </Sheet>
  );
}
