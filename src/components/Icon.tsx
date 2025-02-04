import React, { useState, useEffect } from "react";
import "../styles/Icon.css";

type IconProps = {
  // Función callback para comunicar al padre qué icono se seleccionó
  onIconSelected?: (iconUrl: string) => void;
};

export default function Icon({ onIconSelected }: IconProps) {
  // Estado para la cadena de búsqueda
  const [searchTerm, setSearchTerm] = useState("");
  // Estado para los resultados de la API (lista de iconos)
  const [icons, setIcons] = useState<any[]>([]);
  // Estado para el icono seleccionado
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  /**
   * useEffect para hacer "debounce" de 1 segundo.
   * Cuando searchTerm cambie, esperamos 1 segundo antes de llamar a la API.
   * Si se teclea de nuevo antes de que pase el segundo, se limpia el timeout previo.
   */
  useEffect(() => {
    // Si no hay término de búsqueda, limpiamos la lista de iconos
    if (!searchTerm) {
      setIcons([]);
      return;
    }

    const delay = setTimeout(() => {
      // Llamada a la API después de 1 segundo sin cambios
      const fetchIcons = async () => {
        try {
          const response = await fetch("../pages/api/logo/getLogos.ts?searchTerm=" + searchTerm);
          console.log('RESPONSE :', response);
          const data = await response.json();
          console.log('DATA :', data);
          setIcons(data || []);
        } catch (error) {
          console.error("Error fetching icons:", error);
        }
      };
      fetchIcons();
    }, 1000);

    // Limpieza del timeout si el usuario vuelve a escribir antes de 1 segundo
    return () => clearTimeout(delay);
  }, [searchTerm]);

  /**
   * Manejador de cambios en el input de búsqueda
   */
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  /**
   * Manejador de clic en un icono
   * - Guarda el icono seleccionado en el estado
   * - Notifica al padre si se pasó la prop onIconSelected
   */
  const handleIconClick = (iconUrl: string) => {
    setSelectedIcon(iconUrl);
    if (onIconSelected) {
      onIconSelected(iconUrl);
    }
    const hiddenField = document.getElementById("icon_value") as HTMLInputElement;
    if (hiddenField) {
      hiddenField.value = iconUrl;
    }
  };

  function getRandomLetter() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return (letters[Math.floor(Math.random() * letters.length)])+(letters[Math.floor(Math.random() * letters.length)]);
  }

  /**
   * Manejador del checkbox "Random Icon"
   */
  const handleRandomChange = () => {
    let letter: string = searchTerm ? searchTerm : getRandomLetter();
    setSelectedIcon("https://ui-avatars.com/api/?name="+letter+"&length=2&background=random");
    const hiddenField = document.getElementById("icon_value") as HTMLInputElement;
    if (hiddenField) {
      hiddenField.value = "https://ui-avatars.com/api/?name="+letter+"&length=2&background=random";
    }
  };

  return (
    <section>
      {/* Etiqueta del icon/logo */}
      <label htmlFor="icon_container">Icon/Logo</label>

      <div className="icon_container" id="icon_container">
        <aside className="icon_displayer">
          <span>Selected:</span>
          <div className="icon_selected">
            {selectedIcon && (
              <img
                src={selectedIcon}
                alt="Selected icon"
              />
            )}
          </div>
        </aside>

        {/* Buscador */}
        <div className="buscador">
          <input
            className="search_input"
            placeholder="Search.."
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <div className="icon_selector">
            {icons.length > 0 ? (
              icons.map((iconItem, idx) => (
                <img
                  key={idx}
                  src={iconItem.logo_url}
                  alt={iconItem.name || "Icon"}
                  className="iconToBeSelected"
                  onClick={() => handleIconClick(iconItem.logo_url)}
                />
              ))
            ) : (
              // Aquí podrías mostrar un mensaje cuando no hay resultados
              <p>
                {searchTerm ? "Loading or no results..." : "Type something to search"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer con enlace y checkbox */}
      <footer>
        <a
          className="enlace_logo"
          href="https://logo.dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          Logos provided by Logo.dev
        </a>
        <label className="checkbox-container">
          {/* Random Icon
          <input type="checkbox" checked={randomIcon} onChange={handleRandomChange} />
          <span className="checkmark"></span> */}
          <div className='random_btn' onClick={handleRandomChange}>Random Icon</div>
        </label>
      </footer>
    </section>
  );
}
