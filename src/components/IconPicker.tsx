"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles, X } from "lucide-react";
import { useLang } from "@/hooks/useLang";
import { brandLogo, brandSearchUrl } from "@/lib/bankProviders";
import { useTranslations } from "@/lib/i18n/utils";
import { initialsAvatarDataUri } from "@/lib/initialsAvatar";

type Brand = { name: string; domain: string; icon: string };

/**
 * Logo field for sheets: search brands by name, or use a letter avatar built from `name`.
 * The chosen logo is previewed by the form's hero tile.
 */
export default function IconPicker({ value, onChange, name }: { value: string; onChange: (iconUrl: string) => void; name?: string }) {
  const lang = useLang();
  const t = useTranslations(lang);
  const es = lang === "es";
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  // Debounce typing before hitting the search API.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 500);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: brands = [], isFetching } = useQuery({
    queryKey: ["brand-search", query],
    queryFn: async () => ((await (await fetch(brandSearchUrl(query))).json()) as Brand[]) ?? [],
    enabled: !!query,
    staleTime: Infinity,
  });
  const searching = !!term && (term.trim() !== query || isFetching);
  const avatarSource = (name || term).trim();

  return (
    <div className="sf-stack">
      <div className="sf-stack-head">
        <span className="sf-row-label">Logo</span>
        <div className="sf-inline-actions">
          <button
            type="button"
            className="sf-link-btn"
            onClick={() => onChange(initialsAvatarDataUri(avatarSource || "?"))}
            disabled={!avatarSource}
          >
            <Sparkles aria-hidden />
            {es ? "Iniciales" : "Initials"}
          </button>
          {value && (
            <button type="button" className="sf-link-btn sf-link-btn--muted" onClick={() => onChange("")}>
              <X aria-hidden />
              {es ? "Quitar" : "Remove"}
            </button>
          )}
        </div>
      </div>
      <div className="sf-logo-search">
        <Search aria-hidden />
        <input
          type="search"
          placeholder={t("sub.searchPlaceholder")}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label={t("sub.searchPlaceholder")}
          enterKeyHint="search"
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
        />
      </div>
      {term && (
        <div className="sf-logo-results">
          {brands.length > 0 && !searching ? (
            brands.map((brand, idx) => {
              const url = brandLogo(brand.domain);
              return (
                <button
                  key={`${brand.domain}-${idx}`}
                  type="button"
                  className="sf-logo-option"
                  onClick={() => onChange(url)}
                  aria-pressed={value === url}
                  title={brand.name}
                  aria-label={brand.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote logos */}
                  <img src={brand.icon} alt="" />
                </button>
              );
            })
          ) : (
            <span className="sf-logo-empty">{t(searching ? "sub.searching" : "sub.noIconsFound")}</span>
          )}
        </div>
      )}
    </div>
  );
}
