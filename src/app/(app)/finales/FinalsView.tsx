"use client";

import Link from "next/link";
import { useState } from "react";
import { normalizeText } from "@/lib/map/model";
import {
  enrollmentStatus,
  formatEnrollMoment,
  formatExamDay,
  formatExamTime,
  formatTeachers,
  type ExamSubjectView,
  type ExamTableView,
  type FinalsData,
} from "@/lib/exams/types";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function EnrollmentChip({ table, now }: { table: ExamTableView; now: string }) {
  const status = enrollmentStatus(table, now);
  const chip = "rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap";
  switch (status.kind) {
    case "open":
      return <span className={`${chip} bg-mint text-mint-ink`}>Inscripción abierta hasta el {formatEnrollMoment(status.until)}</span>;
    case "soon":
      return <span className={`${chip} bg-butter text-butter-ink`}>Inscripción desde el {formatEnrollMoment(status.from)}</span>;
    case "closed":
      return <span className="text-[12.5px] whitespace-nowrap text-muted">Inscripción cerrada</span>;
    default:
      return null;
  }
}

/** Room, examiners and drop deadline, when the dates were loaded with the SIU link. */
function tableDetails(t: ExamTableView): string {
  const room = t.room && (/^aula\b/i.test(t.room) ? t.room : `Aula ${t.room}`);
  const drop = t.dropUntil && `Baja hasta el ${formatEnrollMoment(t.dropUntil)}`;
  return [room, formatTeachers(t.teachers), drop].filter(Boolean).join(" · ");
}

function TableRow({ table, now, timed }: { table: ExamTableView; now: string; timed: boolean }) {
  const time = formatExamTime(table.startTime, table.endTime);
  const details = tableDetails(table);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-[22px] py-2.5">
      <span className={`${timed ? "w-[184px]" : "w-[76px]"} flex-none text-sm text-ink-2 tabular-nums`}>
        <span className="font-semibold">{formatExamDay(table.date)}</span>
        {time && <span> · {time}</span>}
      </span>
      <span className="flex min-w-0 flex-auto flex-col">
        <span className="text-sm text-ink-2">
          {table.name}
          {table.kind !== "Regular" && <span className="text-[13px] text-muted"> · {table.kind}</span>}
        </span>
        {details && <span className="text-[12.5px] text-muted">{details}</span>}
      </span>
      <EnrollmentChip table={table} now={now} />
    </div>
  );
}

export function FinalsView({ data }: { data: FinalsData }) {
  const [query, setQuery] = useState("");
  const q = normalizeText(query);
  const { now, pending, all } = data;

  const open = pending.flatMap((s) => {
    const table = s.tables.find((t) => enrollmentStatus(t, now).kind === "open");
    return table?.enrollTo ? [{ name: s.name, until: table.enrollTo }] : [];
  });
  const shown = q ? all.filter((s) => normalizeText(s.name).includes(q)) : all;
  // Dates loaded with the SIU link have times: the date column makes room for them.
  const timed = all.some((s) => s.tables.some((t) => t.startTime));

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-6 pt-8 pb-14">
      <h1 className="text-[32px] font-semibold tracking-[-0.01em]">Finales</h1>

      {!data.loaded && (
        <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">
          Todavía no se cargaron las fechas de examen de tu plan.
        </div>
      )}

      {data.loaded && (
        <>
          {open.length > 0 && (
            <div className="rounded-[14px] bg-mint px-[18px] py-3.5 text-mint-ink">
              <b>Inscripción abierta:</b>{" "}
              {open
                .slice(0, 3)
                .map((o) => `${o.name} hasta el ${formatEnrollMoment(o.until)}`)
                .join(" · ")}
              {open.length > 3 && ` y ${open.length - 3} más`}
            </div>
          )}

          <section aria-labelledby="pending-title" className="overflow-hidden rounded-2xl border border-line bg-surface">
            <h2 id="pending-title" className="px-[22px] pt-4 pb-2 text-[19px] font-semibold">
              Tus finales pendientes
            </h2>
            {pending.length === 0 ? (
              <div className="px-[22px] pb-4 text-sm text-muted">
                No tenés finales pendientes en tu mapa.{" "}
                <Link href="/mapa" className="font-semibold text-ink-2 underline">
                  Ir al mapa
                </Link>
              </div>
            ) : (
              <div className="flex flex-col pb-2">
                {pending.map((s) => (
                  <div key={s.key} className="border-t border-line first:border-t-0">
                    <h3 className="px-[22px] pt-3 pb-1 text-[15px] font-semibold">{s.name}</h3>
                    {s.tables.length === 0 ? (
                      <div className="px-[22px] pb-3 text-[13px] text-muted">Sin mesas cargadas.</div>
                    ) : (
                      s.tables.slice(0, 3).map((t) => <TableRow key={t.id} table={t} now={now} timed={timed} />)
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <h2 className="mt-2 text-[22px] font-semibold">Todas las mesas</h2>
          <div className="relative">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="absolute top-[15px] left-4 text-muted">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <label htmlFor="q" className="sr-only">
              Buscar por materia
            </label>
            <input
              id="q"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscá por materia"
              className="h-[50px] w-full rounded-xl border border-line-strong bg-surface pr-4 pl-[46px] text-base text-ink"
            />
          </div>

          {shown.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">
              {q ? "No encontramos materias con esa búsqueda." : "No hay mesas próximas cargadas."}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {shown.map((s: ExamSubjectView) => (
              <section key={s.key} aria-label={s.name} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-lavender px-[22px] py-3.5">
                  <h3 className="text-[19px] leading-snug font-semibold text-lavender-ink">{s.name}</h3>
                  <span className="text-[13px] whitespace-nowrap text-lavender-ink/80">{plural(s.tables.length, "mesa", "mesas")}</span>
                </div>
                <div className="py-1">
                  {s.tables.map((t) => (
                    <TableRow key={t.id} table={t} now={now} timed={timed} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
