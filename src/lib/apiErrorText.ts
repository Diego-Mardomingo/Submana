import type { UIKey } from "@/lib/i18n/ui";

/** Prefixes of the translated API error codes (`<prefix>.error.<code>`), in lookup order. */
const SCOPES = ["shared", "friends", "joint", "profile"] as const;

/**
 * Translated message for a failed API call. The server sends a code in `error.message`
 * (`handle_taken`, `member_has_balance`…): the first scope that knows it wins; a failed
 * fetch means there is no connection; anything else gets a generic message.
 */
export function apiErrorText(t: (key: UIKey) => string, error: unknown) {
  if (error instanceof TypeError) return t("error.network");
  const code = error instanceof Error ? error.message : undefined;
  if (code) {
    for (const scope of SCOPES) {
      const key = `${scope}.error.${code}` as UIKey;
      const text = t(key);
      if (text !== key) return text;
    }
  }
  return t("error.generic");
}
