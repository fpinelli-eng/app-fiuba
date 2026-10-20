"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  discardOffer,
  linkSiuSubject,
  processOffer,
  publishOffer,
  setCurrentTerm,
  setOfferingVisible,
  setReviewsDate,
  type ActionState,
} from "./actions";

const initial: ActionState = { error: null };

const primary =
  "h-10 whitespace-nowrap rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink";
const secondary =
  "h-10 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:text-disabled-ink";
const input = "h-[42px] rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-ink";

function ErrorText({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
      {state.error}
    </p>
  );
}

/** Cuatrimestre actual: se crea si no existe. */
export function TermForm({ year, half, cta }: { year: number; half: 1 | 2; cta: string }) {
  const [state, action, pending] = useActionState(setCurrentTerm, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="sr-only" htmlFor="term-half">
          Cuatrimestre
        </label>
        <select id="term-half" name="half" defaultValue={half} className={input}>
          <option value={1}>1.er cuatrimestre</option>
          <option value={2}>2.º cuatrimestre</option>
        </select>
        <label className="sr-only" htmlFor="term-year">
          Año
        </label>
        <input id="term-year" name="year" type="number" min={2020} max={2100} defaultValue={year} className={`${input} w-28`} />
        <button type="submit" disabled={pending} className={primary}>
          {pending ? "Guardando…" : cta}
        </button>
      </div>
      <ErrorText state={state} />
    </form>
  );
}

export function ReviewsDateForm({ date }: { date: string | null }) {
  const [state, action, pending] = useActionState(setReviewsDate, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <label className="flex items-center gap-2.5 text-sm text-muted">
        Reseñas pendientes desde
        <input name="date" type="date" defaultValue={date ?? ""} className={input} />
        <button type="submit" disabled={pending} className={secondary}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </label>
      <ErrorText state={state} />
    </form>
  );
}

/** Plan sin cargar: pegar el texto del SIU y procesarlo. */
export function ProcessForm({ planId, title }: { planId: string; title: string }) {
  const [state, action, pending] = useActionState(processOffer, initial);
  const [text, setText] = useState("");
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface px-6 py-[22px]">
      <h2 className="text-[19px] font-semibold">{title}</h2>
      <input type="hidden" name="planId" value={planId} />
      <label htmlFor="siu-text" className="sr-only">
        Texto copiado del SIU
      </label>
      <textarea
        id="siu-text"
        name="text"
        rows={16}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pegá acá el texto de la página de horarios del SIU para esta carrera y plan"
        className="w-full resize-y rounded-xl border border-line-strong bg-bg px-3.5 py-3 text-[13px] leading-normal text-ink"
      />
      <ErrorText state={state} />
      <div className="flex justify-end">
        <button type="submit" disabled={pending || !text.trim()} className={primary}>
          {pending ? "Procesando…" : "Procesar"}
        </button>
      </div>
    </form>
  );
}

function PlanAction({
  planId,
  run,
  className,
  label,
  pendingLabel,
}: {
  planId: string;
  run: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  className: string;
  label: ReactNode;
  pendingLabel: string;
}) {
  const [state, action, pending] = useActionState(run, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="planId" value={planId} />
      <button type="submit" disabled={pending} className={className}>
        {pending ? pendingLabel : label}
      </button>
      <ErrorText state={state} />
    </form>
  );
}

export function DiscardButton({ planId }: { planId: string }) {
  return <PlanAction planId={planId} run={discardOffer} className={secondary} label="Descartar" pendingLabel="Descartando…" />;
}

export function PublishButton({ planId, label = "Publicar" }: { planId: string; label?: string }) {
  return (
    <PlanAction
      planId={planId}
      run={publishOffer}
      className={`${primary} h-[46px] px-[22px] text-[15px]`}
      label={label}
      pendingLabel="Publicando…"
    />
  );
}

/** Plan publicado: pegar un texto nuevo del SIU para reemplazar la oferta. */
export function ReplacePanel({ planId, title }: { planId: string; title: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={secondary}>
        Reemplazar con otro texto
      </button>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2">
      <ProcessForm planId={planId} title={`Reemplazar · ${title}`} />
      <div className="flex justify-end">
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** "Quitar" / "Volver a mostrar" un curso de la oferta publicada. */
export function VisibilityButton({ offeringId, visible }: { offeringId: number; visible: boolean }) {
  const [state, action, pending] = useActionState(setOfferingVisible, initial);
  return (
    <form action={action} className="flex flex-col items-end">
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="visible" value={visible ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className={`text-[13px] font-semibold whitespace-nowrap ${visible ? "text-danger" : "text-accent"} disabled:text-disabled-ink`}
      >
        {pending ? "…" : visible ? "Quitar" : "Volver a mostrar"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}

/** "Materias que no están en el plan": decir a qué materia del plan corresponde. */
export function LinkSubjectForm({
  planId,
  siuCode,
  siuName,
  options,
}: {
  planId: string;
  siuCode: string;
  siuName: string;
  options: { id: number; name: string }[];
}) {
  const [state, action, pending] = useActionState(linkSiuSubject, initial);
  const [subjectId, setSubjectId] = useState("");
  const id = `link-${siuCode}`;
  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="planId" value={planId} />
      <input type="hidden" name="siuCode" value={siuCode} />
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          ¿A qué materia del plan corresponde {siuName}?
        </label>
        <select
          id={id}
          name="subjectId"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          className="h-9 max-w-[260px] rounded-[9px] border border-line-strong bg-surface px-2 text-[13px] text-ink"
        >
          <option value="">No se muestra</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              Es {o.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !subjectId}
          className="h-9 rounded-[9px] border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink disabled:cursor-not-allowed disabled:text-disabled-ink"
        >
          {pending ? "…" : "Emparejar"}
        </button>
      </div>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
