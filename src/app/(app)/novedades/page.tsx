import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app";
import { getNewsPage } from "@/lib/news/data";
import { formatNewsDate, formatWeekday, groupCalendar, type AcademicEvent } from "@/lib/news/model";
import { requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: `Novedades · ${APP_NAME}` };

const FIUBA_URL = "https://www.ingenieria.uba.ar";

function EventList({ events, label }: { events: AcademicEvent[]; label: (e: AcademicEvent) => string }) {
  return (
    <ul className="flex flex-col py-1">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-[22px] py-2.5">
          <span className="min-w-0 text-[15px] text-ink">{e.title}</span>
          <span className="text-sm whitespace-nowrap text-muted tabular-nums">{label(e)}</span>
        </li>
      ))}
    </ul>
  );
}

function CalendarBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="overflow-hidden rounded-2xl border border-line bg-surface">
      <h3 className="bg-lavender px-[22px] py-3 text-[17px] font-semibold text-lavender-ink">{title}</h3>
      {children}
    </section>
  );
}

// Novedades: avisos from the admins and the FIUBA academic calendar around today (Buenos Aires).
export default async function NovedadesPage() {
  await requireProfile();
  const { today, news, events } = await getNewsPage();
  const { now, soon, later } = groupCalendar(events, today);
  const empty = now.length + soon.length + later.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-6 pt-8 pb-14">
      <h1 className="text-[32px] font-semibold tracking-[-0.01em]">Novedades</h1>

      {news.length > 0 && (
        <section aria-labelledby="news-title" className="flex flex-col gap-2.5">
          <h2 id="news-title" className="text-[22px] font-semibold">
            Avisos
          </h2>
          {news.map((n) => (
            <article key={n.id} className="rounded-2xl border border-line bg-surface px-[22px] py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-[17px] leading-snug font-semibold">
                  {n.pinned && (
                    <span className="mr-2 rounded-full bg-butter px-2.5 py-0.5 align-middle text-[12px] font-semibold text-butter-ink">
                      Fijado
                    </span>
                  )}
                  {n.title}
                </h3>
                <span className="text-[13px] whitespace-nowrap text-muted tabular-nums">{formatNewsDate(n.publishedAt, today)}</span>
              </div>
              {n.body && <p className="mt-1.5 text-[15px] whitespace-pre-line text-ink-2">{n.body}</p>}
              {n.url && (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-ink-2 underline"
                >
                  Ver más
                </a>
              )}
            </article>
          ))}
        </section>
      )}

      <section aria-labelledby="calendar-title" className="flex flex-col gap-2.5">
        <h2 id="calendar-title" className="mt-2 text-[22px] font-semibold">
          Calendario académico
        </h2>

        {empty && (
          <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">
            No hay fechas del calendario académico para los próximos meses.
          </div>
        )}

        {now.length > 0 && (
          <CalendarBlock title="Ahora">
            <EventList events={now} label={(e) => `hasta el ${formatWeekday(e.endsOn)}`} />
          </CalendarBlock>
        )}
        {soon.length > 0 && (
          <CalendarBlock title="Próximamente">
            <EventList events={soon} label={(e) => `desde el ${formatWeekday(e.startsOn)}`} />
          </CalendarBlock>
        )}
        {later.length > 0 && (
          <CalendarBlock title="Más adelante">
            <ul className="flex flex-col py-1.5">
              {later.map((e) => (
                <li key={e.id} className="flex gap-3 px-[22px] py-1 text-sm">
                  <span className="w-[72px] flex-none text-muted tabular-nums">{formatWeekday(e.startsOn)}</span>
                  <span className="min-w-0 text-ink-2">{e.title}</span>
                </li>
              ))}
            </ul>
          </CalendarBlock>
        )}

        <p className="text-[13px] text-muted">
          Según el{" "}
          <a href={FIUBA_URL} target="_blank" rel="noopener noreferrer" className="underline">
            calendario académico de la FIUBA
          </a>
          : las fechas son por semana (de lunes a sábado).
        </p>
      </section>
    </main>
  );
}
