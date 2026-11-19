"use client";

import Link from "next/link";
import { useRef, useState, useSyncExternalStore } from "react";
import { NavIcon } from "@/components/icons";
import {
  enrollmentStatus,
  formatEnrollMoment,
  formatExamDay,
  formatExamTime,
  formatTeachers,
  searchSubjects,
  type ExamSubjectView,
  type ExamTableView,
  type FinalsData,
} from "@/lib/exams/types";
import type { ReminderMailState } from "@/lib/reminders/mail";
import type { ExamReminderView } from "@/lib/reminders/model";
import { ConfirmationText } from "./ReminderMail";
import { RemindersDialog, type SavedNotice } from "./RemindersDialog";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// "Tus finales pendientes" abierto o cerrado, recordado por dispositivo (abierto la primera vez).
// localStorage puede no estar (modo privado, datos bloqueados): entonces vale mientras la página siga abierta.
const MINE_KEY = "finales-pendientes";
let mineMemory: boolean | null = null;
const mineListeners = new Set<() => void>();

function readMineOpen(): boolean {
  if (mineMemory !== null) return mineMemory;
  try {
    return localStorage.getItem(MINE_KEY) !== "cerrado";
  } catch {
    return true;
  }
}

function saveMineOpen(open: boolean) {
  mineMemory = open;
  try {
    localStorage.setItem(MINE_KEY, open ? "abierto" : "cerrado");
  } catch {
    // Sin localStorage queda en memoria.
  }
  mineListeners.forEach((listener) => listener());
}

function subscribeMine(listener: () => void) {
  mineListeners.add(listener);
  return () => {
    mineListeners.delete(listener);
  };
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function EnrollmentChip({ table, now }: { table: ExamTableView; now: string }) {
  const status = enrollmentStatus(table, now);
  const chip =
    "rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold md:whitespace-nowrap";
  switch (status.kind) {
    case "open":
      return (
        <span className={`${chip} bg-mint text-mint-ink`}>
          Inscripción abierta hasta el {formatEnrollMoment(status.until)}
        </span>
      );
    case "soon":
      return (
        <span className={`${chip} bg-butter text-butter-ink`}>
          Inscripción desde el {formatEnrollMoment(status.from)}
        </span>
      );
    case "closed":
      return (
        <span className="text-[12.5px] whitespace-nowrap text-muted">
          Inscripción cerrada
        </span>
      );
    default:
      return null;
  }
}

/** Room, examiners and drop deadline, when the dates were loaded with the SIU link. */
function tableDetails(t: ExamTableView): string {
  const room = t.room && (/^aula\b/i.test(t.room) ? t.room : `Aula ${t.room}`);
  const drop =
    t.dropUntil &&
    `Te podés dar de baja hasta el ${formatEnrollMoment(t.dropUntil)}`;
  return [room, formatTeachers(t.teachers), drop].filter(Boolean).join(" · ");
}

function TableRow({
  table,
  now,
  timed,
}: {
  table: ExamTableView;
  now: string;
  timed: boolean;
}) {
  const time = formatExamTime(table.startTime, table.endTime);
  const details = tableDetails(table);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 md:gap-x-4 md:px-[22px]">
      <span
        className={`${timed ? "w-auto md:w-[184px]" : "w-[68px] md:w-[76px]"} flex-none text-sm text-ink-2 tabular-nums`}
      >
        <span className="font-semibold">{formatExamDay(table.date)}</span>
        {time && <span> · {time}</span>}
      </span>
      <span className="flex min-w-0 flex-auto flex-col">
        <span className="text-sm text-ink-2">
          {table.name}
          {table.kind !== "Regular" && (
            <span className="text-[13px] text-muted"> · {table.kind}</span>
          )}
        </span>
        {details && <span className="text-[12.5px] text-muted">{details}</span>}
      </span>
      <EnrollmentChip table={table} now={now} />
    </div>
  );
}

