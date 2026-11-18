"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { PushOptInView } from "@/app/(app)/perfil/PushOptIn";
import { AnnouncementForm } from "@/app/admin/avisos/AnnouncementForm";
import { AnnouncementList } from "@/app/admin/avisos/AnnouncementList";
import { PushForm } from "@/app/admin/avisos/PushForm";
import type { AnnouncementState, PushSendState } from "@/app/admin/avisos/actions";
import { APP_NAME } from "@/lib/app";
import type { Announcement, PushState } from "@/lib/broadcast/model";

// VISTA PREVIA TEMPORAL, SE BORRA ANTES DE INTEGRAR (ver page.tsx). Todo es inventado y nada sale del
// navegador: las acciones de los formularios esperan un momento y contestan como el servidor.

const CAREERS = [
  { id: "industrial", name: "Ing. Industrial" },
  { id: "informatica", name: "Ing. Informática" },
  { id: "quimica", name: "Ing. Química" },
];

const SAMPLE: Pick<Announcement, "id" | "title" | "body" | "url"> = {
  id: 1,
  title: "Ya están las mesas de diciembre",
  body: "Revisá las fechas de tus finales pendientes y anotate antes del 7/12 en el SIU.",
  url: "/finales",
};

const LIST: (Announcement & { active: boolean })[] = [
  { ...SAMPLE, careerId: null, endsAt: "2026-12-08T02:59:59.999Z", createdAt: "2026-11-18T12:00:00Z", active: true },
  {
    id: 2,
    title: "Inscripción a cursos de verano",
    body: "Del 9 al 14 de noviembre, en el SIU. La oferta ya está en Plan.",
    url: "https://www.fi.uba.ar/",
    careerId: "industrial",
    endsAt: "2026-11-15T02:59:59.999Z",
    createdAt: "2026-11-08T12:00:00Z",
    active: false,
  },
];

const STATES: [PushState, string][] = [
  ["off", "Sin activar"],
  ["on", "Activadas"],
  ["ios-install", "iPhone sin instalar"],
  ["denied", "Bloqueadas"],
  ["unconfigured", "Sin claves"],
  ["unsupported", "Sin soporte"],
];

const wait = () => new Promise((r) => setTimeout(r, 700));

export function PreviewAvisos() {
  const [cardKey, setCardKey] = useState(0);
  const [pushState, setPushState] = useState<PushState>("off");
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(LIST);
  const [configured, setConfigured] = useState(true);

  async function toggle(next: PushState) {
    setBusy(true);
    await wait();
    setBusy(false);
    setPushState(next);
  }

  async function publish(prev: AnnouncementState): Promise<AnnouncementState> {
    await wait();
    return { error: null, published: prev.published + 1 };
  }

  async function send(): Promise<PushSendState> {
    await wait();
    return { error: null, message: "Llegó a 2 dispositivos." };
  }

  async function remove(id: number) {
    setList((l) => l.filter((a) => a.id !== id));
  }

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-8 px-4 pt-6 pb-14 md:gap-10 md:px-8 md:pt-10">
      <div className="flex flex-col gap-3">
        <Link href="/" className="inline-block self-start py-2 text-sm font-semibold text-muted md:py-0">
          ← {APP_NAME}
        </Link>
        <h1 className="text-[28px] leading-tight font-semibold md:text-[34px]">Aviso y notificaciones</h1>
        <p className="rounded-[14px] bg-butter px-4 py-3 text-sm text-butter-ink">
          <b className="font-semibold">Vista previa temporal con datos inventados.</b> Nada se guarda ni se manda. En la app, por ahora, todo esto lo ven solo los administradores. Esta
          página se borra antes de integrar.
        </p>
      </div>

      <Area title="Inicio" note="El aviso aparece debajo del saludo. Al cerrarlo no vuelve a aparecer en ese navegador.">
        <div className="flex flex-col gap-3.5 rounded-[28px] bg-bg md:gap-6">
          <div>
            <p className="text-[32px] leading-[38px] font-medium tracking-[-0.025em] font-display md:text-[48px] md:leading-[56px]">Hola, Sofía</p>
            <p className="mt-1 text-[15px] text-muted md:mt-1.5 md:text-[17px]">Ingeniería Industrial, plan 2023</p>
          </div>
          <AnnouncementCard key={cardKey} announcement={SAMPLE} remember={false} />
          <div aria-hidden className="h-24 rounded-[24px] bg-surface shadow-[0_16px_30px_-28px_var(--card-shadow)] md:h-32 md:rounded-[32px]" />
        </div>
        <button type="button" onClick={() => setCardKey((k) => k + 1)} className="self-start text-sm text-accent underline underline-offset-[3px] hover:text-ink">
          Volver a mostrar el aviso
        </button>
      </Area>

      <Area title="Perfil" note="Una tarjeta nueva, debajo de Bienvenida. Elegí un caso para ver cada texto.">
        <div role="radiogroup" aria-label="Caso" className="flex flex-wrap gap-1.5">
          {STATES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={pushState === value}
              onClick={() => setPushState(value)}
              className={`h-9 rounded-[10px] px-3.5 text-[13px] ${pushState === value ? "bg-lavender font-semibold text-lavender-ink" : "border border-line-strong bg-surface text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-w-[860px]">
          <PushOptInView state={pushState} busy={busy} onEnable={() => toggle("on")} onDisable={() => toggle("off")} />
        </div>
      </Area>

      <Area title="Administración → Notificaciones" note="Una sección nueva en Administración, con el aviso y el envío de notificaciones.">
        <label className="flex items-center gap-2 self-start text-sm text-muted">
          <input type="checkbox" checked={!configured} onChange={(e) => setConfigured(!e.target.checked)} className="size-4 accent-[var(--accent)]" />
          Ver cómo queda sin las claves VAPID
        </label>
        <AnnouncementForm careers={CAREERS} action={publish} />
        <AnnouncementList announcements={list} careers={CAREERS} onDelete={remove} />
        <PushForm
          careers={CAREERS}
          counts={[
            { careerId: "industrial", devices: 1 },
            { careerId: "informatica", devices: 1 },
          ]}
          configured={configured}
          action={send}
        />
      </Area>
    </main>
  );
}

function Area({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="border-b border-line pb-2">
        <h2 className="text-[19px] font-semibold">{title}</h2>
        <p className="text-sm text-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}
