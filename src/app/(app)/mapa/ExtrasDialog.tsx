"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { EXTRA_KIND_LABEL, sumExtraCredits, type ExtraCredit, type ExtraCreditKind } from "@/lib/map/model";

interface Props {
  supabase: SupabaseClient;
  userId: string;
  /** The plan's English requirement ("Prueba de nivel de idioma inglés"), if it has one. */
  english: { id: number; approved: boolean } | null;
  onEnglish: (approved: boolean) => void;
  extras: ExtraCredit[];
  onExtras: (list: ExtraCredit[]) => void;
  failedFinals: number;
  onFailedFinals: (n: number) => void;
  /** Something was saved: refresh Inicio and Plan. */
  onSaved: () => void;
  onClose: () => void;
}

const KINDS = Object.keys(EXTRA_KIND_LABEL) as ExtraCreditKind[];

// Mapa → "Créditos y extras": inglés aprobado, créditos que no son de una materia del plan
// (FIUBATÓN, materias del plan viejo reconocidas con créditos) y la cantidad de aplazos.
// Los créditos extra suman al total y a las electivas. Los aplazos por ahora solo se guardan.
// Markup simple con los estilos que ya hay: el diseño queda para el rediseño.
export function ExtrasDialog(props: Props) {
  const { supabase, userId, english, extras, failedFinals } = props;
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("");
  const [kind, setKind] = useState<ExtraCreditKind>("activity");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Focus inside while open, back to the button that opened it when it closes.
  useEffect(() => {
    const opener = document.activeElement;
    ref.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    const n = Number(credits);
    if (!name.trim()) return setError("Escribí de dónde son los créditos.");
    if (!Number.isInteger(n) || n < 1 || n > 60) return setError("Los créditos tienen que ser un número del 1 al 60.");
    setBusy(true);
    setError(null);
    const { data, error: saveError } = await supabase
      .from("user_extra_credits")
      .insert({ user_id: userId, name: name.trim().slice(0, 80), credits: n, kind })
      .select("id, name, credits, kind")
      .single();
    setBusy(false);
    if (saveError || !data) return setError("No pudimos guardarlo. Probá de nuevo.");
    props.onExtras([...extras, { id: data.id as number, name: data.name as string, credits: data.credits as number, kind: data.kind as ExtraCreditKind }]);
    setName("");
    setCredits("");
    props.onSaved();
  }

  async function remove(id: number) {
    setError(null);
    const before = extras;
    props.onExtras(extras.filter((e) => e.id !== id));
    const { error: deleteError } = await supabase.from("user_extra_credits").delete().eq("id", id);
    if (deleteError) {
      props.onExtras(before);
      return setError("No pudimos borrarlo. Probá de nuevo.");
    }
    props.onSaved();
  }

  async function saveFailed(n: number) {
    const value = Math.min(99, Math.max(0, n));
    const before = failedFinals;
    props.onFailedFinals(value);
    const { error: saveError } = await supabase.from("profiles").update({ failed_finals: value }).eq("id", userId);
    if (saveError) {
      props.onFailedFinals(before);
      return setError("No pudimos guardar los aplazos. Probá de nuevo.");
    }
    props.onSaved();
  }

  const box = "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4";
  const input = "h-[42px] rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-ink";
  const button = "inline-flex h-[42px] shrink-0 items-center justify-center rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 md:items-center md:p-6" onClick={props.onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="extras-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && props.onClose()}
        className="flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto rounded-t-[22px] bg-bg p-5 pb-[max(20px,env(safe-area-inset-bottom))] outline-none md:max-w-[520px] md:rounded-[22px]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="extras-title" className="text-[22px] font-semibold">
              Créditos y extras
            </h2>
            <p className="text-sm text-muted">Lo que suma a tu carrera aparte de las materias del plan.</p>
          </div>
          <button type="button" onClick={props.onClose} className={button}>
            Cerrar
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
            {error}
          </p>
        )}

        {english && (
          <section className={box}>
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block font-semibold">Inglés</span>
                <span className="text-sm text-muted">Aprobé la prueba de nivel de idioma inglés.</span>
              </span>
              <input
                type="checkbox"
                checked={english.approved}
                onChange={(e) => props.onEnglish(e.target.checked)}
                className="size-6 shrink-0 accent-[var(--accent)]"
              />
            </label>
          </section>
        )}

        <section className={box} aria-labelledby="extra-credits-title">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="extra-credits-title" className="font-semibold">
              Créditos extra
            </h3>
            <span className="text-sm text-muted tabular-nums">{sumExtraCredits(extras)} C en total</span>
          </div>
          <p className="text-sm text-muted">
            FIUBATÓN y otras actividades, o materias de un plan viejo que te reconocieron con créditos. Suman al total y a las electivas.
          </p>
          {extras.length > 0 && (
            <ul className="flex flex-col">
              {extras.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 border-t border-disabled py-2.5 first:border-t-0">
                  <span className="min-w-0">
                    <span className="block font-semibold break-words">{e.name}</span>
                    <span className="text-[13px] text-muted">
                      {EXTRA_KIND_LABEL[e.kind]} · {e.credits} C
                    </span>
                  </span>
                  <button type="button" onClick={() => remove(e.id)} className={button} aria-label={`Borrar ${e.name}`}>
                    Borrar
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={add} className="flex flex-col gap-2.5">
            <input
              aria-label="De dónde son los créditos"
              placeholder="Ej.: FIUBATÓN 2025"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className={input}
            />
            <div className="flex gap-2.5">
              <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as ExtraCreditKind)} className={`${input} min-w-0 flex-1`}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {EXTRA_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input
                aria-label="Créditos"
                placeholder="Créditos"
                inputMode="numeric"
                value={credits}
                onChange={(e) => setCredits(e.target.value.replace(/\D/g, "").slice(0, 2))}
                className={`${input} w-[96px]`}
              />
            </div>
            <button type="submit" disabled={busy} className={button}>
              Agregar créditos
            </button>
          </form>
        </section>

        <section className={box} aria-labelledby="failed-title">
          <div className="flex items-center justify-between gap-3">
            <span>
              <h3 id="failed-title" className="font-semibold">
                Aplazos
              </h3>
              <span className="text-sm text-muted">Finales desaprobados.</span>
            </span>
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => saveFailed(failedFinals - 1)} disabled={failedFinals === 0} aria-label="Uno menos" className={`${button} w-[42px] px-0`}>
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums" aria-live="polite">
                {failedFinals}
              </span>
              <button type="button" onClick={() => saveFailed(failedFinals + 1)} aria-label="Uno más" className={`${button} w-[42px] px-0`}>
                +
              </button>
            </span>
          </div>
          <p className="text-[13px] text-muted">Todavía no cambian tu promedio: pronto los vamos a usar para calcularlo con aplazos.</p>
        </section>
      </div>
    </div>
  );
}
