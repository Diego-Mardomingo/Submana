"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLang } from "@/hooks/useLang";
import { brandLogo, brandSearchUrl } from "@/lib/bankProviders";
import { useTranslations } from "@/lib/i18n/utils";

type Brand = { name: string; domain: string; icon: string };

/** Logo picker: searches brands by name, or generates a letter avatar. */
export default function IconPicker({ value, onChange }: { value: string; onChange: (iconUrl: string) => void }) {
  const t = useTranslations(useLang());
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");

  // Debounce typing before hitting the search API.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(term.trim()), 600);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: brands = [], isFetching } = useQuery({
    queryKey: ["brand-search", query],
    queryFn: async () => ((await (await fetch(brandSearchUrl(query))).json()) as Brand[]) ?? [],
    enabled: !!query,
    staleTime: Infinity,
  });
  const searching = !!term && (term.trim() !== query || isFetching);

  const randomAvatar = () => {
    const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
    onChange(`https://ui-avatars.com/api/?name=${encodeURIComponent(term || letter() + letter())}&length=2&background=random&color=fff&size=256`);
  };

  return (
    <section className="icon-picker">
      <div className="icon-picker-grid">
        <div className="icon-picker-preview-wrapper">
          <label className="icon-picker-label">{t("sub.selected")}</label>
          <div className="icon-picker-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- remote logos */}
            {value ? <img src={value} alt="Icon preview" /> : <div className="icon-picker-placeholder">?</div>}
          </div>
        </div>
        <div className="icon-picker-search-area">
          <div className="icon-picker-input-wrapper">
            <svg className="icon-picker-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input type="text" className="icon-picker-input" placeholder={t("sub.searchPlaceholder")} value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="icon-picker-results">
        {term && brands.length > 0 && !searching ? (
          <div className="icon-picker-icons-list">
            {brands.map((brand, idx) => (
              <button key={`${brand.domain}-${idx}`} type="button" className="icon-picker-option" onClick={() => onChange(brandLogo(brand.domain))} title={brand.name}>
                {/* eslint-disable-next-line @next/next/no-img-element -- remote logos */}
                <img src={brand.icon} alt={brand.name} />
              </button>
            ))}
          </div>
        ) : (
          <div className="icon-picker-empty">{term ? t(searching ? "sub.searching" : "sub.noIconsFound") : t("sub.startTyping")}</div>
        )}
      </div>

      <div className="icon-picker-actions">
        <button type="button" className="icon-picker-random-btn" onClick={randomAvatar}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
            <polyline points="7.5 19.79 7.5 14.6 3 12" />
            <polyline points="21 12 16.5 14.6 16.5 19.79" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          {t("sub.randomAvatar")}
        </button>
      </div>
    </section>
  );
}
