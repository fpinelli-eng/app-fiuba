import type { ReactNode } from "react";
import { calendarDayIndex, layoutWeek, type PlacedBlock } from "@/lib/home/calendar";
import type { HomeCourses } from "@/lib/home/courses";
import { formatHour } from "@/lib/plan/format";
import { CAMPUS_NAME, DOT, PALETTE } from "./home-palette";

// "Esta semana" del Inicio: los cursos en los que el alumno se inscribió desde el Plan, solo lectura.
// En la computadora, una columna por día (lunes a viernes, y el sábado si hay clases); en el celular,
// una lista que arranca hoy y sigue con los próximos días. Misma paleta y orden que el plan.

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const time = (p: PlacedBlock) => `${formatHour(p.block.start)}–${formatHour(p.block.end)} hs`;
const where = (p: PlacedBlock) => (p.block.campus ? CAMPUS_NAME[p.block.campus] : p.block.virtual ? "Virtual" : null);
const blockKey = (p: PlacedBlock) => `${p.course.offeringId}-${p.block.weekday}-${p.block.start}`;

export function HomeCalendar({ data, action }: { data: HomeCourses; action: ReactNode }) {
  const week = layoutWeek(data.courses);
  // "Hoy" se calcula en el servidor, en hora de Buenos Aires (domingo = 6: no hay columna de hoy).
  const today = calendarDayIndex(new Date());
  const shown = week.days[5].length ? 6 : 5;

  // Celular: desde hoy (el domingo, desde el lunes), los días con clases en orden.
  const start = today > 5 ? 0 : today;
  const upcoming = Array.from({ length: 6 }, (_, i) => (start + i) % 6).flatMap((d) =>
    week.days[d].map((p, i) => ({ p, day: d, firstOfDay: i === 0 })),
  );

  return (
    <section aria-labelledby="semana" className="flex min-w-0 flex-col rounded-[24px] bg-surface px-4 pt-4 pb-2 shadow-[0_16px_30px_-28px_var(--card-shadow)] md:rounded-[28px] md:px-[26px] md:py-[22px]">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 md:mb-3.5">
        <h2 id="semana" className="text-base font-semibold md:text-lg">
          Esta semana
        </h2>
        {action}
      </div>

      {upcoming.length === 0 && week.asyncClasses.length === 0 && <p className="pb-3 text-muted md:pb-0">Sin clases presenciales esta semana.</p>}

      <ul className="md:hidden">
        {upcoming.map(({ p, day, firstOfDay }) => (
          <li key={blockKey(p)} className="flex items-center gap-3 border-b border-line py-[9px] text-[15px] last:border-b-0">
            <span className={`w-[46px] flex-none text-sm ${day === today ? "font-bold text-accent" : "font-medium text-muted"}`}>
              {firstOfDay ? (day === today ? "Hoy" : DAYS[day]) : <span className="sr-only">{DAYS[day]}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span aria-hidden="true" className={`mr-2 inline-block size-2 rounded-full align-[1px] ${DOT[p.color % DOT.length]}`} />
              <span className="font-semibold">{p.course.subject}</span>
            </span>
            <span className="flex-none text-sm text-muted tabular-nums" title={where(p) ?? undefined}>
              {time(p)}
            </span>
          </li>
        ))}
      </ul>

      <div className="hidden gap-2.5 md:grid" style={{ gridTemplateColumns: `repeat(${shown}, minmax(0, 1fr))` }}>
        {week.days.slice(0, shown).map((blocks, d) => (
          <div key={DAYS[d]} className="flex flex-col gap-2">
            <h3
              className={`text-sm ${
                d === today ? "font-bold text-ink underline decoration-accent decoration-[3px] underline-offset-[6px]" : "font-medium text-muted"
              }`}
            >
              {d === today ? `${DAYS[d]}, hoy` : DAYS[d]}
              <span className="sr-only">{d === today ? "" : ` (${DAY_NAMES[d]})`}</span>
            </h3>
            {blocks.map((p) => (
              <div key={blockKey(p)} className={`rounded-[14px] px-2.5 py-2 text-[13px] leading-[17px] ${PALETTE[p.color % PALETTE.length]}`} title={where(p) ?? undefined}>
                <strong className="block font-semibold break-words hyphens-auto [hyphenate-limit-chars:10_4_4]">{p.course.subject}</strong>
                <span className="tabular-nums">{time(p)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {week.asyncClasses.length > 0 && (
        <p className="py-3 text-[13px] text-muted md:pt-4 md:pb-0">
          Asincrónicas: {week.asyncClasses.map(({ course }) => course.subject).join(", ")}
        </p>
      )}
    </section>
  );
}
