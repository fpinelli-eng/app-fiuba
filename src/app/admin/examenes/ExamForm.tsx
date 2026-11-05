"use client";

import { useActionState, useState } from "react";
import { formatExamDay, formatExamTime } from "@/lib/exams/types";
import { previewExams, publishExams, type ExamState } from "./actions";

// Pegar el enlace de la búsqueda en "Fechas de examen" del SIU (o el texto copiado de la página),
// ver el resumen y publicarlo.

const initial: ExamState = { error: null, preview: null, published: false };

const primary =
  "h-10 whitespace-nowrap rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink";

const day = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");

export function ExamForm({ planId, title }: { planId: string; title: string }) {
  const [text, setText] = useState("");
  const [preview, previewAction, previewing] = useActionState(previewExams, initial);
  const [published, publishAction, publishing] = useActionState(publishExams, initial);
  const p = preview.preview;
  const withTimes = p?.source === "link";

  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-line bg-surface px-6 py-[22px]">
      <h2 className="text-[19px] font-semibold">{title}</h2>
      <ol className="list-decimal pl-5 text-[13px] text-muted">
        <li>
          En el SIU, abrí{" "}
          <a href="https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen" target="_blank" rel="noreferrer" className="font-semibold text-ink-2 underline">
            Fechas de examen
          </a>
          , elegí la carrera y el plan y tocá Buscar.
        </li>
        <li>Copiá el enlace de la barra de direcciones y pegalo acá. Así se cargan también los horarios, el aula y los docentes.</li>
      </ol>
      <form action={previewAction} className="flex flex-col gap-3">
        <input type="hidden" name="planId" value={planId} />
        <label htmlFor="exam-text" className="sr-only">
          Enlace de la búsqueda o texto copiado de Fechas de examen del SIU
        </label>
        <textarea
          id="exam-text"
          name="text"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen?formulario_filtro…  (también sirve el texto de la página copiado con Ctrl+A, pero sin horarios)"
          className="w-full resize-y rounded-xl border border-line-strong bg-bg px-3.5 py-3 text-[13px] leading-normal break-all text-ink"
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
              {withTimes ? "La búsqueda" : "El texto"} parece de {p.mismatch}, no de este plan. Fijate que hayas elegido la carrera y el plan correctos en el SIU.
            </p>
          )}
          {!withTimes && (
            <p className="rounded-[10px] bg-butter px-3 py-2 text-[13px] text-butter-ink">
              El texto copiado no trae los horarios de las mesas. Pegá el enlace de la búsqueda del SIU para cargarlos.
            </p>
          )}
          {p.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 text-[13px] text-muted">
              {p.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <div className="max-h-[360px] overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-[13px] tabular-nums">
              <thead className="sticky top-0 bg-surface text-muted">
                <tr className="border-b border-line">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  {withTimes && <th className="px-3 py-2 font-semibold">Hora</th>}
                  <th className="px-3 py-2 font-semibold">Materia</th>
                  <th className="px-3 py-2 font-semibold">Mesa</th>
                  {withTimes && <th className="px-3 py-2 font-semibold">Aula</th>}
                </tr>
              </thead>
              <tbody>
                {p.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-1.5 whitespace-nowrap">{formatExamDay(r.date)}</td>
                    {withTimes && <td className="px-3 py-1.5 whitespace-nowrap">{formatExamTime(r.startTime, r.endTime) ?? "–"}</td>}
                    <td className="px-3 py-1.5">{r.subject}</td>
                    <td className="px-3 py-1.5 text-ink-2">
                      {r.name}
                      {r.kind !== "Regular" && <span className="text-muted"> · {r.kind}</span>}
                    </td>
                    {withTimes && <td className="px-3 py-1.5 text-muted">{r.room ?? "–"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
