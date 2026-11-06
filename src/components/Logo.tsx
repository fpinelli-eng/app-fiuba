import { APP_NAME } from "@/lib/app";

// Logo FIUBI: el nombre en Unbounded, con la U dibujada como el arco de avance del Inicio y la B
// dibujada con el palo recto
// (tramo izquierdo amarillo, curva azul, tramo derecho coral). Las letras se ubican a mano con las
// medidas de Unbounded 600, así la U queda en su lugar; el alto lo pone `className` (h-…) y el ancho sale solo.
// Colores: `ink` para las letras; la U, `brand-u1..3` (intensos, para el tamaño del menú) o, con
// `tone="soft"`, los del arco (`cat-*`), que acompañan a los pasteles del ingreso.

const U_COLORS = {
  strong: ["stroke-brand-u1", "stroke-brand-u2", "stroke-brand-u3"],
  soft: ["stroke-cat-cbc", "stroke-cat-required", "stroke-cat-elective"],
} as const;

export function Logo({ className = "", tone = "strong" }: { className?: string; tone?: keyof typeof U_COLORS }) {
  const [u1, u2, u3] = U_COLORS[tone];
  return (
    <svg viewBox="0 -80 320 82" role="img" aria-label={APP_NAME} className={`block w-auto overflow-visible ${className}`}>
      <text y="0" fontSize="100" fontWeight="600" className="fill-ink" style={{ fontFamily: "var(--font-display)" }}>
        <tspan x="0">F</tspan>
        <tspan x="76.3">I</tspan>
        <tspan x="284.6">I</tspan>
      </text>
      {/* La B también va dibujada: la de Unbounded tiene el palo cortado en diagonal, y acá va recto. */}
      <path
        transform="translate(197.2 0)"
        fillRule="evenodd"
        className="fill-ink"
        d="M7.5 -75 H59.5 C71.5 -75 78.5 -68.5 78.5 -59 C78.5 -51.5 74.5 -46.5 68.5 -44 C77.5 -42 84.2 -35.5 84.2 -23.5 C84.2 -9 74.5 0 60.5 0 H7.5 Z M26 -64.4 H53.5 A5.8 5.8 0 0 1 59.3 -58.6 V-50.4 A5.8 5.8 0 0 1 53.5 -44.6 H26 Z M26 -33.1 H58.8 A6 6 0 0 1 64.8 -27.1 V-18.9 A6 6 0 0 1 58.8 -12.9 H26 Z"
      />
      <g fill="none" strokeWidth="18.5">
        <path d="M125.55 -75 V-39.7" className={u1} />
        <path d="M125.55 -37.1 A27.875 27.875 0 0 0 181.3 -37.1" className={u2} />
        <path d="M181.3 -39.7 V-75" className={u3} />
      </g>
    </svg>
  );
}
