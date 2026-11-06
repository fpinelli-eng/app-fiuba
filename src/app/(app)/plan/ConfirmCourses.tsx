"use client";

import { useEffect, useRef, useState } from "react";
import { describeSchedule } from "@/lib/plan/format";
import { sameCourses } from "@/lib/plan/cursada";
import type { Entry, OptionKey, PlanSubject } from "@/lib/plan/data";

// "Confirmar mi cursada": después de inscribirse en el SIU, el alumno deja acá los cursos en
// los que realmente quedó (por los cupos, pueden no ser los de la Opción A ni la B). Eso pasa al
// Inicio y al mapa. Las opciones A y B no se tocan: siguen siendo sus borradores.
// <dialog> nativo: en el celular sube desde abajo; desde md, al centro.

export function ConfirmCourses({
  initial,
  subjects,
  options,
  term,
  confirmed,
  onSave,
  onClose,
}: {
  initial: Entry[];
  subjects: PlanSubject[];
  options: Record<OptionKey, Entry[]>;
  term: string | null;
  /** Courses confirmed before (empty if never). */
  confirmed: string[];
  onSave: (entries: Entry[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entries, setEntries] = useState<Entry[]>(initial);
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const byCode = new Map(subjects.map((s) => [s.code, s]));
  const rows = entries.flatMap((e) => {
    const subject = byCode.get(e.subject);
    return subject ? [{ entry: e, subject }] : [];
  });
  const missing = rows.filter((r) => !r.subject.courses.some((c) => c.id === r.entry.course));
  const credits = rows.reduce((a, r) => a + (r.subject.credits ?? 0), 0);
  const left = subjects.filter((s) => !entries.some((e) => e.subject === s.code));
  const ids = rows.map((r) => r.entry.course);
  const unchanged = confirmed.length > 0 && sameCourses(ids, confirmed);
  const canSave = state !== "saving" && missing.length === 0 && (rows.length > 0 || confirmed.length > 0) && !unchanged;

  const setCourse = (subject: string, course: string) =>
    setEntries(entries.map((e) => (e.subject === subject ? { subject, course } : e)));
  const add = (code: string) => {
    const subject = byCode.get(code);
    if (subject) setEntries([...entries, { subject: code, course: subject.courses.length === 1 ? subject.courses[0].id : "" }]);
  };
  const save = async () => {
    setState("saving");
    const ok = await onSave(rows.map((r) => r.entry)).catch(() => false);
    if (ok) dialog.current?.close();
    else setState("error");
  };

  const fromOptions = (["A", "B"] as const).filter(
    (k) => options[k].length > 0 && !sameCourses(options[k].map((e) => e.course), entries.map((e) => e.course)),
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="confirmar-cursada-titulo"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) dialog.current?.close();
      }}
      className="inset-x-0 mx-0 mt-auto mb-0 max-h-[88dvh] w-full max-w-full flex-col rounded-t-[20px] border-0 bg-surface p-0 text-ink transition-transform duration-200 backdrop:bg-pop-shadow open:flex starting:open:translate-y-full md:mx-auto md:my-auto md:max-h-[80dvh] md:w-[600px] md:rounded-[20px] md:starting:open:translate-y-4"
    >
      <div className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-line-strong md:hidden" aria-hidden="true" />
      <div className="flex flex-none items-start gap-3 border-b border-line px-4 pt-2 pb-3 md:px-6 md:pt-5 md:pb-4">
        <div className="min-w-0 flex-auto">
          <h2 id="confirmar-cursada-titulo" className="text-[19px] leading-tight font-semibold">
            Tu cursada{term ? ` del ${term}` : ""}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-muted">Elegí el curso en el que quedaste en cada materia.</p>
        </div>
        <button
          onClick={() => dialog.current?.close()}
          aria-label="Cerrar"
          className="-mt-1 -mr-2 grid size-10 flex-none place-items-center rounded-full text-muted hover:text-ink"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 md:px-6 md:py-4">
        {fromOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">
            Copiar
            {fromOptions.map((k) => (
              <button
                key={k}
                onClick={() => setEntries(options[k].map((e) => ({ ...e })))}
                className="h-10 rounded-full border border-line-strong px-3.5 text-[13.5px] font-semibold text-ink md:h-8"
              >
                Opción {k}
              </button>
            ))}
          </div>
        )}

        {rows.length === 0 ? (
          <p className="rounded-xl bg-bg px-4 py-5 text-center text-[14px] text-muted">
            {confirmed.length ? "Sin materias: tu Inicio queda sin horarios." : "Agregá las materias que cursás."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map(({ entry, subject }) => {
              const id = `curso-${subject.code}`;
              const unpicked = !subject.courses.some((c) => c.id === entry.course);
              return (
                <li key={subject.code} className="flex flex-col gap-2 rounded-xl bg-bg p-3">
                  <div className="flex items-start justify-between gap-3">
                    <label htmlFor={id} className="text-[14.5px] leading-tight font-semibold">
                      {subject.name}
                      {subject.credits !== null && <span className="ml-1.5 text-xs font-medium text-muted">{subject.credits} C</span>}
                    </label>
                    <button
                      onClick={() => setEntries(entries.filter((e) => e.subject !== subject.code))}
                      aria-label={`Quitar ${subject.name}`}
                      className="-my-1 h-10 flex-none rounded-lg px-2.5 text-[13px] text-muted hover:text-ink md:h-8"
                    >
                      Quitar
                    </button>
                  </div>
                  <select
                    id={id}
                    value={entry.course}
                    onChange={(e) => setCourse(subject.code, e.target.value)}
                    aria-invalid={unpicked || undefined}
                    className={`h-11 w-full min-w-0 rounded-[10px] border bg-surface px-2.5 text-base text-ink outline-none focus:border-accent md:h-10 md:text-sm ${
                      unpicked ? "border-danger" : "border-line-strong"
                    }`}
                  >
                    {unpicked && (
                      <option value="" disabled>
                        Elegí el curso
                      </option>
                    )}
                    {subject.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {[c.label, c.teacherList, describeSchedule(c.blocks)].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}

        {left.length > 0 && (
          <div>
            <label htmlFor="agregar-materia" className="sr-only">
              Agregar materia
            </label>
            <select
              id="agregar-materia"
              value=""
              onChange={(e) => add(e.target.value)}
              className="h-11 w-full min-w-0 rounded-[10px] border border-dashed border-line-strong bg-surface px-2.5 text-base text-ink-2 outline-none focus:border-accent md:h-10 md:text-sm"
            >
              <option value="" disabled>
                + Agregar materia
              </option>
              {left.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-line px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-6 md:pb-4">
        <div className="mr-auto text-[13px] text-muted" aria-live="polite">
          {state === "error" ? (
            <span className="text-danger">No pudimos guardar tu cursada. Probá de nuevo.</span>
          ) : missing.length > 0 ? (
            `Falta elegir el curso de ${missing.length === 1 ? "una materia" : `${missing.length} materias`}`
          ) : (
            rows.length > 0 && (
              <>
                <b className="text-ink">{rows.length}</b> {rows.length === 1 ? "materia" : "materias"} · <b className="text-ink">{credits}</b> C
              </>
            )
          )}
        </div>
        <button
          onClick={() => dialog.current?.close()}
          className="h-11 rounded-[10px] border border-line bg-surface px-4 text-[14px] text-muted hover:text-ink md:h-10"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!canSave}
          className="h-11 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink md:h-10"
        >
          {state === "saving" ? "Guardando…" : "Confirmar cursada"}
        </button>
      </div>
    </dialog>
  );
}
