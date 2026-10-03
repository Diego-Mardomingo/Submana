import type { UIKey } from "@/lib/i18n/ui";

/** Translated message for an API error code (`shared.error.<code>`), falling back to a generic one. */
export function sharedErrorText(t: (key: UIKey) => string, code: string | undefined) {
  const key = `shared.error.${code}` as UIKey;
  const text = t(key);
  return code && text !== key ? text : t("shared.error.generic");
}
