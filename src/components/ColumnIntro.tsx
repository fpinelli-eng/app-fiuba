// Presentación (docs/DISENO.md, Presentación): la fachada de Paseo Colón de noche; la cámara se acerca a la
// columna central y el último cuadro es el ícono de FIUBI (src/app/icon.svg: la misma columna, crema sobre
// azul noche, con las mismas proporciones). Animación y colores en globals.css (`intro-*`, `--column-*`,
// `--facade-*`); con "reducir movimiento" se ve directo el ícono. Es decorativa: el lector de pantalla la saltea.

/** La columna del ícono (viewBox 0 0 100 100), sin el escalón de abajo. */
function ColumnShape() {
  return (
    <>
      <path d="M38 36 L43.2 36 L41.7 76 L35 76 Z" />
      <path d="M44.8 36 L49.2 36 L49.2 76 L43.3 76 Z" />
      <path d="M50.8 36 L55.2 36 L56.7 76 L50.8 76 Z" />
      <path d="M56.8 36 L62 36 L65 76 L58.3 76 Z" />
      <path d="M38 36.6 C38 33.075 32 32.425 32 29.5 H68 C68 32.425 62 33.075 62 36.6 Z" />
      <rect x="29.5" y="22.5" width="41" height="7.6" rx="1.4" />
      <rect x="29" y="76.5" width="42" height="5" rx="1.4" />
    </>
  );
}

// Columnas de la fachada, a 105 de distancia, con el capitel arriba en y = 190 (escala 2,2 del ícono).
const SIDE_COLUMNS = [90, 195, 405, 510];
const columnAt = (cx: number) => `translate(${cx - 110} 140.5) scale(2.2)`;

const STARS = [
  [120, 40, 1.6],
  [170, 70, 1.2],
  [235, 28, 1.3],
  [300, 52, 1],
  [362, 24, 1.4],
  [420, 64, 1.1],
  [470, 36, 1.5],
];

export function ColumnIntro({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`overflow-hidden bg-[var(--column-bg)] ${className}`}>
      <svg viewBox="100 0 400 400" className="block h-full w-full">
        <g className="intro-stars" fill="var(--column-fg)">
          {STARS.map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} />
          ))}
        </g>
        <g className="intro-cam">
          <g className="intro-fade">
            <rect x="40" y="188" width="520" height="132" fill="var(--facade-wall)" />
            <g fill="var(--facade-door)">
              {[139, 244, 344, 449].map((x) => (
                <rect key={x} x={x} y="246" width="12" height="72" rx="2" />
              ))}
            </g>
            <rect x="48" y="132" width="504" height="20" rx="2" fill="var(--facade-attic)" />
            <rect x="24" y="150" width="552" height="11" rx="2" fill="var(--column-fg)" />
            <rect x="36" y="161" width="528" height="29" fill="var(--column-fg)" />
            <rect x="36" y="174" width="528" height="2" fill="var(--facade-shade)" />
            <rect x="44" y="319" width="512" height="11" rx="2" fill="var(--column-fg)" />
            <rect x="28" y="330" width="544" height="12" rx="2" fill="var(--facade-step)" />
            <rect x="12" y="342" width="576" height="13" rx="2" fill="var(--facade-shade)" />
            {SIDE_COLUMNS.map((cx) => (
              <g key={cx} transform={columnAt(cx)} fill="var(--column-fg)">
                <ColumnShape />
              </g>
            ))}
          </g>
          <g transform={columnAt(300)} fill="var(--column-fg)">
            <ColumnShape />
            <rect x="25" y="82.9" width="50" height="5" rx="1.4" />
          </g>
        </g>
      </svg>
    </div>
  );
}
