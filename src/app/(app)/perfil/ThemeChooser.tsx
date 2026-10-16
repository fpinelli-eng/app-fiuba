"use client";

import { useEffect, useState } from "react";
import { THEME_KEY } from "@/lib/theme";

type Theme = "claro" | "oscuro" | "sistema";
const OPTIONS: [Theme, string][] = [
  ["claro", "Claro"],
  ["oscuro", "Oscuro"],
  ["sistema", "Según el sistema"],
];

function apply(theme: Theme) {
  const dark = theme === "oscuro" || (theme === "sistema" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

// Apariencia: mismo valor que el botón de la barra superior ("tema" en localStorage).
export function ThemeChooser() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let saved: Theme = "claro";
    try {
      saved = (localStorage.getItem(THEME_KEY) as Theme | null) ?? "claro";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage solo existe en el navegador
    setTheme(saved);
  }, []);

  // "Según el sistema" sigue los cambios del sistema mientras la página está abierta.
  useEffect(() => {
    if (theme !== "sistema") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("sistema");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  function pick(t: Theme) {
    setTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {}
    apply(t);
  }

  return (
    <div role="radiogroup" aria-label="Tema" className="flex gap-0.5 rounded-[10px] bg-bg p-[3px]">
      {OPTIONS.map(([value, label]) => {
        const on = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => pick(value)}
            className={`h-[34px] rounded-lg px-4 text-sm ${on ? "bg-surface font-semibold text-ink shadow-[0_1px_2px_var(--pop-shadow)]" : "text-muted"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
