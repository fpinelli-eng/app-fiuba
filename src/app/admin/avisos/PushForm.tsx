"use client";

import { useActionState, useState } from "react";
import { countReach, PUSH_BODY_MAX, PUSH_TITLE_MAX, URL_MAX } from "@/lib/broadcast/model";
import { sendNotification, type PushSendState } from "./actions";
import { Counter, field, label, primary } from "./AnnouncementForm";

// "Mandar notificación": a todos los que la activaron o a una carrera. Muestra a cuántos dispositivos
// llega y cómo se ve. Sin las claves VAPID no deja mandar. `action` reemplaza la acción del servidor
// en la vista previa pública.

type Action = (prev: PushSendState, formData: FormData) => Promise<PushSendState>;

const initial: PushSendState = { error: null, message: null };

const devices = (n: number) => `${n} ${n === 1 ? "dispositivo" : "dispositivos"}`;

export function PushForm({
  careers,
  counts,
  configured,
  action: run = sendNotification,
}: {
  careers: { id: string; name: string }[];
  /** null: la migración todavía no está en la base. */
  counts: { careerId: string | null; devices: number }[] | null;
  configured: boolean;
  action?: Action;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [career, setCareer] = useState("");
  const [state, action, pending] = useActionState(async (prev: PushSendState, formData: FormData) => {
    const next = await run(prev, formData);
    if (!next.error) {
      setTitle("");
      setBody("");
      setUrl("");
    }
    return next;
  }, initial);
  const reach = counts ? countReach(counts, career || null) : 0;
  const ready = configured && counts !== null;

  return (
    <form action={action} aria-labelledby="push-form-title" className="flex flex-col gap-4 rounded-[18px] border border-line bg-surface px-4 py-[22px] md:px-6">
      <div>
        <h2 id="push-form-title" className="text-[19px] font-semibold">
          Mandar notificación
        </h2>
        <p className="text-sm text-muted">Llega al celular o la compu de quienes la activaron en Perfil, aunque no tengan FIUBI abierta.</p>
      </div>

      {!configured && (
        <div className="rounded-[14px] bg-butter px-4 py-3 text-sm text-butter-ink">
          <p className="font-semibold">Faltan las claves VAPID</p>
          <p>
            Generalas con <code className="font-mono text-[13px]">npx web-push generate-vapid-keys</code> y cargá NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT en
            Vercel. Hasta entonces no se manda nada.
          </p>
        </div>
      )}
      {counts === null && (
        <p className="rounded-[14px] bg-butter px-4 py-3 text-sm text-butter-ink">La base todavía no tiene la tabla de notificaciones: se crea al integrar la rama.</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid content-start gap-3">
          <label className={label}>
            <span className="flex justify-between gap-2">
              Título <Counter value={title} max={PUSH_TITLE_MAX} />
            </span>
            <input name="title" required maxLength={PUSH_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} h-[42px]`} />
          </label>
          <label className={label}>
            <span className="flex justify-between gap-2">
              Texto (opcional) <Counter value={body} max={PUSH_BODY_MAX} />
            </span>
            <textarea
              name="body"
              rows={2}
              maxLength={PUSH_BODY_MAX}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`${field} resize-y py-2.5 leading-normal`}
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className={label}>
              Al tocarla abre
              <input name="url" maxLength={URL_MAX} placeholder="/ (Inicio)" value={url} onChange={(e) => setUrl(e.target.value)} className={`${field} h-[42px]`} />
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
          </div>
        </div>

        <div className="flex flex-col gap-2 self-start rounded-[14px] bg-bg p-3 md:p-4">
          <span className="text-[13px] text-muted">Así llega</span>
          <div className="flex gap-3 rounded-[16px] bg-surface p-3 shadow-[0_8px_20px_-14px_var(--pop-shadow)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- el ícono de la app, igual al de la notificación */}
            <img src="/icons/icon-192.png" alt="" width={36} height={36} className="size-9 flex-none rounded-[9px]" />
            <div className="min-w-0 text-[13px] leading-snug">
              <div className="text-muted">FIUBI · ahora</div>
              <div className="truncate font-semibold text-ink">{title.trim() || "Título de la notificación"}</div>
              {(body.trim() || !title.trim()) && <div className="line-clamp-2 text-ink-2">{body.trim() || "El texto, si lo escribís."}</div>}
            </div>
          </div>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {state.message && !state.error && (
          <span role="status" className="text-[13px] text-mint-ink">
            {state.message}
          </span>
        )}
        {ready && !state.message && <span className="text-[13px] text-muted tabular-nums">{reach === 0 ? "Nadie la activó todavía" : `Llega a ${devices(reach)}`}</span>}
        <button type="submit" disabled={pending || !ready || reach === 0 || !title.trim()} className={primary}>
          {pending ? "Mandando…" : "Mandar notificación"}
        </button>
      </div>
    </form>
  );
}
