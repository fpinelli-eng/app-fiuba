import type { NavIcon as NavIconName } from "@/lib/app";

// Íconos del menú (barra de abajo y barra superior en el celular). Mismo estilo que los del mapa:
// trazo redondeado de 24 × 24 con el color del texto (currentColor).
export function NavIcon({ name, size = 22 }: { name: NavIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "shrink-0",
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M4 10.5L12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
          <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
        </svg>
      );
    case "map":
      return (
        <svg {...common}>
          <rect x="3.5" y="4" width="7" height="6" rx="1.5" />
          <rect x="13.5" y="4" width="7" height="6" rx="1.5" />
          <rect x="3.5" y="14" width="7" height="6" rx="1.5" />
          <rect x="13.5" y="14" width="7" height="6" rx="1.5" strokeDasharray="2.5 2" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...common}>
          <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
          <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3M8 17h6" />
        </svg>
      );
    case "star":
      return (
        <svg {...common} strokeWidth={1.9}>
          <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
        </svg>
      );
    case "exam":
      return (
        <svg {...common}>
          <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" />
          <path d="M14 3.5V8h4M9 13l2 2 4-4" />
        </svg>
      );
  }
}
