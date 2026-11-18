"use client";

import { useEffect, useState } from "react";
import { base64UrlToBytes, detectIOS, pushState, type PushState } from "@/lib/broadcast/model";
import { deletePushSubscription, savePushSubscription } from "./push-actions";

// "Notificaciones" en Perfil: activa o desactiva las notificaciones push en ESTE dispositivo.
// Registra public/sw.js, se suscribe con la clave pública VAPID y guarda la suscripción en la base.
// En el iPhone solo funciona con FIUBI agregada a la pantalla de inicio (iOS 16.4 o posterior).
// Mientras las prueban, Perfil solo lo muestra a los administradores.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

export function PushOptIn() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ios = detectIOS(navigator.userAgent, navigator.maxTouchPoints);
      const hasServiceWorker = "serviceWorker" in navigator;
      const hasPushManager = "PushManager" in window;
      const hasNotification = "Notification" in window;
      let subscribed = false;
      if (hasServiceWorker && hasPushManager) {
        try {
          subscribed = (await currentSubscription()) !== null;
        } catch {}
      }
      const next = pushState({
        hasServiceWorker,
        hasPushManager,
        hasNotification,
        isIOS: ios.isIOS,
        iosVersion: ios.version,
        standalone: window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true,
        configured: VAPID_PUBLIC_KEY.length > 0,
        permission: hasNotification ? Notification.permission : "default",
        subscribed,
      });
      if (alive) setState(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY) }));
      const saved = await savePushSubscription(JSON.parse(JSON.stringify(sub)));
      if (saved.error) {
        await sub.unsubscribe().catch(() => {});
        setError(saved.error);
        return;
      }
      setState("on");
    } catch {
      setError("No pudimos activar las notificaciones en este navegador. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const sub = await currentSubscription();
      if (sub) {
        const removed = await deletePushSubscription(sub.endpoint);
        if (removed.error) {
          setError(removed.error);
          return;
        }
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setError("No pudimos desactivarlas. Probá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return <PushOptInView state={state} busy={busy} error={error} onEnable={enable} onDisable={disable} />;
}

const primary =
  "h-10 whitespace-nowrap rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink";
const secondary =
  "h-10 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold text-ink disabled:cursor-not-allowed disabled:text-disabled-ink";

const STATUS: Record<PushState, string> = {
  off: "Avisos de FIUBI en este dispositivo, aunque no tengas la app abierta.",
  on: "Activadas en este dispositivo.",
  denied: "Las bloqueaste para FIUBI en este navegador. Para activarlas, permitilas en la configuración del sitio y volvé a esta pantalla.",
  unconfigured: "Todavía no están configuradas: faltan las claves del servidor.",
  unsupported: "Este navegador no puede recibir notificaciones.",
  "ios-install": "En el iPhone, primero agregá FIUBI a tu pantalla de inicio.",
  "ios-old": "Para recibir notificaciones, el iPhone necesita iOS 16.4 o posterior.",
};

/** La tarjeta sin la lógica del navegador: Perfil y la vista previa de /privacidad/preview-avisos. */
export function PushOptInView({
  state,
  busy = false,
  error = null,
  onEnable,
  onDisable,
}: {
  state: PushState | null;
  busy?: boolean;
  error?: string | null;
  onEnable?: () => void;
  onDisable?: () => void;
}) {
  return (
    <section aria-labelledby="notificaciones" className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface px-4 py-[18px] md:px-6 md:py-[22px]">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-64">
          <h2 id="notificaciones" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[19px] font-semibold">
            Notificaciones
            <span className="rounded-full bg-butter px-2.5 py-0.5 text-[12px] font-semibold text-butter-ink">Solo administradores</span>
          </h2>
          <p aria-live="polite" className={`mt-0.5 text-sm ${state === "on" ? "font-semibold text-mint-ink" : "text-muted"}`}>
            {state === null ? "Revisando este dispositivo…" : STATUS[state]}
          </p>
        </div>
        {state === "off" && (
          <button type="button" onClick={onEnable} disabled={busy} className={`${primary} w-full md:w-auto`}>
            {busy ? "Activando…" : "Activar notificaciones"}
          </button>
        )}
        {state === "on" && (
          <button type="button" onClick={onDisable} disabled={busy} className={`${secondary} w-full md:w-auto`}>
            {busy ? "Desactivando…" : "Desactivar"}
          </button>
        )}
      </div>

      {state === "ios-install" && (
        <div className="rounded-[14px] bg-bg px-4 py-3.5 text-sm text-ink-2">
          <ol className="flex flex-col gap-2">
            {[
              "Abrí FIUBI en Safari.",
              <>
                Tocá <b className="font-semibold text-ink">Compartir</b> y elegí <b className="font-semibold text-ink">Agregar a inicio</b>.
              </>,
              "Abrí FIUBI desde el ícono nuevo y volvé a Perfil para activarlas.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="grid size-6 flex-none place-items-center rounded-full bg-surface text-[13px] font-semibold text-ink tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 pl-9 text-[13px] text-muted">Hace falta iOS 16.4 o posterior.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
          {error}
        </p>
      )}
    </section>
  );
}
