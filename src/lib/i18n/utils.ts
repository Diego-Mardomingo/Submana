import { ui, defaultLang } from "./ui";
import type { Lang, UIKey } from "./ui";

export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return (ui[lang]?.[key] as string) ?? (ui[defaultLang][key] as string) ?? key;
  };
}
