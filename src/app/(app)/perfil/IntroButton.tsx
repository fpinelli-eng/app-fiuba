"use client";

import { OPEN_INTRO_EVENT } from "@/components/WelcomeStories";

// Vuelve a abrir las historias de bienvenida (están montadas en el layout de la app).
export function IntroButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_INTRO_EVENT))}
      className="h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold"
    >
      Ver la bienvenida
    </button>
  );
}
