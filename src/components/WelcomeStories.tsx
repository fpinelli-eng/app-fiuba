"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { markIntroSeen } from "@/app/(app)/actions";
import { NavIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { STORY_SECONDS, welcomeStories, type Story } from "@/lib/intro/stories";

/** Perfil → "Ver la bienvenida" fires this event to open the stories again. */
export const OPEN_INTRO_EVENT = "fiubi:intro";

const TONE: Record<Story["tone"], { bg: string; ink: string }> = {
  butter: { bg: "bg-butter", ink: "text-butter-ink" },
  sky: { bg: "bg-sky", ink: "text-sky-ink" },
  mint: { bg: "bg-mint", ink: "text-mint-ink" },
  lavender: { bg: "bg-lavender", ink: "text-lavender-ink" },
  peach: { bg: "bg-peach", ink: "text-peach-ink" },
  pink: { bg: "bg-pink", ink: "text-pink-ink" },
  teal: { bg: "bg-teal", ink: "text-teal-ink" },
};

// A press shorter than this is a tap (next / previous); a longer one only pauses, like Instagram.
const TAP_MS = 250;

const noSubscribe = () => () => {};
const reducedMotionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribeReducedMotion = (onChange: () => void) => {
  const media = reducedMotionQuery();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

// Historias de bienvenida: se abren solas la primera vez que el alumno entra a la app y pasan
// solas (STORY_SECONDS cada una) o tocando: a la derecha avanza, a la izquierda vuelve, apretado
// pausa. Con teclado: flechas y Escape. Con "reducir movimiento" no pasan solas.
export function WelcomeStories({ firstName, open: openAtStart }: { firstName: string; open: boolean }) {
  const router = useRouter();
  const stories = welcomeStories(firstName);
  const [opened, setOpened] = useState(openAtStart);
  // ?bienvenida in the address opens them too (handy to show them to someone), until closed.
  const askedByUrl = useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).has("bienvenida"), () => false);
  const [closedUrl, setClosedUrl] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => reducedMotionQuery().matches, () => false);
  const open = opened || (askedByUrl && !closedUrl);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const pressedAt = useRef(0);

  const last = index === stories.length - 1;
  const story = stories[index];
  const tone = TONE[story.tone];

  const close = () => {
    setOpened(false);
    setClosedUrl(true);
    markIntroSeen().catch(() => {});
  };
  const next = () => setIndex((i) => Math.min(i + 1, stories.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  // Reopen from Perfil.
  useEffect(() => {
    const reopen = () => {
      setIndex(0);
      setPaused(false);
      setOpened(true);
    };
    window.addEventListener(OPEN_INTRO_EVENT, reopen);
    return () => window.removeEventListener(OPEN_INTRO_EVENT, reopen);
  }, []);

  // While open: focus inside, no page scroll behind, and focus back where it was when it closes.
  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement;
    dialogRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, [open]);

  if (!open) return null;

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as Element).closest("button, a")) return;
    pressedAt.current = Date.now();
    setPaused(true);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!pressedAt.current) return;
    const tap = Date.now() - pressedAt.current < TAP_MS;
    pressedAt.current = 0;
    setPaused(false);
    if (!tap) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX - box.left < box.width * 0.3) prev();
    else next();
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-ink/60 md:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-roledescription="historias"
        aria-label="Bienvenida a FIUBI"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") next();
          else if (e.key === "ArrowLeft") prev();
          else if (e.key === "Escape") close();
          else if (e.key === "Tab") {
            // Keep Tab inside the stories.
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button, a")];
            if (!items.length) return;
            const first = items[0];
            const end = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === e.currentTarget)) {
              e.preventDefault();
              end.focus();
            } else if (!e.shiftKey && document.activeElement === end) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
        className={`relative flex h-dvh w-full flex-col overflow-hidden outline-none select-none md:h-[min(760px,calc(100dvh-48px))] md:max-w-[420px] md:rounded-[28px] md:shadow-[0_24px_60px_var(--pop-shadow)] ${tone.bg} ${tone.ink}`}
      >
        {/* Barritas: una por historia; la actual se llena mientras dura. */}
        <div className="flex gap-1 px-3 pt-[max(12px,env(safe-area-inset-top))]" aria-hidden="true">
          {stories.map((s, i) => (
            <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-current/20">
              <span
                key={i === index ? `${s.id}-on` : s.id}
                className={`block h-full rounded-full bg-current ${i < index || (i === index && (reducedMotion || last)) ? "w-full" : i > index ? "w-0" : ""}`}
                style={
                  i === index && !reducedMotion && !last
                    ? { animation: `story-fill ${STORY_SECONDS}s linear forwards`, animationPlayState: paused ? "paused" : "running" }
                    : undefined
                }
                onAnimationEnd={i === index ? next : undefined}
              />
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between px-4 pt-3">
          <Logo className="h-[14px]" />
          <button type="button" onClick={close} className="rounded-full px-3 py-2 text-sm font-semibold underline-offset-2 hover:underline">
            {last ? "Cerrar" : "Saltar"}
          </button>
        </div>

        {/* Zona para tocar: a la derecha avanza, a la izquierda vuelve, apretado pausa. */}
        <div
          className="flex flex-1 touch-none flex-col justify-center gap-5 px-7 pb-6"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            pressedAt.current = 0;
            setPaused(false);
          }}
          onPointerLeave={() => {
            if (pressedAt.current) {
              pressedAt.current = 0;
              setPaused(false);
            }
          }}
        >
          <div key={story.id} className="flex flex-col gap-5 motion-safe:animate-[story-in_0.45s_ease-out]" aria-live="polite">
            <span className="grid size-[72px] place-items-center rounded-[22px] bg-surface/70">
              {story.icon ? (
                <NavIcon name={story.icon} size={36} />
              ) : (
                <span aria-hidden="true" className="font-display text-[34px] font-semibold">
                  {last ? "✓" : "👋"}
                </span>
              )}
            </span>
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold tracking-[0.08em] uppercase opacity-75">{story.kicker}</span>
              <h2 className="font-display text-[34px] leading-[1.05] font-semibold tracking-[-0.01em]">{story.title}</h2>
              <p className="text-[17px] leading-snug">{story.text}</p>
            </div>
            <ul className="flex flex-col gap-2.5">
              {story.points.map((p) => (
                <li key={p} className="flex items-start gap-2.5 rounded-2xl bg-surface/60 px-3.5 py-2.5 text-[15px] leading-snug">
                  <span aria-hidden="true" className="mt-0.5 font-bold">
                    ✓
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            aria-label="Anterior"
            className="grid size-11 place-items-center rounded-full bg-surface/60 text-xl disabled:opacity-0"
          >
            ‹
          </button>
          <span className="text-[13px] font-semibold tabular-nums opacity-75" aria-live="polite">
            {index + 1} de {stories.length}
          </span>
          {last ? (
            <button
              type="button"
              onClick={() => {
                close();
                router.push("/mapa");
              }}
              className="rounded-full bg-ink px-5 py-3 text-[15px] font-semibold text-bg"
            >
              Ir al Mapa
            </button>
          ) : (
            <button type="button" onClick={next} aria-label="Siguiente" className="grid size-11 place-items-center rounded-full bg-surface/60 text-xl">
              ›
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
