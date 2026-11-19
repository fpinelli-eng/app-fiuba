"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ACTIVITY_COLORS,
  ALL_DAYS,
  MAX_BLOCKS,
  MAX_NAME,
  MAX_PLACE,
  parseTime,
  timeValue,
  validateActivity,
  type ActivityColor,
  type PlanActivity,
} from "@/lib/plan/activities";
import { DAY_SHORT, formatHour } from "@/lib/plan/format";
import type { WeekDay } from "@/lib/plan/options";
import { deleteActivity, saveActivity } from "./actions";

// Actividades propias del alumno en el Plan (ayudantías, trabajo, gimnasio): el diálogo para
// crearlas, editarlas y borrarlas, y sus estilos. Se guardan por cuatrimestre y valen para la
// Opción A y la B. En el calendario van rayadas (bg-hatch) para no confundirse con los cursos.

export const ACTIVITY_STYLE: Record<ActivityColor, { name: string; hatch: string; ink: string; border: string; dot: string }> = {
  lavender: { name: "Lila", hatch: "[--hatch:var(--lavender)]", ink: "text-lavender-ink", border: "border-lavender-ink/40", dot: "bg-lavender-ink" },
  mint: { name: "Verde", hatch: "[--hatch:var(--mint)]", ink: "text-mint-ink", border: "border-mint-ink/40", dot: "bg-mint-ink" },
  butter: { name: "Amarillo", hatch: "[--hatch:var(--butter)]", ink: "text-butter-ink", border: "border-butter-ink/40", dot: "bg-butter-ink" },
  sky: { name: "Celeste", hatch: "[--hatch:var(--sky)]", ink: "text-sky-ink", border: "border-sky-ink/40", dot: "bg-sky-ink" },
  peach: { name: "Coral", hatch: "[--hatch:var(--peach)]", ink: "text-peach-ink", border: "border-peach-ink/40", dot: "bg-peach-ink" },
  pink: { name: "Rosa", hatch: "[--hatch:var(--pink)]", ink: "text-pink-ink", border: "border-pink-ink/40", dot: "bg-pink-ink" },
};

/** Clases del bloque rayado de una actividad (calendario, agenda y chips). */
export const hatchClass = (color: ActivityColor) => {
  const s = ACTIVITY_STYLE[color];
  return `bg-hatch ${s.hatch} ${s.ink}`;
};

/** "Mar 18–20 hs y Sáb 10–13 hs" */
export function describeActivity(a: PlanActivity): string {
  const times = a.blocks.map((b) => `${DAY_SHORT[b.day]} ${formatHour(b.start)}–${formatHour(b.end)} hs`);
  return times.length > 1 ? `${times.slice(0, -1).join(", ")} y ${times[times.length - 1]}` : (times[0] ?? "");
}

