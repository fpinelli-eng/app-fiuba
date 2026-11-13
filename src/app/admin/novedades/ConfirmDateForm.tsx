"use client";

import { useActionState, useState } from "react";
import { formatDateRange, NOTE_MAX, TITLE_MAX, type AcademicEvent } from "@/lib/news/model";
import { confirmDate, type ConfirmState } from "./actions";

// Confirmar una fecha importante: se elige la fecha tentativa del calendario (o "Otra fecha"), los
// días reales y de dónde salen. En Novedades reemplaza a la tentativa.

const initial: ConfirmState = { error: null, saved: 0 };

const primary =
  "h-10 whitespace-nowrap rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink";
const field = "w-full rounded-[10px] border border-line-strong bg-bg px-3.5 text-sm text-ink";

export function ConfirmDateForm({ events }: { events: AcademicEvent[] }) {
  const [replaces, setReplaces] = useState("");
  const [title, setTitle] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [note, setNote] = useState("Mail de la Secretaría del ");
  const [state, action, pending] = useActionState(async (prev: ConfirmState, formData: FormData) => {
    const next = await confirmDate(prev, formData);
    if (!next.error) {
      setReplaces("");
      setTitle("");
      setStartsOn("");
      setEndsOn("");
    }
    return next;
  }, initial);

  const pick = (id: string) => {
    setReplaces(id);
    const e = events.find((x) => String(x.id) === id);
    setTitle(e ? e.title : "");
  };

  return (
    <form action={action} className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface px-6 py-[22px]">
      <div>
        <h2 className="text-[19px] font-semibold">Confirmar una fecha</h2>
        <p className="text-[13px] text-muted">Reemplaza la fecha tentativa del calendario en Novedades.</p>
      </div>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Fecha del calendario
        <select name="replaces" value={replaces} onChange={(e) => pick(e.target.value)} className={`${field} h-[42px]`}>
          <option value="">Otra fecha (no está en el calendario)</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title} · {formatDateRange({ ...e, tentative: true })}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        Trámite
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={`${field} h-[42px]`}
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Desde
          <input
            name="startsOn"
            type="date"
            required
            value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
            className={`${field} h-[42px]`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Hasta (vacío si es un solo día)
          <input
            name="endsOn"
            type="date"
            min={startsOn || undefined}
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className={`${field} h-[42px]`}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-[13px] text-muted">
        De dónde sale
        <input
          name="note"
          required
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={`${field} h-[42px]`}
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <span aria-live="polite" className="text-[13px] text-mint-ink">
          {state.saved > 0 && !state.error && !title ? "Confirmada." : ""}
        </span>
        <button type="submit" disabled={pending || !title.trim() || !startsOn} className={primary}>
          {pending ? "Guardando…" : "Confirmar"}
        </button>
      </div>
    </form>
  );
}
