import Link from "next/link";
import { CALENDAR_DAYS, layoutWeek, type PlacedBlock } from "@/lib/home/calendar";
import type { HomeCourses } from "@/lib/home/courses";
import { formatHour } from "@/lib/plan/format";

// Calendario de la cursada del Inicio (prototipo 04-inicio): solo lectura, con los cursos
// en los que el alumno se inscribió desde el Plan. Misma paleta y orden que el calendario del plan.

const PALETTE = [
  "bg-lavender text-lavender-ink border-lavender-ink/25",
  "bg-mint text-mint-ink border-mint-ink/25",
  "bg-butter text-butter-ink border-butter-ink/25",
  "bg-sky text-sky-ink border-sky-ink/25",
  "bg-peach text-peach-ink border-peach-ink/25",
  "bg-pink text-pink-ink border-pink-ink/25",
  "bg-teal text-teal-ink border-teal-ink/25",
];
const CAMPUS_NAME = { PC: "Paseo Colón", LH: "Las Heras", CU: "Ciudad Universitaria" } as const;
const HOUR_PX = 24;

export function HomeCalendar({ data }: { data: HomeCourses }) {
  const week = layoutWeek(data.courses);
  const hours = Array.from({ length: week.last - week.first }, (_, i) => week.first + i);
  const height = hours.length * HOUR_PX;

  return (
    <section aria-label={`Cursada ${data.term}`} className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-2xl border border-line bg-surface p-7">
      <div className="flex flex-wrap justify-between gap-2">
        <div className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Cursada {data.term} · {week.credits} créditos
        </div>
        {week.campuses.length > 0 && (
          <div className="text-xs text-muted">{week.campuses.map((c) => `${c} ${CAMPUS_NAME[c]}`).join(" · ")}</div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[580px] grid-cols-[34px_repeat(6,minmax(84px,1fr))] gap-x-1">
          <div />
          {CALENDAR_DAYS.map((d) => (
            <div key={d} className="pb-2 text-xs font-semibold text-muted">
              {d}
            </div>
          ))}
          <div className="flex flex-col text-[11px] leading-none text-muted tabular-nums">
            {hours.map((h) => (
              <div key={h} style={{ height: HOUR_PX }}>
                {h}
              </div>
            ))}
          </div>
          {week.days.map((blocks, i) => (
            <div key={CALENDAR_DAYS[i]} className="relative rounded-lg bg-bg" style={{ height }}>
              {blocks.map((p) => (
                <Block key={`${p.course.offeringId}-${p.block.start}`} placed={p} first={week.first} />
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

function Block({ placed: p, first }: { placed: PlacedBlock; first: number }) {
  const { block } = p;
  const top = ((block.start - first * 60) / 60) * HOUR_PX + 1;
  const height = ((block.end - block.start) / 60) * HOUR_PX - 2;
  const width = 100 / p.lanes;
  const where = block.campus ?? (block.virtual ? "Virtual" : null);
  return (
    <div
      className={`absolute overflow-hidden rounded-lg border px-2 py-1.5 text-xs leading-tight ${PALETTE[p.color % PALETTE.length]}`}
      style={{ top, height, left: `calc(${p.lane * width}% + 3px)`, width: `calc(${width}% - 6px)` }}
      title={`${p.course.subject} · ${p.course.code}${where ? ` · ${where}` : ""} · ${formatHour(block.start)}–${formatHour(block.end)} hs`}
    >
      <div className="line-clamp-2 font-semibold">{p.course.subject}</div>
      <div className="opacity-90 tabular-nums">
        {[p.course.code, where, `${formatHour(block.start)}–${formatHour(block.end)}`].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}
