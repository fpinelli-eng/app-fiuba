import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getNewsPage } from "@/lib/news/data";
import {
  calendarHighlights,
  dateBadge,
  formatCountdown,
  formatNewsDate,
  formatRemaining,
  formatWeekday,
  groupCalendar,
  type DateHighlight,
  type FiubaNewsItem,
} from "@/lib/news/model";
import { requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: `Novedades · ${APP_NAME}` };

const FIUBA_URL = "https://www.ingenieria.uba.ar";

// Oculto por ahora (10/11/2026): las fechas del calendario académico cargado tienen errores.
// Para volver a mostrarlo, true. Los datos y la lógica siguen igual.
const SHOW_ACADEMIC_CALENDAR = false;

// Las fechas van en una fila que se desliza en el celular (así las noticias quedan a mano, sin
// bajar tanto) y en una grilla en la computadora.
const DATE_ROW =
  "-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-3 md:overflow-visible md:px-0 md:pb-0";
const DATE_CARD = "flex w-[78%] max-w-[300px] shrink-0 snap-start flex-col rounded-2xl md:w-auto md:max-w-none";

const range = (e: DateHighlight["event"]) =>
  e.startsOn === e.endsOn ? formatWeekday(e.startsOn) : `${formatWeekday(e.startsOn)} → ${formatWeekday(e.endsOn)}`;

// En curso: cuánto falta para que termine y una barra con lo que ya pasó del período.
function NowCard({ date }: { date: DateHighlight }) {
  const { event, days, progress } = date;
  return (
    <li className={`${DATE_CARD} gap-3 bg-mint p-4 text-mint-ink`}>
      <span className="line-clamp-3 text-[15px] leading-snug font-semibold">{event.title}</span>
      <span className="mt-auto flex flex-col gap-1.5">
        <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface/70">
          <span className="block h-full rounded-full bg-mint-ink" style={{ width: `${Math.max(6, Math.round(progress * 100))}%` }} />
        </span>
        <span className="flex items-baseline justify-between gap-2 text-[13px] tabular-nums">
          <span className="font-semibold">{formatRemaining(days)}</span>
          <span className="opacity-80">hasta {formatWeekday(event.endsOn)}</span>
        </span>
      </span>
    </li>
  );
}

// Por empezar: el día en grande y la cuenta regresiva, resaltada cuando falta poco.
function UpcomingCard({ date }: { date: DateHighlight }) {
  const { event, days } = date;
  const badge = dateBadge(event.startsOn);
  const close = days <= 3;
  return (
    <li className={`${DATE_CARD} gap-3 border border-line bg-surface p-4`}>
      <span className="flex items-start justify-between gap-3">
        <span className="flex w-[54px] flex-none flex-col items-center rounded-xl bg-lavender py-1.5 leading-none text-lavender-ink">
          <span className="text-[11px] font-semibold uppercase">{badge.month}</span>
          <span className="font-display text-[24px] font-semibold tabular-nums">{badge.day}</span>
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${
            close ? "bg-peach text-peach-ink" : "bg-sky text-sky-ink"
          }`}
        >
          {formatCountdown(days)}
        </span>
      </span>
      <span className="line-clamp-3 text-[15px] leading-snug font-semibold text-ink">{event.title}</span>
      <span className="mt-auto text-[13px] text-muted tabular-nums">{range(event)}</span>
    </li>
  );
}

function FiubaNewsCard({ item, today }: { item: FiubaNewsItem; today: string }) {
  return (
    <li>
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface hover:border-line-strong"
      >
        {item.imageUrl && (
          // Las imágenes son de cms.fi.uba.ar: van tal cual, sin pasar por el optimizador de Vercel.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" loading="lazy" decoding="async" className="aspect-[16/9] w-full bg-bg object-cover" />
        )}
        <span className="flex flex-1 flex-col gap-1 px-4 py-3.5 md:px-5 md:py-4">
          <span className="text-[13px] text-muted tabular-nums">{formatNewsDate(item.publishedAt, today)}</span>
          <span className="text-[17px] leading-snug font-semibold text-ink group-hover:underline">{item.title}</span>
          {item.summary && <span className="line-clamp-3 text-[15px] text-ink-2">{item.summary}</span>}
        </span>
      </a>
    </li>
  );
}

// Novedades: avisos from the admins, the next dates of the FIUBA academic calendar and the news of
// www.fi.uba.ar (copied every two hours by the "Noticias de la FIUBA" workflow).
export default async function NovedadesPage() {
  await requireProfile();
  const { today, news, fiuba, events } = await getNewsPage();
  const dates = calendarHighlights(groupCalendar(events, today), today);

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-4 px-4 pt-5 pb-8 md:gap-[18px] md:px-6 md:pt-8 md:pb-14">
      <h1 className="text-[26px] font-semibold tracking-[-0.01em] md:text-[32px]">Novedades</h1>

      {news.length > 0 && (
        <section aria-labelledby="news-title" className="flex flex-col gap-2.5">
          <h2 id="news-title" className="text-[22px] font-semibold">
            Avisos
          </h2>
          {news.map((n) => (
            <article key={n.id} className="rounded-2xl border border-line bg-surface px-4 py-4 md:px-[22px]">
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
              {n.body && <p className="mt-1.5 text-[15px] whitespace-pre-line text-ink-2 break-words">{n.body}</p>}
              {n.url && (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-block py-1.5 text-sm font-semibold text-ink-2 underline md:mt-2 md:py-0"
                >
                  Ver más
                </a>
              )}
            </article>
          ))}
        </section>
      )}

      {SHOW_ACADEMIC_CALENDAR && (dates.now.length > 0 || dates.upcoming.length > 0) && (
        <section aria-labelledby="calendar-title" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="calendar-title" className="text-[22px] font-semibold">
              Calendario
            </h2>
            <a href={FIUBA_URL} target="_blank" rel="noopener noreferrer" className="py-1 text-sm text-muted underline">
              Calendario completo
            </a>
          </div>
          {dates.now.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                <span aria-hidden="true" className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full rounded-full bg-mint-ink opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-mint-ink" />
                </span>
                Ahora
              </h3>
              <ul className={DATE_ROW}>
                {dates.now.map((d) => (
                  <NowCard key={d.event.id} date={d} />
                ))}
              </ul>
            </div>
          )}
          {dates.upcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-[15px] font-semibold">Se viene</h3>
              <ul className={DATE_ROW}>
                {dates.upcoming.map((d) => (
                  <UpcomingCard key={d.event.id} date={d} />
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="fiuba-title" className="flex flex-col gap-2.5">
        <h2 id="fiuba-title" className="mt-2 text-[22px] font-semibold">
          Noticias de la FIUBA
        </h2>
        {fiuba.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">Todavía no hay noticias.</div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 md:gap-4">
            {fiuba.map((item) => (
              <FiubaNewsCard key={item.id} item={item} today={today} />
            ))}
          </ul>
        )}
        <p className="text-[13px] text-muted">
          De{" "}
          <a href="https://www.fi.uba.ar" target="_blank" rel="noopener noreferrer" className="underline">
            fi.uba.ar
          </a>{" "}
          (Creative Commons Atribución). Cada noticia se abre en el sitio de la facultad.
        </p>
      </section>
    </main>
  );
}
