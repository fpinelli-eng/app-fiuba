"use client";

import { useActionState, useState } from "react";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { ANNOUNCEMENT_BODY_MAX, ANNOUNCEMENT_TITLE_MAX, URL_MAX } from "@/lib/broadcast/model";
import { publishAnnouncement, type AnnouncementState } from "./actions";

// "Aviso en Inicio": título, texto, enlace, carrera y fecha de fin opcionales, con la tarjeta tal como
// se va a ver. Si se publicó, el formulario se vacía; si hubo un error, queda lo escrito.
// `action` reemplaza la acción del servidor en la vista previa pública.

type Action = (prev: AnnouncementState, formData: FormData) => Promise<AnnouncementState>;

const initial: AnnouncementState = { error: null, published: 0 };

export const primary =
  "h-10 whitespace-nowrap rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink";
export const field = "w-full rounded-[10px] border border-line-strong bg-bg px-3.5 text-sm text-ink";
export const label = "flex flex-col gap-1 text-[13px] text-muted";

/** "12/80": se pone en coral cuando falta poco para el límite. */
export function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  return (
    <span aria-hidden className={`tabular-nums ${left < 10 ? "font-semibold text-peach-ink" : ""}`}>
      {value.length}/{max}
    </span>
  );
}

export function AnnouncementForm({ careers, action: run = publishAnnouncement }: { careers: { id: string; name: string }[]; action?: Action }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [career, setCareer] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [state, action, pending] = useActionState(async (prev: AnnouncementState, formData: FormData) => {
    const next = await run(prev, formData);
    if (!next.error) {
      setTitle("");
      setBody("");
      setUrl("");
      setCareer("");
      setEndsOn("");
    }
    return next;
  }, initial);
  const empty = !title.trim() && !body.trim();

  return (
    <form action={action} aria-labelledby="aviso-form-title" className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface px-4 py-[22px] md:px-6">
      <div>
        <h2 id="aviso-form-title" className="text-[19px] font-semibold">
          Aviso en Inicio
        </h2>
        <p className="text-sm text-muted">Una tarjeta arriba del Inicio. Cada uno la cierra una vez y no la vuelve a ver.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className={`${label} md:col-span-2`}>
          <span className="flex justify-between gap-2">
            Título <Counter value={title} max={ANNOUNCEMENT_TITLE_MAX} />
          </span>
          <input name="title" required maxLength={ANNOUNCEMENT_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} h-[42px]`} />
        </label>
        <label className={`${label} md:col-span-2`}>
          <span className="flex justify-between gap-2">
            Texto <Counter value={body} max={ANNOUNCEMENT_BODY_MAX} />
          </span>
          <textarea
            name="body"
            required
            rows={3}
            maxLength={ANNOUNCEMENT_BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={`${field} resize-y py-2.5 leading-normal`}
          />
        </label>
        <label className={`${label} md:col-span-2`}>
          Enlace (opcional)
          <input
            name="url"
            maxLength={URL_MAX}
            placeholder="/finales o https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${field} h-[42px]`}
          />
        </label>
        <label className={label}>
          Para
          <select name="careerId" value={career} onChange={(e) => setCareer(e.target.value)} className={`${field} h-[42px]`}>
            <option value="">Todas las carreras</option>
            {careers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Hasta (opcional)
          <input name="endsOn" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} className={`${field} h-[42px]`} />
        </label>
      </div>

      <div className="flex flex-col gap-2 rounded-[14px] bg-bg p-3 md:p-4">
        <span className="text-[13px] text-muted">Así se ve en Inicio</span>
        {/* El enlace no pasa a la vista previa: solo se muestra que hay un "Ver más". */}
        {empty ? (
          <p className="rounded-[24px] border border-dashed border-line-strong px-4 py-5 text-center text-sm text-muted">Escribí un título y un texto para ver el aviso.</p>
        ) : (
          <AnnouncementCard preview announcement={{ id: 0, title: title.trim() || "Título", body: body.trim() || "Texto del aviso", url: url.trim() ? "/" : null }} />
        )}
      </div>

      {state.error && (
        <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
          {state.error}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        {state.published > 0 && !state.error && empty && (
          <span role="status" className="text-[13px] text-mint-ink">
            Publicado.
          </span>
        )}
        <button type="submit" disabled={pending || !title.trim() || !body.trim()} className={primary}>
          {pending ? "Publicando…" : "Publicar aviso"}
        </button>
      </div>
    </form>
  );
}
