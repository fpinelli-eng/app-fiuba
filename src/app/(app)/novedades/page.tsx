import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getNewsPage } from "@/lib/news/data";
import { formatNewsDate, formatWeekday, groupCalendar, nextDates, type FiubaNewsItem } from "@/lib/news/model";
import { requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: `Novedades · ${APP_NAME}` };

const FIUBA_URL = "https://www.ingenieria.uba.ar";

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
  const dates = nextDates(groupCalendar(events, today));

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

      {dates.length > 0 && (
        <section aria-labelledby="calendar-title" className="rounded-2xl border border-line bg-surface px-4 py-3.5 md:px-[22px]">
          <h2 id="calendar-title" className="text-[15px] font-semibold text-muted">
            Próximas fechas
          </h2>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {dates.map(({ event, now }) => (
              <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="min-w-0 text-[15px] text-ink">{event.title}</span>
                <span className="text-sm whitespace-nowrap text-muted tabular-nums">
                  {now ? `hasta el ${formatWeekday(event.endsOn)}` : `desde el ${formatWeekday(event.startsOn)}`}
                </span>
              </li>
            ))}
          </ul>
          <a href={FIUBA_URL} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block py-1 text-[13px] text-muted underline">
            Calendario académico de la FIUBA
          </a>
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
