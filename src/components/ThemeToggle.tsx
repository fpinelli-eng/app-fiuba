"use client";

import { THEME_KEY } from "@/lib/theme";

// Alterna entre claro y oscuro. El ícono se elige con CSS según data-theme,
// así no depende del estado de React y no hay diferencias entre servidor y navegador.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const dark = root.getAttribute("data-theme") !== "dark";
    root.setAttribute("data-theme", dark ? "dark" : "light");
    try {
      localStorage.setItem(THEME_KEY, dark ? "oscuro" : "claro");
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar entre modo claro y oscuro"
      className="grid size-10 cursor-pointer place-items-center rounded-full border border-line bg-surface text-muted hover:text-ink"
    >
      <svg className="in-data-[theme=dark]:hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      <svg className="hidden in-data-[theme=dark]:block" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    </button>
  );
}
