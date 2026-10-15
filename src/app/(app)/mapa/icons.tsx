import type { DisplayState } from "@/lib/map/model";

// Íconos de estado del mapa (los mismos del prototipo 06-mapa).
export function StateIcon({ state, size = 12 }: { state: DisplayState; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "shrink-0",
  };
  switch (state) {
    case "approved":
      return (
        <svg {...common} strokeWidth={2.8}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "final_pending":
      return (
        <svg {...common} strokeWidth={2.4}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "in_progress":
      return (
        <svg {...common} strokeWidth={2.4}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
        </svg>
      );
    case "enabled":
      return (
        <svg {...common} strokeWidth={2.4}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "blocked":
      return (
        <svg {...common} strokeWidth={2.2}>
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
  }
}

export function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/** Colores de cada estado: fondo, borde y texto (tokens de globals.css). */
export const STATE_STYLE: Record<DisplayState, string> = {
  approved: "bg-mint border border-mint-line text-mint-ink",
  final_pending: "bg-butter border border-butter-line text-butter-ink",
  in_progress: "bg-sky border border-sky-line text-sky-ink",
  enabled: "bg-surface border-[1.5px] border-enabled-line text-ink",
  blocked: "bg-blocked border border-dashed border-blocked-line text-blocked-ink",
};

/** Texto del estado para lectores de pantalla: "Aprobada con 8", "Bloqueada"… */
export function STATE_ICON_LABEL(state: DisplayState, grade: number | null): string {
  const labels: Record<DisplayState, string> = {
    approved: "Aprobada",
    final_pending: "Final pendiente",
    in_progress: "Cursando",
    enabled: "Habilitada",
    blocked: "Bloqueada",
  };
  return state === "approved" && grade !== null ? `Aprobada con ${grade}` : labels[state];
}
