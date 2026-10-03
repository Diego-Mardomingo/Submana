"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AtSign } from "lucide-react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { FieldGroup, FieldRow, FormError, RowInput, SheetButton } from "@/components/SheetFields";
import { useHandleAvailability, useSaveProfile, type Profile } from "@/hooks/useProfile";
import { useLang } from "@/hooks/useLang";
import { normalizeHandle, suggestHandle } from "@/lib/handles";
import type { UIKey } from "@/lib/i18n/ui";
import { useTranslations } from "@/lib/i18n/utils";
import { createClient } from "@/lib/supabase/client";

/**
 * Pick or edit the public profile (@handle + display name). Reused by Friends, Groups and Settings:
 * without a `profile` it is the first-time setup (prefilled from the Google account), with one it edits.
 */
export function HandleSetup({ profile, onDone, showIntro = !profile }: {
  profile?: Profile | null;
  /** Called after a successful save. */
  onDone?: (profile: Profile) => void;
  showIntro?: boolean;
}) {
  const t = useTranslations(useLang());
  const { data: user } = useQuery({ queryKey: ["user"], queryFn: async () => (await createClient().auth.getUser()).data.user });
  const save = useSaveProfile();

  const meta = user?.user_metadata as { full_name?: string; name?: string; avatar_url?: string } | undefined;
  const fullName = meta?.full_name ?? meta?.name ?? "";
  const suggestedHandle = profile?.handle ?? (user ? suggestHandle(user.email, fullName) : "");
  const suggestedName = profile?.display_name ?? (fullName || user?.email?.split("@")[0] || "");

  // null = untouched, so the prefill from Google shows as soon as the user loads.
  const [handleInput, setHandleInput] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const handle = handleInput ?? suggestedHandle;
  const displayName = nameInput ?? suggestedName;

  const check = useHandleAvailability(handle, profile?.handle);
  const normalized = normalizeHandle(handle);
  const nameValid = displayName.trim().length >= 1 && displayName.trim().length <= 60;
  const dirty = !profile || normalized !== profile.handle || displayName.trim() !== profile.display_name;
  const canSave = check.status === "available" && nameValid && dirty && !save.isPending;

  const errorText = (code: string | undefined) => {
    if (!code) return null;
    const key = `profile.error.${code}` as UIKey;
    const text = t(key);
    return text === key ? t("profile.error.generic") : text;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setServerError(null);
    save.mutate(
      { handle: normalized, display_name: displayName.trim() },
      {
        onSuccess: (saved) => {
          if (profile) toast.success(t("profile.saved"));
          onDone?.(saved);
        },
        onError: (err) => setServerError(errorText(err.message)),
      }
    );
  };

  const hint =
    check.status === "checking"
      ? t("profile.checking")
      : check.status === "available"
        ? t("profile.available")
        : check.status === "error"
          ? errorText(check.error)
          : t("profile.handleHint");

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {showIntro && (
        <div className="flex flex-col items-center gap-2 text-center pt-2">
          <ProfileAvatar name={displayName || "?"} url={meta?.avatar_url} size={64} />
          <h2 className="text-lg font-semibold">{t("profile.setup.title")}</h2>
          <p className="text-sm text-muted-foreground max-w-sm">{t("profile.setup.desc")}</p>
        </div>
      )}

      <FieldGroup hint={<span className={check.status === "error" ? "text-destructive" : undefined}>{hint}</span>}>
        <FieldRow label={<AtSign className="size-4" aria-label={t("profile.handle")} />} htmlFor="profile-handle">
          <RowInput
            id="profile-handle"
            value={handle}
            onChange={(e) => setHandleInput(e.target.value)}
            maxLength={21}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="handle"
          />
        </FieldRow>
        <FieldRow label={t("profile.displayName")} htmlFor="profile-name">
          <RowInput id="profile-name" value={displayName} onChange={(e) => setNameInput(e.target.value)} maxLength={60} />
        </FieldRow>
      </FieldGroup>

      <FormError>{serverError}</FormError>
      <SheetButton type="submit" pending={save.isPending} disabled={!canSave}>
        {t(profile ? "profile.save" : "profile.create")}
      </SheetButton>
    </form>
  );
}
