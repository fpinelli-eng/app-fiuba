import type { CSSProperties } from "react";
import { Logo } from "@/components/Logo";
import { formatHour, formatHours } from "@/lib/plan/format";
import {
  blockBox,
  blockDetail,
  placeInDay,
  placeLabel,
  posterDays,
  posterHours,
  posterItems,
  posterTotals,
  timesLabel,
  type PosterData,
  type PosterItem,
} from "@/lib/plan/poster";

// Lámina del plan del cuatrimestre para pegar en la pared (Plan → "Descargar PDF"). Una hoja A4
// apaisada medida en milímetros, así sale igual en pantalla y en papel. Componente puro: lo usan
// /plan/imprimir y la vista previa pública. Siempre en tema claro (es papel), aunque la app esté en
// oscuro. En gris se sigue leyendo: los nombres van en la tinta de cada color, cada materia lleva
// arriba una franja oscura y las actividades van rayadas.

/** Alto de la grilla (sin la fila de los días), en mm: de acá sale cuánto texto entra en cada bloque. */
const GRID_MM = 143;

/** Color de una materia o actividad para las clases de abajo: el pastel en --c y su tinta en --ci. */
const tone = (color: string) => ({ "--c": `var(--${color})`, "--ci": `var(--${color}-ink)` }) as CSSProperties;

