"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkHistory,
  countFailedExams,
  importItems,
  interpretHistory,
  matchToPlan,
  parseHistoriaAcademica,
  sameCareer,
  summaryText,
  upsertRows,
  type ImportItem,
  type SubjectOutcome,
} from "@/lib/map/history";
import { PdfReadError, readPdfLines } from "@/lib/map/history-pdf";
import { STATE_LABEL, approvedLabel, gradeMark, type Subject, type SubjectProgress, type SubjectStatus } from "@/lib/map/model";
import { StateIcon } from "./icons";

// Mapa → "Cargar desde el SIU (PDF)": el alumno elige el PDF de su Historia académica, se lee en
// su dispositivo (PDF.js, nunca se sube), ve qué encontramos y confirma. Se guarda con un solo upsert
// en user_subjects (las mismas políticas que la ficha) y, si quiere, los aplazos en profiles.
// La lógica pura está en src/lib/map/history.ts.

interface Props {
  supabase: SupabaseClient;
  userId: string;
  /** Carrera del plan del alumno: "Ingeniería Industrial". */
  careerName: string;
  subjects: Subject[];
  siuCodes: { subjectId: number; code: string }[];
  current: Map<number, SubjectProgress>;
  /** La base ya tiene user_subjects.by_equivalence. */
  canEquivalence: boolean;
  failedFinals: number;
  /** Se guardó: el mapa aplica los cambios (y los aplazos, si se cargaron). */
  onImported: (changes: { subjectId: number; next: SubjectProgress }[], failedFinals: number | null) => void;
  onClose: () => void;
}

type Preview = {
  career: string | null;
  careerOk: boolean;
  warnings: string[];
  items: ImportItem[];
  unmatched: SubjectOutcome[];
  failedExams: number;
};

type Step =
  | { kind: "pick"; error?: string }
  | { kind: "reading" }
  | { kind: "preview"; preview: Preview }
  | { kind: "done"; count: number; failedFinals: number | null; error?: string };

const MAX_BYTES = 10 * 1024 * 1024;
const BATCH = 200;

const GROUPS: { status: SubjectStatus; title: string }[] = [
  { status: "approved", title: "Aprobadas" },
  { status: "final_pending", title: "Finales pendientes" },
  { status: "in_progress", title: "Cursando" },
];

function progressText(p: SubjectProgress): string {
  return p.status === "approved" ? approvedLabel(gradeMark(p)) : STATE_LABEL[p.status];
}

