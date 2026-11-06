import { arcPath, arcPoint, arcSegments, careerYear, categoryAt, type ArcCategory, type ArcStation } from "@/lib/home/arc";

// Arco de avance del Inicio: se llena con los créditos aprobados, apilados por categoría, con una
// parada por año del plan. En la computadora y en el celular cambian el grosor, el tamaño de las
// letras y dónde va el número; la geometría es la misma (src/lib/home/arc.ts).
// El dibujo es decorativo para los lectores de pantalla: el porcentaje, los créditos, el año y la
// leyenda están escritos debajo.

const STROKE: Record<ArcCategory, string> = {
  cbc: "stroke-cat-cbc",
  required: "stroke-cat-required",
  elective: "stroke-cat-elective",
  final: "stroke-cat-final",
};
const DOT: Record<ArcCategory, string> = {
  cbc: "bg-cat-cbc",
  required: "bg-cat-required",
  elective: "bg-cat-elective",
  final: "bg-cat-final",
};

export interface ArcCategoryTotals {
  category: ArcCategory;
  name: string;
  done: number;
  total: number | null;
}

const VARIANTS = {
  desktop: { viewBox: "-50 -30 740 350", stroke: 24, node: 6, nodeStroke: 3, head: 17, headStroke: 6, font: 18, labelR: 36, endBelow: 0, dy: 6 },
  phone: { viewBox: "-40 -70 720 450", stroke: 34, node: 9, nodeStroke: 4, head: 24, headStroke: 8, font: 34, labelR: 58, endBelow: 52, dy: 11 },
} as const;

export function ProgressArc({
  credits,
  total,
  categories,
  stations,
}: {
  credits: number;
  total: number;
  categories: ArcCategoryTotals[];
  stations: ArcStation[];
}) {
  const pct = total ? Math.min(100, Math.round((credits / total) * 100)) : 0;
  const done = Object.fromEntries(categories.map((c) => [c.category, c.done])) as Record<ArcCategory, number>;
  const segments = arcSegments(done, total);
  const year = careerYear(credits, stations);

  const summary = (
    <>
      <div className="font-display leading-none font-medium tracking-[-0.03em] text-[42px] md:text-[72px]">
        {pct}
        <span className="text-[21px] md:text-[34px]">%</span>
      </div>
      <div className="mt-0.5 text-[13px] text-muted md:mt-1 md:text-base">
        {credits} de {total} créditos
      </div>
      <div className="mt-1.5 inline-block rounded-full bg-lavender px-3 py-[3px] text-[13px] font-semibold text-lavender-ink md:mt-2 md:px-3.5 md:py-1 md:text-[15px]">
        {year.label}
      </div>
    </>
  );

  return (
    <>
      <div className="relative mt-1 md:mx-auto md:mt-1.5 md:max-w-[560px]">
        <ArcDrawing variant="phone" className="md:hidden" {...{ credits, total, segments, stations, next: year.next }} />
        <ArcDrawing variant="desktop" className="hidden md:block" {...{ credits, total, segments, stations, next: year.next }} />
        <div className="absolute inset-x-0 top-[41%] text-center md:top-auto md:bottom-[6%]">{summary}</div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-muted md:mt-2.5 md:flex md:flex-wrap md:justify-center md:gap-x-5 md:gap-y-1.5 md:text-sm">
        {categories.map((c) => (
          <li key={c.category} className="flex items-center gap-1.5 tabular-nums">
            <span
              aria-hidden="true"
              className={`size-[9px] flex-none rounded-full md:size-2.5 ${c.done > 0 ? DOT[c.category] : "border-2 border-line-strong"}`}
            />
            {c.name} {c.done}
            {c.total !== null && `/${c.total}`}
          </li>
        ))}
      </ul>
    </>
  );
}

function ArcDrawing({
  variant,
  className,
  credits,
  total,
  segments,
  stations,
  next,
}: {
  variant: keyof typeof VARIANTS;
  className: string;
  credits: number;
  total: number;
  segments: ReturnType<typeof arcSegments>;
  stations: ArcStation[];
  next: number | null;
}) {
  const v = VARIANTS[variant];
  const [hx, hy] = arcPoint(total ? Math.min(1, credits / total) : 0);
  return (
    <svg viewBox={v.viewBox} aria-hidden="true" focusable="false" className={`block h-auto w-full font-sans ${className}`}>
      <path d={arcPath(0, 1)} fill="none" className="stroke-arc-track" strokeWidth={v.stroke} strokeLinecap="round" />
      {segments.map((s) => (
        <path key={s.category} d={s.d} fill="none" className={STROKE[s.category]} strokeWidth={v.stroke} strokeLinecap={s.round ? "round" : "butt"} />
      ))}
      {stations.map((st, i) => {
        const t = total ? st.credits / total : 0;
        const [x, y] = arcPoint(t);
        const reached = credits >= st.credits;
        const color = reached ? categoryAt(segments, t) : null;
        // En el celular las paradas de los extremos llevan el nombre debajo; las demás, por fuera del arco.
        const end = v.endBelow > 0 && (t <= 0.001 || t >= 0.999);
        const [lx, ly] = end ? [x, y + v.endBelow] : arcPoint(t, 260 + v.labelR);
        const anchor = end ? "middle" : t < 0.3 ? "end" : t > 0.7 ? "start" : "middle";
        const current = i === next;
        return (
          <g key={st.label}>
            <circle cx={x} cy={y} r={v.node} strokeWidth={v.nodeStroke} className={`fill-surface ${color ? STROKE[color] : "stroke-line-strong"}`} />
            <text
              x={lx}
              y={ly + v.dy}
              textAnchor={anchor}
              fontSize={v.font}
              fontWeight={current ? 700 : 500}
              className={current ? "fill-ink" : reached ? "fill-ink-2" : "fill-muted"}
            >
              {variant === "phone" ? st.short : st.label}
            </text>
          </g>
        );
      })}
      <circle cx={hx} cy={hy} r={v.head} strokeWidth={v.headStroke} className="fill-surface stroke-ink" />
    </svg>
  );
}
