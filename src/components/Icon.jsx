import React, { useState, useEffect } from "react";
import "../styles/Icon.css";

export default function Icon({ defaultIcon, onIconSelected, translations }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [icons, setIcons] = useState([]);
  const [selectedIcon, setSelectedIcon] = useState(defaultIcon);
  const [isSearching, setIsSearching] = useState(false);

  // Default fallback internal translations if translations object is not provided
  const _t = (key) => {
    return translations?.[key] || key;
  };

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
          // Brandfetch public key (keeping existing one)
          const response = await fetch(`https://api.brandfetch.io/v2/search/${searchTerm}?c=1id-tf6xJEAcHu0Tio1`);
          const data = await response.json();
          setIcons(data || []);
        } catch (error) {
          console.error("Error fetching icons:", error);
        } finally {
          setIsSearching(false);
        }
      };
      fetchIcons();
    }, 800);

    return () => clearTimeout(delay);
  }, [searchTerm]);

  const handleIconClick = (iconItem) => {
    let iconFormatted = `https://cdn.brandfetch.io/${iconItem.domain}/w/400/h/400?c=1id-tf6xJEAcHu0Tio1`;
    setSelectedIcon(iconFormatted);
    if (onIconSelected) onIconSelected(iconFormatted);

    const hiddenField = document.getElementById("icon_value");
    if (hiddenField) hiddenField.value = iconFormatted;
  };

  const handleRandomChange = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const name = searchTerm || (letters[Math.floor(Math.random() * 26)] + letters[Math.floor(Math.random() * 26)]);
    const randomUrl = `https://ui-avatars.com/api/?name=${name}&length=2&background=random&color=fff&size=256`;

    setSelectedIcon(randomUrl);
    const hiddenField = document.getElementById("icon_value");
    if (hiddenField) hiddenField.value = randomUrl;
  };

  return (
    <section className="icon-component">
      <div className="icon-grid">
        {/* Preview Area */}
        <div className="icon-preview-wrapper">
          <label className="sub-label">{_t('sub.selected')}</label>
          <div className="icon-preview">
            {selectedIcon ? (
              <img src={selectedIcon} alt="Icon preview" />
            ) : (
              <div className="icon-placeholder">?</div>
            )}
          </div>
        </div>

        {/* Interaction Area */}
        <div className="search-area">
          <label className="sub-label">{_t('sub.brandIcon')}</label>
          <div className="search-input-wrapper">
            <input
              className="search-input"
              placeholder={_t('sub.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="results-container">
        {icons.length > 0 ? (
          <div className="icons-list">
            {icons.map((iconItem, idx) => (
              <img
                key={idx}
                src={iconItem.icon}
                alt={iconItem.name}
                className="icon-option"
                onClick={() => handleIconClick(iconItem)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            {searchTerm ? (isSearching ? _t('sub.searching') : _t('sub.noIconsFound')) : _t('sub.startTyping')}
          </div>
        )}
      </div>

      <div className="icon-actions">
        <button type="button" className="btn-random" onClick={handleRandomChange}>
          {_t('sub.randomAvatar')}
        </button>
      </div>
    </section>
  );
}
