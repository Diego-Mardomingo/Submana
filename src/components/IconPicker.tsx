"use client";

import { useState, useEffect, useCallback } from "react";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

interface BrandfetchResult {
  name: string;
  domain: string;
  icon: string;
}

interface IconPickerProps {
  defaultIcon?: string;
  onIconSelect: (iconUrl: string) => void;
}

export default function IconPicker({ defaultIcon, onIconSelect }: IconPickerProps) {
  const lang = useLang();
  const t = useTranslations(lang);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [icons, setIcons] = useState<BrandfetchResult[]>([]);
  const [selectedIcon, setSelectedIcon] = useState(defaultIcon || "");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (defaultIcon) {
      setSelectedIcon(defaultIcon);
    }
  }, [defaultIcon]);

  useEffect(() => {
    if (!searchTerm) {
      setIcons([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const delay = setTimeout(() => {
      const fetchIcons = async () => {
        try {
          const response = await fetch(
            `https://api.brandfetch.io/v2/search/${encodeURIComponent(searchTerm)}?c=1id-tf6xJEAcHu0Tio1`
          );
          const data = await response.json();
          setIcons(data || []);
        } catch (error) {
          console.error("Error fetching icons:", error);
          setIcons([]);
        } finally {
          setIsSearching(false);
        }
      };
      fetchIcons();
    }, 600);

    return () => clearTimeout(delay);
  }, [searchTerm]);

  const handleIconClick = useCallback((iconItem: BrandfetchResult) => {
    const iconUrl = `https://cdn.brandfetch.io/${iconItem.domain}/w/400/h/400?c=1id-tf6xJEAcHu0Tio1`;
    setSelectedIcon(iconUrl);
    onIconSelect(iconUrl);
  }, [onIconSelect]);

  const handleRandomAvatar = useCallback(() => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const name = searchTerm || 
      letters[Math.floor(Math.random() * 26)] + 
      letters[Math.floor(Math.random() * 26)];
    const randomUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&length=2&background=random&color=fff&size=256`;
    
    setSelectedIcon(randomUrl);
    onIconSelect(randomUrl);
  }, [searchTerm, onIconSelect]);

  return (
    <section className="icon-picker">
      <div className="icon-picker-grid">
        <div className="icon-picker-preview-wrapper">
          <label className="icon-picker-label">{t("sub.selected")}</label>
          <div className="icon-picker-preview">
            {selectedIcon ? (
              <img src={selectedIcon} alt="Icon preview" />
            ) : (
              <div className="icon-picker-placeholder">?</div>
            )}
          </div>
        </div>

        <div className="icon-picker-search-area">
          <div className="icon-picker-input-wrapper">
            <svg 
              className="icon-picker-search-icon" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              className="icon-picker-input"
              placeholder={t("sub.searchPlaceholder")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="icon-picker-results">
        {icons.length > 0 ? (
          <div className="icon-picker-icons-list">
            {icons.map((iconItem, idx) => (
              <button
                key={`${iconItem.domain}-${idx}`}
                type="button"
                className="icon-picker-option"
                onClick={() => handleIconClick(iconItem)}
                title={iconItem.name}
              >
                <img src={iconItem.icon} alt={iconItem.name} />
              </button>
            ))}
          </div>
        ) : (
          <div className="icon-picker-empty">
            {searchTerm 
              ? (isSearching ? t("sub.searching") : t("sub.noIconsFound")) 
              : t("sub.startTyping")
            }
          </div>
        )}
      </div>

      <div className="icon-picker-actions">
        <button 
          type="button" 
          className="icon-picker-random-btn" 
          onClick={handleRandomAvatar}
        >
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