export function PlanPoster({ poster, date }: { poster: PosterData; date: string }) {
  const items = posterItems(poster);
  const days = posterDays(items);
  const hours = posterHours(items);
  const totals = posterTotals(poster);
  const hourMm = GRID_MM / (hours.last - hours.first);
  const hourMarks = Array.from({ length: hours.last - hours.first + 1 }, (_, i) => hours.first + i);
  const empty = items.length === 0;

  return (
    <article
      data-theme="light"
      aria-label={`Mi cuatrimestre ${poster.term}`}
      className="pp-sheet relative flex h-[210mm] w-[297mm] flex-none flex-col overflow-hidden bg-surface px-[12mm] pt-[10mm] pb-[8mm] text-ink [color-scheme:light]"
    >
      <header className="flex items-end justify-between gap-[8mm]">
        <div className="min-w-0">
          <h1 className="text-[25pt] leading-none font-semibold tracking-[-0.025em]">
            Mi cuatrimestre <span className="text-accent">{poster.term}</span>
          </h1>
          <p className="mt-[2.6mm] text-[10.5pt] leading-none text-ink-2">
            {poster.career}
            {poster.option && <> · Opción {poster.option}</>}
          </p>
        </div>
        <p className="pb-[0.4mm] text-right text-[8pt] leading-tight whitespace-nowrap text-muted">Al {date}</p>
      </header>

      {/* La U del logo, estirada: los tres tramos (amarillo, azul, coral) como filete bajo el título. */}
      <div aria-hidden="true" className="mt-[4.2mm] flex h-[0.9mm] gap-[0.9mm]">
        <span className="flex-[1] rounded-full bg-brand-u1" />
        <span className="flex-[3] rounded-full bg-brand-u2" />
        <span className="flex-[1] rounded-full bg-brand-u3" />
      </div>

      <div className="mt-[5mm] flex min-h-0 flex-auto gap-[7mm]">
        {/* Semana */}
        <section aria-label="Semana" className="flex min-w-0 flex-auto flex-col">
          <div className="flex gap-[1.6mm] pl-[8mm]">
            {days.map((d) => (
              <div key={d} className="flex-1 pb-[2mm] font-display text-[8.5pt] leading-none font-medium tracking-[-0.01em]">
                {d}
              </div>
            ))}
          </div>
          <div className="relative flex gap-[1.6mm]" style={{ height: `${GRID_MM}mm` }}>
            <div aria-hidden="true" className="relative w-[6.4mm] flex-none">
              {hourMarks.map((h, i) => (
                <span
                  key={h}
                  className="absolute right-0 text-[6.8pt] leading-none text-muted"
                  style={{ top: `${i * hourMm}mm`, transform: i === 0 ? "none" : "translateY(-50%)" }}
                >
                  {h}
                </span>
              ))}
            </div>
            {days.map((day) => (
              <div
                key={day}
                className="relative flex-1 rounded-[1.6mm] bg-bg"
                style={{
                  // Líneas de cada hora (llenas) y de cada media hora (más suaves).
                  backgroundImage: `linear-gradient(var(--line) 0.25mm, transparent 0.25mm), linear-gradient(color-mix(in srgb, var(--line) 45%, transparent) 0.2mm, transparent 0.2mm)`,
                  backgroundSize: `100% ${hourMm}mm, 100% ${hourMm / 2}mm`,
                  backgroundPositionY: `${-0.12}mm`,
                }}
              >
                {placeInDay(items.filter((it) => it.day === day)).map((it) => (
                  <Block key={`${it.kind}-${it.index}-${it.start}`} item={it} poster={poster} hours={hours} hourMm={hourMm} />
                ))}
              </div>
            ))}
            {empty && (
              <p className="absolute inset-0 grid place-items-center pl-[8mm] text-[11pt] text-muted">
                Todavía no elegiste materias{poster.option ? ` para la Opción ${poster.option}` : ""}.
              </p>
            )}
          </div>
        </section>

        {/* Materias, actividades y totales */}
        <aside aria-label="Materias" className="flex w-[64mm] flex-none flex-col">
          <h2 className="pb-[1.6mm] font-display text-[8.5pt] leading-none font-medium tracking-[-0.01em]">Materias</h2>
          <ul className="flex flex-col">
            {poster.courses.map((c) => {
              const asyncMin = c.blocks.filter((b) => b.async).reduce((s, b) => s + b.end - b.start, 0);
              return (
                <li key={c.name} style={tone(c.color)} className="flex items-start gap-[2.4mm] border-t-[0.25mm] border-line py-[2.1mm]">
                  <span aria-hidden="true" className="relative mt-[0.5mm] h-[3.4mm] w-[3.4mm] flex-none overflow-hidden rounded-[0.9mm] border-[0.2mm] border-[color-mix(in_srgb,var(--ci)_30%,transparent)] bg-[color-mix(in_oklab,var(--c),var(--ci)_8%)]">
                    <span className="absolute inset-x-0 top-0 h-[0.9mm] bg-[var(--ci)]" />
                  </span>
                  <div className="min-w-0 flex-auto">
                    <div className="text-[8.6pt] leading-[1.15] font-semibold">{c.name}</div>
                    <div className="mt-[0.6mm] text-[7.2pt] leading-[1.2] text-ink-2">
                      {c.label}
                      {c.teachers && <> · {c.teachers}</>}
                    </div>
                    {asyncMin > 0 && (
                      <div className="mt-[0.4mm] text-[7.2pt] leading-[1.2] text-muted">+ {formatHours(asyncMin)} h asincrónicas por semana</div>
                    )}
                  </div>
                  {c.credits !== null && (
                    <span className="pt-[0.3mm] font-display text-[8.2pt] leading-none font-medium whitespace-nowrap">{c.credits} C</span>
                  )}
                </li>
              );
            })}
          </ul>

          {/* El total, como la suma de la columna de créditos. */}
          {totals.subjects > 0 && (
            <div className="flex items-end justify-between gap-[3mm] border-t-[0.5mm] border-ink pt-[2.4mm]">
              <div className="text-[7.4pt] leading-[1.35] text-ink-2">
                <div className="text-[8.6pt] font-semibold text-ink">Total</div>
                {totals.subjects} {totals.subjects === 1 ? "materia" : "materias"} · {formatHours(totals.weeklyMinutes)} h de clase por semana
                {totals.asyncMinutes > 0 && <> + {formatHours(totals.asyncMinutes)} h asincrónicas</>}
              </div>
              <div className="font-display text-[19pt] leading-none font-semibold tracking-[-0.03em] whitespace-nowrap">
                {totals.credits}
                <span className="ml-[0.8mm] text-[10pt] font-medium tracking-normal">C</span>
              </div>
            </div>
          )}

          {poster.activities.length > 0 && (
            <>
              <h2 className="mt-[6mm] pb-[1.6mm] font-display text-[8.5pt] leading-none font-medium tracking-[-0.01em]">Actividades</h2>
              <ul className="flex flex-col">
                {poster.activities.map((a) => (
                  <li key={a.name} style={tone(a.color)} className="flex items-start gap-[2.4mm] border-t-[0.25mm] border-line py-[2.1mm]">
                    <span
                      aria-hidden="true"
                      className="mt-[0.5mm] h-[3.4mm] w-[3.4mm] flex-none rounded-[0.9mm] border-[0.2mm] border-dashed border-[color-mix(in_srgb,var(--ci)_50%,transparent)] bg-hatch [--hatch:var(--c)]"
                    />
                    <div className="min-w-0 flex-auto">
                      <div className="text-[8.6pt] leading-[1.15] font-semibold">{a.name}</div>
                      <div className="mt-[0.6mm] text-[7.2pt] leading-[1.2] text-ink-2">
                        {timesLabel(a.blocks)}
                        {a.place && <> · {a.place}</>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

        </aside>
      </div>

      <footer className="mt-[5mm] flex items-center justify-between border-t-[0.25mm] border-line pt-[3mm]">
        <Logo className="h-[3.3mm]" />
        <span className="text-[8pt] leading-none font-medium tracking-[0.01em] text-ink-2">fiubi.com.ar</span>
      </footer>
    </article>
  );
}

function Block({
  item,
  poster,
  hours,
  hourMm,
}: {
  item: PosterItem & { lane: number; lanes: number };
  poster: PosterData;
  hours: { first: number; last: number };
  hourMm: number;
}) {
  const { top, height } = blockBox(item.start, item.end, hours);
  const detail = blockDetail(((item.end - item.start) / 60) * hourMm);
  const width = 100 / item.lanes;
  const position: CSSProperties = {
    top: `calc(${top}% + 0.35mm)`,
    height: `calc(${height}% - 0.7mm)`,
    left: `calc(${item.lane * width}% + 0.5mm)`,
    width: `calc(${width}% - 1mm)`,
  };
  const time = `${formatHour(item.start)}–${formatHour(item.end)}`;
  const meta = "truncate text-[6.6pt] leading-[1.25]";

  if (item.kind === "activity") {
    const a = poster.activities[item.index];
    return (
      <div
        style={{ ...position, ...tone(a.color) }}
        className="absolute overflow-hidden rounded-[1.4mm] border-[0.25mm] border-dashed border-[color-mix(in_srgb,var(--ci)_55%,transparent)] bg-hatch px-[1.6mm] py-[1.2mm] text-[var(--ci)] [--hatch:var(--c)]"
      >
        <div className="line-clamp-2 text-[7.6pt] leading-[1.15] font-bold">{a.name}</div>
        {detail >= 2 && <div className={`${meta} font-medium`}>{time}</div>}
        {detail >= 3 && a.place && <div className={meta}>{a.place}</div>}
      </div>
    );
  }

  const c = poster.courses[item.index];
  return (
    <div
      style={{ ...position, ...tone(c.color) }}
      className="absolute overflow-hidden rounded-[1.4mm] border-[0.2mm] border-[color-mix(in_srgb,var(--ci)_28%,transparent)] bg-[color-mix(in_oklab,var(--c),var(--ci)_8%)] px-[1.6mm] pt-[1.9mm] pb-[1.2mm] text-[var(--ci)]"
    >
      {/* Franja de la tinta: separa materias aunque se imprima en gris. */}
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[0.9mm] bg-[var(--ci)]" />
      <div className={`${detail === 1 ? "line-clamp-1" : "line-clamp-2"} text-[7.6pt] leading-[1.15] font-bold`}>{c.name}</div>
      {detail >= 2 && (
        <div className={`${meta} font-medium`}>
          {time}
          {item.type && <> · {item.type}</>}
        </div>
      )}
      {detail >= 3 && <div className={meta}>{placeLabel(item.room, item.campus)}</div>}
      {detail >= 4 && (
        <div className={`${meta} opacity-80`}>
          {c.label.replace(" · práctica ", " ")}
          {c.teachers && <> · {c.teachers}</>}
        </div>
      )}
    </div>
  );
}