export function HistoryImport(props: Props) {
  const { supabase, userId, careerName, subjects, siuCodes, current, canEquivalence, failedFinals } = props;
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [overwrite, setOverwrite] = useState(true);
  const [withFailed, setWithFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const inputId = useId();

  // Foco adentro mientras está abierto; al cerrar, vuelve al botón que lo abrió.
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  // Sin la columna by_equivalence, una aprobada sin nota no se puede guardar.
  const savable = (i: ImportItem) => i.change !== "same" && (canEquivalence || !i.next.equivalence);

  async function read(file: File | undefined) {
    if (!file) return;
    if (file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      return setStep({ kind: "pick", error: "Elegí un archivo PDF." });
    }
    if (file.size > MAX_BYTES) return setStep({ kind: "pick", error: "El archivo es demasiado grande para ser la Historia académica." });
    setStep({ kind: "reading" });
    let lines: string[];
    try {
      lines = await readPdfLines(await file.arrayBuffer());
    } catch (e) {
      return setStep({
        kind: "pick",
        error: e instanceof PdfReadError ? "No pudimos abrir el PDF. Descargalo de nuevo del SIU y probá otra vez." : "No pudimos leer el PDF. Probá de nuevo.",
      });
    }
    const parsed = parseHistoriaAcademica(lines);
    const check = checkHistory(parsed);
    if (!check.ok) return setStep({ kind: "pick", error: check.error });

    const { matched, unmatched } = matchToPlan(interpretHistory(parsed.rows), subjects, siuCodes);
    const items = importItems(matched, current).sort((a, b) => a.subject.name.localeCompare(b.subject.name, "es"));
    const failedExams = countFailedExams(parsed.rows);
    setSelected(new Set(items.filter(savable).map((i) => i.subject.id)));
    setOverwrite(true);
    setWithFailed(failedExams > 0 && failedFinals === 0);
    setStep({
      kind: "preview",
      preview: { career: parsed.career, careerOk: sameCareer(parsed.career, careerName), warnings: check.warnings, items, unmatched, failedExams },
    });
  }

  function toggle(id: number, on: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleOverwrite(items: ImportItem[], on: boolean) {
    setOverwrite(on);
    setSelected((s) => {
      const next = new Set(s);
      for (const i of items) {
        if (i.change !== "different" || !savable(i)) continue;
        if (on) next.add(i.subject.id);
        else next.delete(i.subject.id);
      }
      return next;
    });
  }

  async function save(preview: Preview) {
    const chosen = preview.items.filter((i) => savable(i) && selected.has(i.subject.id));
    const failed = withFailed && preview.failedExams !== failedFinals ? Math.min(99, preview.failedExams) : null;
    setSaving(true);
    const done: ImportItem[] = [];
    let error: string | undefined;
    // Un solo pedido para una historia normal; en tandas si fuera muy larga.
    for (let i = 0; i < chosen.length; i += BATCH) {
      const batch = chosen.slice(i, i + BATCH);
      const res = await supabase.from("user_subjects").upsert(upsertRows(userId, batch, canEquivalence), { onConflict: "user_id,subject_id" });
      if (res.error) {
        error = done.length ? `Cargamos ${done.length} de ${chosen.length} materias. Probá de nuevo para el resto.` : "No pudimos guardar las materias. Probá de nuevo.";
        break;
      }
      done.push(...batch);
    }
    let savedFailed: number | null = null;
    if (!error && failed !== null) {
      const res = await supabase.from("profiles").update({ failed_finals: failed }).eq("id", userId);
      if (res.error) error = "Cargamos las materias, pero no los aplazos. Podés sumarlos en Créditos extras.";
      else savedFailed = failed;
    }
    setSaving(false);
    if (done.length || savedFailed !== null) {
      props.onImported(
        done.map((i) => ({ subjectId: i.subject.id, next: i.next })),
        savedFailed,
      );
    }
    if (error && !done.length && savedFailed === null) {
      setSaveError(error);
      return;
    }
    setStep({ kind: "done", count: done.length, failedFinals: savedFailed, error });
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void read(e.dataTransfer.files[0]);
  };

  const button = "inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-4 text-[15px] font-semibold";
  const primary = "inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] bg-accent px-5 text-[15px] font-semibold text-on-accent disabled:bg-disabled disabled:text-disabled-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 md:items-center md:p-6" onClick={saving ? undefined : props.onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="siu-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && !saving && props.onClose()}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-[22px] bg-bg outline-none md:max-w-[560px] md:rounded-[22px]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
          <h2 id="siu-title" className="text-[22px] leading-tight font-semibold">
            Cargar desde el SIU
          </h2>
          <button type="button" onClick={props.onClose} disabled={saving} className={button}>
            Cerrar
          </button>
        </div>

        <div className={`flex min-h-0 flex-col gap-4 overflow-y-auto px-5 ${step.kind === "preview" && step.preview.careerOk ? "" : "pb-[max(20px,env(safe-area-inset-bottom))]"}`}>
          {(step.kind === "pick" || step.kind === "reading") && (
            <>
              <p className="text-[17px] leading-snug">
                Subí el PDF de tu <strong className="font-semibold">Historia académica completa</strong> del SIU (no otro certificado).
              </p>
              <ol className="flex list-decimal flex-col gap-1 rounded-2xl border border-line bg-surface py-3.5 pr-4 pl-9 text-sm text-ink-2 marker:font-semibold marker:text-muted">
                <li>Entrá al SIU Guaraní con tu usuario.</li>
                <li>
                  Andá a <span className="font-semibold text-ink">Reportes → Historia académica</span>.
                </li>
                <li>Dejá la lista completa, sin filtros, y descargala en PDF.</li>
              </ol>

              {step.kind === "pick" && step.error && (
                <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
                  {step.error}
                </p>
              )}

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center gap-2.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center ${dragging ? "border-accent bg-accent-soft" : "border-line-strong"}`}
              >
                {step.kind === "reading" ? (
                  <p role="status" className="flex h-11 items-center gap-2.5 font-semibold">
                    <Spinner />
                    Leyendo el PDF…
                  </p>
                ) : (
                  <>
                    <input
                      id={inputId}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="peer sr-only"
                      onChange={(e) => {
                        void read(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                    <label htmlFor={inputId} className={`${primary} cursor-pointer peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent`}>
                      Elegir el PDF
                    </label>
                    <span className="hidden text-sm text-muted md:block">o arrastralo acá</span>
                  </>
                )}
              </div>
              <p className="flex items-start gap-2 text-[13px] text-muted">
                <LockIcon />
                El PDF se lee en tu dispositivo: no lo subimos ni lo guardamos. Solo se guardan las materias que confirmes.
              </p>
            </>
          )}

          {step.kind === "preview" && (
            <PreviewStep
              preview={step.preview}
              careerName={careerName}
              selected={selected}
              savable={savable}
              overwrite={overwrite}
              withFailed={withFailed}
              failedFinals={failedFinals}
              saving={saving}
              saveError={saveError}
              primary={primary}
              button={button}
              onToggle={toggle}
              onOverwrite={(on) => toggleOverwrite(step.preview.items, on)}
              onWithFailed={setWithFailed}
              onAnother={() => {
                setSaveError(null);
                setStep({ kind: "pick" });
              }}
              onSave={() => {
                setSaveError(null);
                void save(step.preview);
              }}
            />
          )}

          {step.kind === "done" && (
            <>
              <p role="status" className="text-[17px] leading-snug">
                {step.count > 0 ? (
                  <>
                    Listo: cargamos <strong className="font-semibold">{step.count === 1 ? "1 materia" : `${step.count} materias`}</strong> en tu mapa
                    {step.failedFinals !== null && <> y {step.failedFinals === 1 ? "1 aplazo" : `${step.failedFinals} aplazos`}</>}.
                  </>
                ) : step.failedFinals !== null ? (
                  <>Listo: cargamos {step.failedFinals === 1 ? "1 aplazo" : `${step.failedFinals} aplazos`}.</>
                ) : (
                  <>No había cambios para cargar.</>
                )}
              </p>
              {step.error && (
                <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
                  {step.error}
                </p>
              )}
              <button type="button" onClick={props.onClose} className={`${primary} self-start`}>
                Ver mi mapa
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewStep(props: {
  preview: Preview;
  careerName: string;
  selected: Set<number>;
  savable: (i: ImportItem) => boolean;
  overwrite: boolean;
  withFailed: boolean;
  failedFinals: number;
  saving: boolean;
  saveError: string | null;
  primary: string;
  button: string;
  onToggle: (id: number, on: boolean) => void;
  onOverwrite: (on: boolean) => void;
  onWithFailed: (on: boolean) => void;
  onAnother: () => void;
  onSave: () => void;
}) {
  const { preview, careerName, selected, savable, overwrite, withFailed, failedFinals, saving, primary, button } = props;
  const { items, unmatched } = preview;
  const count = (s: SubjectStatus) => items.filter((i) => i.next.status === s).length;
  const different = items.filter((i) => i.change === "different" && savable(i));
  const chosen = items.filter((i) => savable(i) && selected.has(i.subject.id)).length;
  const failedChange = preview.failedExams > 0 && preview.failedExams !== failedFinals;
  const nothing = chosen === 0 && !(withFailed && failedChange);

  if (!preview.careerOk) {
    return (
      <>
        <p role="alert" className="rounded-xl bg-peach px-4 py-3 text-sm text-peach-ink">
          {preview.career ? (
            <>
              Esta Historia académica es de <strong className="font-semibold">{preview.career}</strong> y tu plan es de{" "}
              <strong className="font-semibold">{careerName}</strong>.
            </>
          ) : (
            <>No encontramos la carrera en este PDF.</>
          )}{" "}
          No cargamos nada. Si te cambiaste de carrera, cambiala primero desde Perfil.
        </p>
        <button type="button" onClick={props.onAnother} className={`${button} self-start`}>
          Elegir otro PDF
        </button>
      </>
    );
  }

  return (
    <>
      <p role="status" className="text-[17px] leading-snug font-semibold">
        {summaryText({ approved: count("approved"), finalPending: count("final_pending"), inProgress: count("in_progress"), unmatched: unmatched.length })}
      </p>

      {preview.warnings.map((w) => (
        <p key={w} className="rounded-xl border border-butter-line bg-butter px-4 py-2.5 text-sm text-butter-ink">
          {w}
        </p>
      ))}

      {different.length > 0 && (
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <input type="checkbox" checked={overwrite} onChange={(e) => props.onOverwrite(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-sm">
            <span className="block font-semibold">
              Reemplazar {different.length === 1 ? "1 materia que marcaste distinto" : `${different.length} materias que marcaste distinto`}
            </span>
            <span className="text-muted">Usa lo del SIU. Lo que no está en el PDF no se toca.</span>
          </span>
        </label>
      )}

      {GROUPS.map(({ status, title }) => {
        const list = items.filter((i) => i.next.status === status);
        if (!list.length) return null;
        return (
          <fieldset key={status} className="flex flex-col">
            <legend className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted">
              <StateIcon state={status} size={13} />
              {title} · {list.length}
            </legend>
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {list.map((i) => (
                <ItemRow key={i.subject.id} item={i} canSave={savable(i)} on={selected.has(i.subject.id)} onToggle={props.onToggle} />
              ))}
            </ul>
          </fieldset>
        );
      })}

      {unmatched.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-semibold text-muted">No están en tu plan · no se cargan</p>
          <ul className="flex flex-col gap-0.5 rounded-2xl border border-line px-4 py-2.5 text-sm text-ink-2">
            {unmatched.map((u) => (
              <li key={`${u.code ?? ""}-${u.name}`} className="break-words">
                {u.name}
                {u.code && <span className="text-muted"> ({u.code})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {failedChange && (
        <label className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5">
          <input type="checkbox" checked={withFailed} onChange={(e) => props.onWithFailed(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-sm">
            <span className="block font-semibold">
              Cargar {preview.failedExams === 1 ? "1 aplazo" : `${preview.failedExams} aplazos`} (finales desaprobados)
            </span>
            {failedFinals > 0 && (
              <span className="text-muted">
                Ahora tenés {failedFinals} en Créditos extras; se reemplaza por {preview.failedExams}.
              </span>
            )}
          </span>
        </label>
      )}

      {props.saveError && (
        <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
          {props.saveError}
        </p>
      )}

      <div className="sticky bottom-0 -mx-5 mt-1 flex flex-wrap items-center justify-between gap-2.5 border-t border-line bg-bg px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={props.onAnother} disabled={saving} className={button}>
          Elegir otro PDF
        </button>
        <button type="button" onClick={props.onSave} disabled={saving || nothing} className={primary}>
          {saving ? (
            <span className="flex items-center gap-2">
              <Spinner /> Cargando…
            </span>
          ) : chosen > 0 ? (
            `Cargar ${chosen === 1 ? "1 materia" : `${chosen} materias`}`
          ) : (
            "Cargar"
          )}
        </button>
      </div>
    </>
  );
}

function ItemRow({ item, canSave, on, onToggle }: { item: ImportItem; canSave: boolean; on: boolean; onToggle: (id: number, on: boolean) => void }) {
  const mark = gradeMark(item.next);
  const note =
    item.change === "same"
      ? "Ya está así en tu mapa"
      : !canSave
        ? "Por equivalencia: todavía no se puede cargar"
        : item.change === "different" && item.current
          ? `En tu mapa: ${progressText(item.current)}`
          : null;
  return (
    <li className="border-t border-line first:border-t-0">
      <label className={`flex min-h-12 items-center gap-3 px-3.5 py-2.5 ${canSave ? "cursor-pointer" : "opacity-60"}`}>
        <input
          type="checkbox"
          checked={canSave && on}
          disabled={!canSave}
          onChange={(e) => onToggle(item.subject.id, e.target.checked)}
          className="size-5 shrink-0 accent-[var(--accent)]"
        />
        <span className="min-w-0 flex-auto">
          <span className="block text-[15px] leading-tight font-medium break-words">{item.subject.name}</span>
          {note && <span className="text-[13px] text-muted">{note}</span>}
        </span>
        {mark !== null && (
          <span className={`shrink-0 tabular-nums ${mark === "equivalence" ? "text-xs font-semibold" : "text-lg font-bold"}`}>
            {mark === "equivalence" ? "Equiv." : mark}
          </span>
        )}
      </label>
    </li>
  );
}

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin motion-reduce:animate-none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px shrink-0">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
