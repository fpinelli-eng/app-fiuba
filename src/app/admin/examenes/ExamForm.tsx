"use client";

import { useActionState, useState } from "react";
import { previewExams, publishExams, type ExamState } from "./actions";

// Pegar el texto de "Fechas de examen" del SIU, ver el resumen y publicarlo.

const initial: ExamState = { error: null, preview: null, published: false };

const primary =
  "h-10 whitespace-nowrap rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink";

const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

export function ExamForm({ planId, title }: { planId: string; title: string }) {
  const [text, setText] = useState("");
  const [preview, previewAction, previewing] = useActionState(previewExams, initial);
  const [published, publishAction, publishing] = useActionState(publishExams, initial);
  const p = preview.preview;

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface px-6 py-[22px]">
      <h2 className="text-[19px] font-semibold">{title}</h2>
      <form action={previewAction} className="flex flex-col gap-3">
        <input type="hidden" name="planId" value={planId} />
        <label htmlFor="exam-text" className="sr-only">
          Texto copiado de Fechas de examen del SIU
        </label>
        <textarea
          id="exam-text"
          name="text"
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Pegá acá el texto de la página Fechas de examen del SIU para esta carrera y plan"
          className="w-full resize-y rounded-xl border border-line-strong bg-bg px-3.5 py-3 text-[13px] leading-normal text-ink"
        />
        {preview.error && <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">{preview.error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={previewing || !text.trim()} className={primary}>
            {previewing ? "Procesando…" : "Procesar"}
          </button>
        </div>
      </form>

      {p && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                [p.stats.subjects, "materias"],
                [p.stats.tables, "mesas"],
                [`${day(p.stats.from)} al ${day(p.stats.to)}`, "fechas"],
              ] as const
            ).map(([value, label]) => (
              <div key={label} className="rounded-xl bg-bg px-4 py-3.5">
                <div className="text-[22px] leading-tight font-semibold">{value}</div>
                <div className="text-[13px] text-muted">{label}</div>
              </div>
            ))}
          </div>
          {p.mismatch && (
            <p className="rounded-[10px] bg-butter px-3 py-2 text-[13px] text-butter-ink">
              El texto parece de {p.mismatch}, no de este plan. Fijate que hayas elegido la carrera y el plan correctos en el SIU.
            </p>
          )}
          {p.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-[13px] text-muted">
              {p.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <form action={publishAction} className="flex flex-col items-end gap-2">
            <input type="hidden" name="planId" value={planId} />
            <input type="hidden" name="text" value={text} />
            <button type="submit" disabled={publishing} className={`${primary} h-[46px] px-[22px] text-[15px]`}>
              {publishing ? "Publicando…" : "Publicar fechas"}
            </button>
            {published.error && <p role="alert" className="text-[13px] text-danger">{published.error}</p>}
            {published.published && !published.error && (
              <p className="rounded-[10px] bg-mint px-3 py-2 text-[13px] text-mint-ink">
                Publicadas. Reemplazaron las fechas anteriores de este plan.
              </p>
            )}
          </form>
        </div>
      )}
    </section>
  );
}
