import Link from "next/link";
import { CALENDAR_DAYS, calendarDayIndex, firstDayToShow, layoutWeek, type PlacedBlock } from "@/lib/home/calendar";
import type { HomeCourses } from "@/lib/home/courses";
import { formatHour } from "@/lib/plan/format";
import { HomeDayView } from "./HomeDayView";
import { CAMPUS_NAME, PALETTE } from "./home-palette";

// Calendario de la cursada del Inicio (prototipo 04-inicio): solo lectura, con los cursos
// en los que el alumno se inscribió desde el Plan. Misma paleta y orden que el calendario del plan.
// En el celular se ve un día por vez (HomeDayView); desde 768 px, la grilla de la semana.
// La grilla mide siempre más o menos lo mismo: con pocas horas de cursada, cada hora es más alta
// y los nombres entran enteros.
const GRID_PX = 420;
const hourPx = (hours: number) => Math.round(Math.min(56, Math.max(26, GRID_PX / hours)));


export function HomeCalendar({ data }: { data: HomeCourses }) {
  const week = layoutWeek(data.courses);
  const hours = Array.from({ length: week.last - week.first }, (_, i) => week.first + i);
  const hourHeight = hourPx(hours.length);
  const height = hours.length * hourHeight;
  // "Hoy" se calcula en el servidor (en hora de Buenos Aires), así el celular no cambia de día al hidratar.
  const today = calendarDayIndex(new Date());

  return (
    <section aria-label={`Cursada ${data.term}`} className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-2xl border border-line bg-surface p-5 md:p-7">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Cursada {data.term} · {week.credits} créditos
        </div>
        {week.campuses.length > 0 && (
          <div className="text-xs text-muted">{week.campuses.map((c) => `${c} ${CAMPUS_NAME[c]}`).join(" · ")}</div>
        )}
      </div>

      <div className="md:hidden">
        <HomeDayView days={week.days} today={today} initial={firstDayToShow(week.days, today)} />
      </div>

      <div className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[580px] grid-cols-[34px_repeat(6,minmax(84px,1fr))] gap-x-1">
          <div />
          {CALENDAR_DAYS.map((d) => (
            <div key={d} className="pb-2 text-xs font-semibold text-muted">
              {d}
            </div>
          ))}
          <div className="flex flex-col text-[11px] leading-none text-muted tabular-nums">
            {hours.map((h) => (
              <div key={h} style={{ height: hourHeight }}>
                {h}
              </div>
            ))}
          </div>
          {week.days.map((blocks, i) => (
            <div key={CALENDAR_DAYS[i]} className="relative rounded-lg bg-bg" style={{ height }}>
              {blocks.map((p) => (
                <Block key={`${p.course.offeringId}-${p.block.start}`} placed={p} first={week.first} hourHeight={hourHeight} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {week.asyncClasses.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
          Asincrónicas:
          {week.asyncClasses.map(({ course, color }) => (
            <span key={course.offeringId} className={`rounded-full border px-2.5 py-0.5 font-semibold ${PALETTE[color % PALETTE.length]}`}>
              {course.subject} · {course.code}
            </span>
          ))}
        </div>
      )}

      <Link href="/plan" className="self-start font-semibold text-accent">
        Ver el plan →
      </Link>
    </section>
  );
}

// Alto de una línea de texto en un bloque (12 px con interlineado 1,25) y relleno vertical.
const LINE_PX = 15;
const PAD_PX = 12;

function Block({ placed: p, first, hourHeight }: { placed: PlacedBlock; first: number; hourHeight: number }) {
  const { block } = p;
  const top = ((block.start - first * 60) / 60) * hourHeight + 1;
  const height = ((block.end - block.start) / 60) * hourHeight - 2;
  const width = 100 / p.lanes;
  const where = block.campus ?? (block.virtual ? "Virtual" : null);
  const details = [p.course.code, where, `${formatHour(block.start)}–${formatHour(block.end)}`].filter(Boolean).join(" · ");
  // El nombre usa todo el alto que haya; la línea de curso y horario solo entra si sobra lugar
  // (si no, queda en el texto que aparece al pasar el mouse).
  const lines = Math.max(1, Math.floor((height - PAD_PX) / LINE_PX));
  const showDetails = lines >= 3;
  const titleLines = showDetails ? lines - 1 : lines;
  return (
    <div
      className={`absolute overflow-hidden rounded-lg border px-2 py-1.5 leading-tight ${p.lanes > 1 ? "text-[11px]" : "text-xs"} ${PALETTE[p.color % PALETTE.length]}`}
      style={{ top, height, left: `calc(${p.lane * width}% + 3px)`, width: `calc(${width}% - 6px)` }}
      title={`${p.course.subject} · ${details}`}
    >
      <div
        className="overflow-hidden font-semibold hyphens-auto"
        style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: titleLines }}
      >
        {p.course.subject}
      </div>
      {showDetails && <div className="truncate opacity-90 tabular-nums">{details}</div>}
    </div>
  );
}
