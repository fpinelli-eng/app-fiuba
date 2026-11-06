import { APP_NAME } from "@/lib/app";

// Logo FIUBI: el nombre en Unbounded, con la U dibujada como el arco de avance del Inicio
// (tramo izquierdo amarillo, curva azul, tramo derecho coral). Las letras se ubican a mano con las
// medidas de Unbounded 600, así la U queda en su lugar; el alto lo pone `className` (h-…) y el ancho sale solo.
// Colores: `ink` para las letras y `brand-u1..3` para la U (globals.css, claro y oscuro).

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 -80 320 82" role="img" aria-label={APP_NAME} className={`block w-auto overflow-visible ${className}`}>
      <text y="0" fontSize="100" fontWeight="600" className="fill-ink" style={{ fontFamily: "var(--font-display)" }}>
        <tspan x="0">F</tspan>
        <tspan x="76.3">I</tspan>
        <tspan x="197.2">B</tspan>
        <tspan x="284.6">I</tspan>
      </text>
      <g fill="none" strokeWidth="18.5">
        <path d="M125.55 -75 V-39.7" className="stroke-brand-u1" />
        <path d="M125.55 -37.1 A27.875 27.875 0 0 0 181.3 -37.1" className="stroke-brand-u2" />
        <path d="M181.3 -39.7 V-75" className="stroke-brand-u3" />
      </g>
    </svg>
  );
}