export function FinalsView({
  data,
  reminderMail,
}: {
  data: FinalsData;
  /** Where the reminder mails go; null while the database does not have it (previews). */
  reminderMail: ReminderMailState | null;
}) {
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const titleRow = useRef<HTMLDivElement>(null);
  const searching = query.trim() !== "";
  const mineOpen = useSyncExternalStore(subscribeMine, readMineOpen, () => true);
  const { now, pending, all } = data;
  const [reminders, setReminders] = useState<ExamReminderView[] | null>(
    data.reminders,
  );
  const [remindOpen, setRemindOpen] = useState(false);
  const [notice, setNotice] = useState<SavedNotice | null>(null);
  const [mail, setMail] = useState<ReminderMailState | null>(reminderMail);
  const remindButton = useRef<HTMLButtonElement>(null);
  const activeReminders =
    reminders?.filter((r) => r.planId === data.planId).length ?? 0;

  const open = pending.flatMap((s) => {
    const table = s.tables.find(
      (t) => enrollmentStatus(t, now).kind === "open",
    );
    return table?.enrollTo ? [{ name: s.name, until: table.enrollTo }] : [];
  });
  const shown = searchSubjects(all, query);
  const pendingKeys = new Set(pending.map((s) => s.key));
  // Dates loaded with the SIU link have times: the date column makes room for them.
  const timed = all.some((s) => s.tables.some((t) => t.startTime));

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-4 px-4 pt-5 pb-8 md:gap-[18px] md:px-6 md:pt-8 md:pb-14">
      <div
        ref={titleRow}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <h1 className="text-[26px] font-semibold tracking-[-0.01em] md:text-[32px]">
          Finales
        </h1>
        {data.loaded && reminders !== null && (
          <>
            <button
              ref={remindButton}
              onClick={() => {
                setNotice(null);
                setRemindOpen(true);
              }}
              aria-haspopup="dialog"
              aria-describedby="recordarme-pista"
              className="flex h-10 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13.5px] font-semibold whitespace-nowrap text-ink"
            >
              <NavIcon name="bell" size={17} />
              {/* Al entrar a Finales el botón se estira con la pregunta y se vuelve a cerrar en "Recordarme". */}
              <span
                aria-hidden="true"
                className="max-w-0 overflow-hidden opacity-0 motion-safe:animate-[remind-ask_5s_ease-in-out_0.5s_both]"
              >
                <span className="pl-1.5">
                  ¿Te avisamos por mail cuando abre la inscripción?
                </span>
              </span>
              <span className="overflow-hidden motion-safe:animate-[remind-label_5s_ease-in-out_0.5s_both]">
                <span className="pl-1.5">Recordarme</span>
                {activeReminders > 0 && (
                  <span className="text-muted">
                    {" "}
                    · {activeReminders}
                    <span className="sr-only">
                      {" "}
                      {activeReminders === 1 ? "mesa" : "mesas"}
                    </span>
                  </span>
                )}
              </span>
            </button>
            <p id="recordarme-pista" className="sr-only">
              Te mandamos un mail cuando abre y cuando cierra la inscripción a
              las mesas que elijas.
            </p>
          </>
        )}
      </div>

      {/* Always rendered, out of the flow, so screen readers announce the notice. */}
      <p role="status" className="sr-only">
        {notice?.text}
        {notice?.confirmation && (
          <>
            {" "}
            <ConfirmationText confirmation={notice.confirmation} />
          </>
        )}
      </p>
      {notice && (
        <div
          aria-hidden="true"
          className="rounded-[14px] bg-mint px-4 py-3.5 text-mint-ink md:px-[18px]"
        >
          {notice.text}
          {/* The confirmation mail: so the student finds it now and marks it as not spam. */}
          {notice.confirmation && (
            <p className="mt-1.5 text-[14px]">
              <ConfirmationText confirmation={notice.confirmation} />
            </p>
          )}
        </div>
      )}

      {remindOpen && reminders !== null && (
        <RemindersDialog
          data={data}
          reminders={reminders}
          mail={mail}
          onMailChange={setMail}
          onSaved={(saved, saidNotice) => {
            setReminders(saved);
            if (saidNotice) setNotice(saidNotice);
          }}
          onClose={() => {
            setRemindOpen(false);
            remindButton.current?.focus();
          }}
        />
      )}

      {!data.loaded && (
        <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">
          Todavía no se cargaron las fechas de examen de tu plan.
        </div>
      )}

      {data.loaded && (
        <>
          {/* El buscador va arriba de todo y queda pegado al borde de arriba al bajar (sobre todo en el
              celular): se busca cualquier materia sin pasar por la lista de pendientes. */}
          <search className="sticky top-0 z-20 -mx-4 -my-2 bg-bg px-4 py-2 md:-mx-6 md:px-6">
            <div className="relative">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="pointer-events-none absolute top-[15px] left-4 text-muted"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <label htmlFor="q" className="sr-only">
                Buscar mesas de cualquier materia
              </label>
              <input
                ref={searchInput}
                id="q"
                type="search"
                value={query}
                onChange={(e) => {
                  // Si se empieza a buscar con la página bajada, se sube hasta el buscador para ver los resultados.
                  const top = titleRow.current?.getBoundingClientRect().bottom;
                  if (!searching && top !== undefined && top < 0) {
                    window.scrollBy({ top });
                  }
                  setQuery(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && query) {
                    e.preventDefault();
                    setQuery("");
                  }
                }}
                autoComplete="off"
                enterKeyHint="search"
                placeholder="Buscá cualquier materia"
                className="h-[50px] w-full rounded-xl border border-line-strong bg-surface pr-12 pl-[46px] text-base text-ink [&::-webkit-search-cancel-button]:appearance-none"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Borrar la búsqueda"
                  onClick={() => {
                    setQuery("");
                    searchInput.current?.focus();
                  }}
                  className="absolute top-[3px] right-[3px] flex size-11 items-center justify-center rounded-[10px] text-muted hover:text-ink"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          </search>

          {/* Siempre en la página, para que el lector de pantalla diga cuántas materias encontró. */}
          <p
            role="status"
            className={searching ? "-mb-1.5 px-1 text-[13.5px] text-muted" : "sr-only"}
          >
            {searching &&
              (shown.length > 0
                ? plural(shown.length, "materia con mesas", "materias con mesas")
                : "Ninguna materia con mesas coincide con la búsqueda.")}
          </p>

          {/* Mientras se busca, los pendientes se hacen a un lado y los resultados quedan bajo el buscador. */}
          {!searching && open.length > 0 && (
            <div className="rounded-[14px] bg-mint px-4 py-3.5 text-mint-ink md:px-[18px]">
              <b>Inscripción abierta:</b>{" "}
              {open
                .slice(0, 3)
                .map((o) => `${o.name} hasta el ${formatEnrollMoment(o.until)}`)
                .join(" · ")}
              {open.length > 3 && ` y ${open.length - 3} más`}
            </div>
          )}

          {!searching && (
            <section
              aria-labelledby="pending-title"
              className="overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <h2 id="pending-title">
                <button
                  type="button"
                  aria-expanded={mineOpen}
                  aria-controls="pending-list"
                  onClick={() => saveMineOpen(!mineOpen)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:px-[22px]"
                >
                  <span className="text-[19px] font-semibold">
                    Tus finales pendientes
                  </span>{" "}
                  <span className="flex flex-none items-center gap-2 text-[13px] font-normal text-muted">
                    {pending.length > 0 &&
                      plural(pending.length, "materia", "materias")}
                    <Chevron open={mineOpen} />
                  </span>
                </button>
              </h2>
              {/* Se pliega con una transición corta de alto (nada con "reducir movimiento"); cerrado queda inerte. */}
              <div
                id="pending-list"
                inert={!mineOpen}
                className={`grid motion-safe:transition-[grid-template-rows] motion-safe:duration-200 motion-safe:ease-out ${mineOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="min-h-0 overflow-hidden">
                  {pending.length === 0 ? (
                    <div className="px-4 pb-4 text-sm text-muted md:px-[22px]">
                      No tenés finales pendientes en tu mapa.{" "}
                      <Link
                        href="/mapa"
                        className="font-semibold text-ink-2 underline"
                      >
                        Ir al mapa
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col pb-2">
                      {pending.map((s) => (
                        <div
                          key={s.key}
                          className="border-t border-line first:border-t-0"
                        >
                          <h3 className="px-4 pt-3 pb-1 text-[15px] font-semibold md:px-[22px]">
                            {s.name}
                          </h3>
                          {s.tables.length === 0 ? (
                            <div className="px-4 pb-3 md:px-[22px] text-[13px] text-muted">
                              Sin mesas cargadas.
                            </div>
                          ) : (
                            s.tables
                              .slice(0, 3)
                              .map((t) => (
                                <TableRow
                                  key={t.id}
                                  table={t}
                                  now={now}
                                  timed={timed}
                                />
                              ))
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {!searching && (
            <h2 className="mt-2 text-[22px] font-semibold">Todas las mesas</h2>
          )}

          {!searching && shown.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">
              No hay mesas próximas cargadas.
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {shown.map((s: ExamSubjectView) => (
              <section
                key={s.key}
                aria-label={s.name}
                className="overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 bg-lavender px-4 py-3 md:px-[22px] md:py-3.5">
                  <h3 className="text-[17px] leading-snug md:text-[19px] font-semibold text-lavender-ink">
                    {s.name}
                  </h3>
                  <span className="text-[13px] whitespace-nowrap text-lavender-ink/80">
                    {/* Al buscar no se ven los pendientes: se marca si la materia es uno de ellos. */}
                    {searching && pendingKeys.has(s.key) && (
                      <span className="mr-2 rounded-full bg-surface px-2 py-0.5 text-[12px] font-semibold text-lavender-ink">
                        Pendiente
                      </span>
                    )}
                    {plural(s.tables.length, "mesa", "mesas")}
                  </span>
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
