import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getCalendarInfo, getDatesToConfirm, getNews } from "@/lib/news/data";
import { buenosAiresDate, formatDateRange, formatNewsDate, isImportantDate } from "@/lib/news/model";
import { ConfirmDateForm } from "./ConfirmDateForm";
import { deleteConfirmation, deleteNews, setNewsPinned } from "./actions";
import { NewsForm } from "./NewsForm";

export const metadata: Metadata = { title: `Novedades · Administración · ${APP_NAME}` };

const secondary =
  "h-9 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink";

const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

// Novedades: avisos para los alumnos, las fechas importantes confirmadas por la Secretaría y el
// calendario académico cargado (solo lectura). El layout de /admin ya exige ser administrador.
export default async function AdminNewsPage() {
  const [news, calendar, dates] = await Promise.all([getNews(), getCalendarInfo(), getDatesToConfirm()]);
  const today = buenosAiresDate();
  const confirmed = new Set(dates.confirmations.map((c) => c.replaces));
  const toConfirm = dates.events.filter((e) => isImportantDate(e.title) && !confirmed.has(e.id));
  const titleOf = new Map(dates.events.map((e) => [e.id, e]));

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-14">
      <div>
        <h1 className="text-[30px] font-semibold">Novedades</h1>
        <div className="text-muted">Los avisos se ven arriba de todo en Novedades, los fijados primero.</div>
      </div>

      <NewsForm />

      <section aria-labelledby="list-title" className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <h2 id="list-title" className="px-6 pt-[18px] pb-2 text-[19px] font-semibold">
          Avisos publicados
        </h2>
        {news.length === 0 ? (
          <p className="px-6 pb-5 text-sm text-muted">Todavía no hay avisos.</p>
        ) : (
          <ul className="flex flex-col pb-2">
            {news.map((n) => (
              <li key={n.id} className="flex items-start gap-4 border-t border-line px-6 py-3.5 first:border-t-0">
                <div className="min-w-0 flex-auto">
                  <div className="font-semibold">
                    {n.pinned && (
                      <span className="mr-2 rounded-full bg-butter px-2.5 py-0.5 text-[12px] font-semibold text-butter-ink">Fijado</span>
                    )}
                    {n.title}
                  </div>
                  <div className="text-[13px] text-muted">
                    {formatNewsDate(n.publishedAt, today)}
                    {n.url && <> · {n.url}</>}
                  </div>
                  {n.body && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{n.body}</p>}
                </div>
                <div className="flex flex-none gap-2">
                  <form action={setNewsPinned.bind(null, n.id, !n.pinned)}>
                    <button type="submit" className={secondary}>
                      {n.pinned ? "Desfijar" : "Fijar"}
                    </button>
                  </form>
                  <form action={deleteNews.bind(null, n.id)}>
                    <button type="submit" className={`${secondary} text-danger`}>
                      Eliminar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dates.calendar && <ConfirmDateForm events={toConfirm} />}

      {dates.confirmations.length > 0 && (
        <section aria-labelledby="confirmed-title" className="overflow-hidden rounded-[18px] border border-line bg-surface">
          <h2 id="confirmed-title" className="px-6 pt-[18px] pb-2 text-[19px] font-semibold">
            Fechas confirmadas
          </h2>
          <ul className="flex flex-col pb-2">
            {dates.confirmations.map((c) => {
              const was = c.replaces === null ? undefined : titleOf.get(c.replaces);
              return (
                <li key={c.id} className="flex items-start gap-4 border-t border-line px-6 py-3.5 first:border-t-0">
                  <div className="min-w-0 flex-auto">
                    <div className="font-semibold">{c.title}</div>
                    <div className="text-[13px] text-ink-2 tabular-nums">
                      {formatDateRange({ ...c, tentative: false })} · {c.note}
                    </div>
                    <div className="text-[13px] text-muted tabular-nums">
                      {c.replaces === null
                        ? "Fecha nueva"
                        : `Reemplaza: ${was ? formatDateRange({ ...was, tentative: true }) : "una fecha que ya pasó"}`}
                    </div>
                  </div>
                  <form action={deleteConfirmation.bind(null, c.id)} className="flex-none">
                    <button type="submit" className={`${secondary} text-danger`}>
                      Eliminar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="calendar-title" className="flex flex-col gap-1.5 rounded-[18px] border border-line bg-surface px-6 py-[18px]">
        <h2 id="calendar-title" className="text-[19px] font-semibold">
          Calendario académico
        </h2>
        {calendar.calendar ? (
          <p className="text-sm text-ink-2">
            {calendar.calendar}: {calendar.count} fechas, del {day(calendar.from)} al {day(calendar.to)}.
          </p>
        ) : (
          <p className="text-sm text-ink-2">No hay un calendario cargado.</p>
        )}
        <p className="text-[13px] text-muted">
          Se carga una vez por año desde el PDF de la FIUBA, con una migración (ver data/calendario/README.md).
        </p>
      </section>
    </main>
  );
}