/** Lista de las actividades, cada una abre su edición, y el botón para agregar otra. */
export function ActivityList({
  activities,
  onEdit,
  onAdd,
  compact = false,
}: {
  activities: PlanActivity[];
  onEdit: (a: PlanActivity) => void;
  onAdd: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "border-t border-line pt-2.5"}`}>
      <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">TUS ACTIVIDADES</span>
      {activities.map((a) => (
        <button
          key={a.id}
          onClick={() => onEdit(a)}
          aria-haspopup="dialog"
          aria-label={`Editar ${a.name}`}
          className={`inline-flex min-h-10 items-baseline gap-1.5 rounded-full border px-3 py-1 text-left text-[12.5px] md:min-h-0 ${hatchClass(a.color)} ${ACTIVITY_STYLE[a.color].border}`}
        >
          <b>{a.name}</b>
          <span>{describeActivity(a)}</span>
        </button>
      ))}
      <AddActivityButton onClick={onAdd} small />
    </div>
  );
}

export function AddActivityButton({ onClick, small = false }: { onClick: () => void; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-haspopup="dialog"
      className={`inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-line-strong bg-surface text-ink-2 hover:border-accent hover:text-ink ${
        small ? "h-10 px-3 text-[12.5px] md:h-8 md:rounded-full" : "h-10 px-3.5 text-[13.5px] md:h-[38px]"
      }`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5v14M5 12h14" />
      </svg>
      Agregar actividad
    </button>
  );
}

type DraftBlock = { key: number; day: WeekDay; start: string; end: string };

let nextKey = 1;
const draftBlock = (day: WeekDay = "Lunes", start = 18 * 60, end = 20 * 60): DraftBlock => ({
  key: nextKey++,
  day,
  start: timeValue(start),
  end: timeValue(end),
});

/**
 * Crear (activity null) o editar una actividad. <dialog> nativo, como "Confirmar mi cursada": en
 * el celular sube desde abajo; desde md, al centro.
 */
export function ActivityDialog({
  activity,
  defaultColor,
  term,
  onSaved,
  onDeleted,
  onClose,
}: {
  activity: PlanActivity | null;
  defaultColor: ActivityColor;
  term: string | null;
  onSaved: (a: PlanActivity) => void;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(activity?.name ?? "");
  const [place, setPlace] = useState(activity?.place ?? "");
  const [color, setColor] = useState<ActivityColor>(activity?.color ?? defaultColor);
  const [blocks, setBlocks] = useState<DraftBlock[]>(() =>
    activity ? activity.blocks.map((b) => draftBlock(b.day, b.start, b.end)) : [draftBlock()],
  );
  const [state, setState] = useState<"idle" | "saving" | "confirm-delete" | "deleting">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  const close = () => dialog.current?.close();
  const busy = state === "saving" || state === "deleting";
  const setBlock = (key: number, patch: Partial<DraftBlock>) => setBlocks(blocks.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const input = {
      name,
      place,
      color,
      blocks: blocks.map((b) => ({ day: b.day, start: parseTime(b.start), end: parseTime(b.end) })),
    };
    const checked = validateActivity(input);
    if (checked.error !== null) {
      setError(checked.error);
      return;
    }
    setError(null);
    setState("saving");
    const r = await saveActivity(activity?.id ?? null, checked.value).catch(() => ({ error: "No pudimos guardar la actividad.", activity: undefined }));
    if (r.error || !r.activity) {
      setError(r.error ?? "No pudimos guardar la actividad.");
      setState("idle");
      return;
    }
    onSaved(r.activity);
    close();
  };

  const remove = async () => {
    if (!activity) return;
    if (state !== "confirm-delete") {
      setState("confirm-delete");
      return;
    }
    setState("deleting");
    const r = await deleteActivity(activity.id).catch(() => ({ error: "No pudimos borrar la actividad." }));
    if (r.error) {
      setError(r.error);
      setState("idle");
      return;
    }
    onDeleted(activity.id);
    close();
  };

  const field =
    "h-11 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent md:h-10 md:text-sm";

  return (
    <dialog
      ref={dialog}
      aria-labelledby="actividad-titulo"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
      className="inset-x-0 mx-0 mt-auto mb-0 max-h-[90dvh] w-full max-w-full flex-col rounded-t-[20px] border-0 bg-surface p-0 text-ink transition-transform duration-200 backdrop:bg-pop-shadow open:flex starting:open:translate-y-full md:mx-auto md:my-auto md:max-h-[85dvh] md:w-[520px] md:rounded-[20px] md:starting:open:translate-y-4"
    >
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-auto flex-col">
        <div className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-line-strong md:hidden" aria-hidden="true" />
        <div className="flex flex-none items-start gap-3 border-b border-line px-4 pt-2 pb-3 md:px-6 md:pt-5 md:pb-4">
          <div className="min-w-0 flex-auto">
            <h2 id="actividad-titulo" className="text-[19px] leading-tight font-semibold">
              {activity ? "Editar actividad" : "Nueva actividad"}
            </h2>
            <p className="mt-0.5 text-[13.5px] text-muted">
              Aparece en tu semana{term ? ` del ${term}` : ""}, en la Opción A y en la B.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="-mt-1 -mr-2 grid size-10 flex-none place-items-center rounded-full text-muted hover:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 md:px-6">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="actividad-nombre" className="text-[13.5px] font-semibold">
              Nombre
            </label>
            <input
              id="actividad-nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME}
              placeholder="Ayudantía, trabajo, gimnasio…"
              autoComplete="off"
              className={field}
            />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-[13.5px] font-semibold">Horarios</legend>
            <ul className="flex flex-col gap-2">
              {blocks.map((b, i) => (
                <li key={b.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-1.5 rounded-xl bg-bg p-2 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                  <label className="sr-only" htmlFor={`dia-${b.key}`}>
                    Día del horario {i + 1}
                  </label>
                  <select
                    id={`dia-${b.key}`}
                    value={b.day}
                    onChange={(e) => setBlock(b.key, { day: e.target.value as WeekDay })}
                    className={`${field} col-span-2 row-start-1 px-2 md:col-span-1 md:row-start-auto`}
                  >
                    {ALL_DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <label className="sr-only" htmlFor={`desde-${b.key}`}>
                    Desde, horario {i + 1}
                  </label>
                  <input
                    id={`desde-${b.key}`}
                    type="time"
                    step={300}
                    value={b.start}
                    onChange={(e) => setBlock(b.key, { start: e.target.value })}
                    className={`${field} px-2`}
                  />
                  <label className="sr-only" htmlFor={`hasta-${b.key}`}>
                    Hasta, horario {i + 1}
                  </label>
                  <input
                    id={`hasta-${b.key}`}
                    type="time"
                    step={300}
                    value={b.end}
                    onChange={(e) => setBlock(b.key, { end: e.target.value })}
                    className={`${field} px-2`}
                  />
                  <button
                    type="button"
                    onClick={() => setBlocks(blocks.filter((x) => x.key !== b.key))}
                    disabled={blocks.length === 1}
                    aria-label={`Quitar el horario ${i + 1}`}
                    className="col-start-3 row-start-1 grid size-10 place-items-center rounded-lg text-muted hover:text-ink disabled:invisible md:col-start-auto md:row-start-auto"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
            {blocks.length < MAX_BLOCKS && (
              <button
                type="button"
                onClick={() => {
                  const last = blocks[blocks.length - 1];
                  const nextDay = last ? ALL_DAYS[(ALL_DAYS.indexOf(last.day) + 1) % ALL_DAYS.length] : "Lunes";
                  const start = last ? parseTime(last.start) : null;
                  const end = last ? parseTime(last.end) : null;
                  setBlocks([...blocks, draftBlock(nextDay, start ?? 18 * 60, end ?? 20 * 60)]);
                }}
                className="h-10 self-start rounded-[10px] px-2 text-[13.5px] font-semibold text-accent hover:underline md:h-8"
              >
                + Otro horario
              </button>
            )}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="actividad-lugar" className="text-[13.5px] font-semibold">
              Lugar o nota <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="actividad-lugar"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              maxLength={MAX_PLACE}
              placeholder="Paseo Colón, aula 302"
              autoComplete="off"
              className={field}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-[13.5px] font-semibold">Color</legend>
            <div className="flex flex-wrap gap-2.5">
              {ACTIVITY_COLORS.map((c) => (
                <label key={c} className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="actividad-color"
                    value={c}
                    checked={color === c}
                    onChange={() => setColor(c)}
                    className="peer sr-only"
                  />
                  <span className="sr-only">{ACTIVITY_STYLE[c].name}</span>
                  <span
                    aria-hidden="true"
                    className={`grid size-10 place-items-center rounded-full border-2 border-transparent peer-checked:border-current peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${hatchClass(c)}`}
                  >
                    {color === c ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <span className={`size-3 rounded-full ${ACTIVITY_STYLE[c].dot}`} />
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-line px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] md:px-6 md:pb-4">
          <div className="mr-auto min-w-0 text-[13px]" aria-live="polite">
            {error && <span className="text-danger">{error}</span>}
          </div>
          {activity && (
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className={`h-11 rounded-[10px] px-3.5 text-[14px] md:h-10 ${
                state === "confirm-delete" || state === "deleting"
                  ? "bg-danger-soft font-semibold text-danger-ink"
                  : "text-danger hover:bg-danger-soft"
              }`}
            >
              {state === "deleting" ? "Borrando…" : state === "confirm-delete" ? "Sí, borrar" : "Borrar"}
            </button>
          )}
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="h-11 rounded-[10px] border border-line bg-surface px-4 text-[14px] text-muted hover:text-ink md:h-10"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-[10px] bg-accent px-4 text-[14px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink md:h-10"
          >
            {state === "saving" ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
