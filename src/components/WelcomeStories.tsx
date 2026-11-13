"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import { markIntroSeen } from "@/app/(app)/actions";
import { NavIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { hasStoryMock, StoryMock, stepAt } from "@/components/StoryMocks";
import { NAV } from "@/lib/app";
import { STORY_SECONDS, welcomeStories, type Platform, type Story, type StoryIcon } from "@/lib/intro/stories";

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

// Dibujos propios de las historias, con el mismo trazo que los íconos del menú (NavIcon).
type GlyphName = "pause" | "play" | "prev" | "next" | "check" | "phone" | "monitor" | "share" | "dots";

function Glyph({ name, size = 20 }: { name: GlyphName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className: "shrink-0",
  };
  switch (name) {
    case "pause":
      return (
        <svg {...common} strokeWidth={2.8}>
          <path d="M9 6.5v11M15 6.5v11" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="M9 6.5v11l9-5.5z" fill="currentColor" />
        </svg>
      );
    case "prev":
      return (
        <svg {...common} strokeWidth={2.4}>
          <path d="M14.5 6l-6 6 6 6" />
        </svg>
      );
    case "next":
      return (
        <svg {...common} strokeWidth={2.4}>
          <path d="M9.5 6l6 6-6 6" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} strokeWidth={2.6}>
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    // El celular con un "+": agregar a la pantalla de inicio.
    case "phone":
      return (
        <svg {...common}>
          <rect x="6" y="2.5" width="12" height="19" rx="2.8" />
          <path d="M12 9v6M9 12h6" />
        </svg>
      );
    case "monitor":
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="12" rx="2.2" />
          <path d="M8.5 20h7M12 16.5V20" />
        </svg>
      );
    // "Compartir" del iPhone: el cuadrado con la flecha para arriba.
    case "share":
      return (
        <svg {...common}>
          <path d="M12 14V3.5M8.5 7L12 3.5 15.5 7" />
          <path d="M8 10.5H6.5A1.5 1.5 0 0 0 5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H16" />
        </svg>
      );
    // El menú de Chrome en Android: los tres puntitos.
    case "dots":
      return (
        <svg {...common} stroke="none" fill="currentColor">
          <circle cx="12" cy="5" r="1.9" />
          <circle cx="12" cy="12" r="1.9" />
          <circle cx="12" cy="19" r="1.9" />
        </svg>
      );
  }
}

function StoryGlyph({ icon, size }: { icon: StoryIcon; size: number }) {
  return icon === "phone" || icon === "monitor" || icon === "check" ? <Glyph name={icon} size={size} /> : <NavIcon name={icon} size={size} />;
}

/** The drawing next to the step that names a button of the phone (step 2: Compartir / the three dots). */
const STEP_GLYPH: Record<Platform, GlyphName> = { ios: "share", android: "dots" };

// Foco con teclado: un contorno del color del texto de cada botón.
const FOCUS = "outline-offset-2 focus-visible:outline-2 focus-visible:outline-current";
// Llegadas que frenan suave, sin rebote (las mismas de StoryMocks).
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
// El alto manda: con menos de 640 px (celulares chicos con las barras del navegador) todo se junta un poco
// y se saca lo accesorio, para que nada quede cortado; con 760 px o más, los puntos respiran. Son las clases
// [@media(max-height:639px)]:… y [@media(min-height:760px)]:… de acá y de StoryMocks.

// A press shorter than this is a tap (next / previous); a longer one only pauses, like Instagram.
const TAP_MS = 250;

const noSubscribe = () => () => {};

// localStorage puede no estar (modo privado, datos bloqueados): sin él, el pedido de la oferta no se abre.
const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return "";
  }
};
const writeStorage = (key: string) => {
  try {
    window.localStorage.setItem(key, new Date().toISOString());
  } catch {
    // Sin almacenamiento: se cierra igual.
  }
};

/** The phone, to show its steps first: iPhone/iPad (also iPadOS, that says Macintosh) or Android. */
function detectPlatform(): Platform | null {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

/** Opened from the home screen icon: the "Tenela como app" story is not needed. */
const isInstalled = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const PLATFORM_LABEL: Record<Platform, string> = { ios: "iPhone", android: "Android" };
const reducedMotionQuery = () => window.matchMedia("(prefers-reduced-motion: reduce)");
const subscribeReducedMotion = (onChange: () => void) => {
  const media = reducedMotionQuery();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};

// Historias de bienvenida: se abren solas la primera vez que el alumno entra a la app y pasan
// solas (STORY_SECONDS cada una) o tocando: a la derecha avanza, a la izquierda vuelve, apretado
// pausa. Con teclado: flechas y Escape. Con "reducir movimiento" no pasan solas.
export function WelcomeStories({
  firstName,
  open: openAtStart,
  needsOffer = false,
  term = null,
}: {
  firstName: string;
  open: boolean;
  /** The plan has no course offer this term: one extra story asks to upload it. */
  needsOffer?: boolean;
  term?: string | null;
}) {
  const router = useRouter();
  const installed = useSyncExternalStore(noSubscribe, isInstalled, () => false);
  const detected = useSyncExternalStore(noSubscribe, detectPlatform, () => null);
  const [platformChoice, setPlatformChoice] = useState<Platform | null>(null);
  const platform = platformChoice ?? detected ?? "ios";
  const allStories = welcomeStories(firstName, { needsOffer, term }).filter((s) => !(installed && s.steps));
  const [opened, setOpened] = useState(openAtStart);
  // Quien ya vio las historias pero su carrera sigue sin oferta este cuatrimestre: una sola vez por
  // cuatrimestre (en este dispositivo) se abre solo la historia que pide subirla.
  const askKey = `fiubi-pedir-oferta-${term ?? ""}`;
  const offerAsked = useSyncExternalStore(noSubscribe, () => readStorage(askKey) !== null, () => true);
  const [offerClosed, setOfferClosed] = useState(false);
  const offerOnly = !openAtStart && needsOffer && !offerAsked && !offerClosed;
  const stories = offerOnly ? allStories.filter((s) => s.id === "oferta") : allStories;
  // ?bienvenida in the address opens them too (handy to show them to someone), until closed.
  const askedByUrl = useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).has("bienvenida"), () => false);
  const [closedUrl, setClosedUrl] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, () => reducedMotionQuery().matches, () => false);
  const open = opened || (askedByUrl && !closedUrl) || offerOnly;
  const [index, setIndex] = useState(0);
  // Hacia dónde se pasó: la historia nueva entra desde ese lado.
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false); // dedo apretado
  const [stopped, setStopped] = useState(false); // botón de pausa
  const halted = paused || stopped;
  const dialogRef = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const pressedAt = useRef(0);

  const last = index === stories.length - 1;
  const story = stories[index];
  const tone = TONE[story.tone];

  // La primera vez (se abrieron solas, por ejemplo recién elegida la carrera) al cerrarlas se va al
  // Inicio. Vueltas a abrir desde Perfil o Inicio, se cierran y se queda donde estaba.
  const [firstTime, setFirstTime] = useState(openAtStart);
  const close = () => {
    if (offerOnly) {
      writeStorage(askKey);
      setOfferClosed(true);
      return;
    }
    setOpened(false);
    setClosedUrl(true);
    markIntroSeen().catch(() => {});
    if (firstTime) {
      setFirstTime(false);
      router.push("/");
    }
  };
  const next = () => {
    setStopped(false);
    setDirection(1);
    setIndex((i) => Math.min(i + 1, stories.length - 1));
  };
  const prev = () => {
    setStopped(false);
    setDirection(-1);
    setIndex((i) => Math.max(i - 1, 0));
  };
  const mock = hasStoryMock(story.id);

  // Reopen from Perfil.
  useEffect(() => {
    const reopen = () => {
      setIndex(0);
      setDirection(1);
      setPaused(false);
      setFirstTime(false);
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

  const welcome = story.id === "bienvenida";
  const numberBadge = "grid flex-none place-items-center rounded-full bg-ink font-bold text-bg tabular-nums";
  const pill = "flex items-start gap-3 rounded-[18px] bg-surface/60 px-3.5 py-2.5 text-[15px] leading-snug";
  const arrow = `absolute bottom-[max(20px,env(safe-area-inset-bottom))] [@media(max-height:639px)]:bottom-[max(12px,env(safe-area-inset-bottom))] grid size-11 place-items-center rounded-full bg-surface/60 disabled:opacity-0 md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:bg-[var(--column-fg)]/20 md:text-[var(--column-fg)] md:hover:bg-[var(--column-fg)]/30 ${tone.ink} ${FOCUS}`;

  return (
    // El fondo es el azul noche del ícono (igual en claro y oscuro): en la computadora la tarjeta queda sola en el centro.
    <div className="fixed inset-0 z-[70] grid place-items-center bg-[var(--column-bg)]/80 md:p-6">
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
            const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), a")];
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
        className="relative h-dvh w-full outline-none select-none md:h-[min(780px,calc(100dvh-48px))] md:w-[420px]"
      >
        {/* La tarjeta: en el celular ocupa la pantalla; en la computadora tiene forma de celular. */}
        <div
          className={`flex h-full flex-col overflow-hidden transition-colors duration-500 motion-reduce:transition-none md:rounded-[32px] md:shadow-[0_32px_80px_-24px_var(--pop-shadow)] ${tone.bg} ${tone.ink}`}
        >
          {/* Barritas: una por historia; la actual se llena mientras dura. */}
          <div className="flex gap-1 px-4 pt-[max(12px,env(safe-area-inset-top))]" aria-hidden="true">
            {stories.map((s, i) => (
              <span key={s.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-current/20">
                <span
                  key={i === index ? `${s.id}-on` : s.id}
                  className={`block h-full rounded-full bg-current ${i < index || (i === index && (reducedMotion || last)) ? "w-full" : i > index ? "w-0" : ""}`}
                  style={
                    i === index && !reducedMotion && !last
                      ? { animation: `story-fill ${s.steps ? STORY_SECONDS * 2 : STORY_SECONDS}s linear forwards`, animationPlayState: halted ? "paused" : "running" }
                      : undefined
                  }
                  onAnimationEnd={i === index ? next : undefined}
                />
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1 pt-2 pr-2 pl-5">
            <Logo className="h-[15px]" />
            <span className="flex-1" />
            {!last && !reducedMotion && (
              <button
                type="button"
                onClick={() => setStopped((s) => !s)}
                aria-label={stopped ? "Seguir" : "Pausar"}
                aria-pressed={stopped}
                className={`grid size-10 place-items-center rounded-full bg-surface/60 ${FOCUS}`}
              >
                <Glyph name={stopped ? "play" : "pause"} size={18} />
              </button>
            )}
            <button type="button" onClick={close} className={`h-10 rounded-full px-3 text-sm font-semibold underline-offset-2 hover:underline ${FOCUS}`}>
              {last ? "Cerrar" : "Saltar"}
            </button>
          </div>

          {/* Zona para tocar: a la derecha avanza, a la izquierda vuelve, apretado pausa. La pausa frena las
              animaciones de adentro de la historia, pero no la entrada de la historia misma (su hijo directo):
              si no, una pausa justo al empezar la dejaría invisible. */}
          <div
            className={`flex min-h-0 flex-1 touch-none flex-col justify-center px-6 pb-3 [@media(max-height:639px)]:pb-2 ${halted ? "[&_*_*]:[animation-play-state:paused]!" : ""}`}
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
            <div
              key={story.id}
              aria-live="polite"
              style={{ "--story-dx": `${direction * 24}px` } as CSSProperties}
              className={`flex flex-col motion-safe:animate-[story-in_0.5s_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-[story-fade_0.3s_ease-out] [@media(max-height:639px)]:gap-2.5 ${mock ? "gap-3 [@media(min-height:760px)]:gap-4" : "gap-5"}`}
            >
              {welcome ? (
                <div className="flex flex-col gap-3">
                  <h2 className="font-display text-[34px] leading-[1.08] font-semibold tracking-[-0.02em] text-balance break-words">{story.title}</h2>
                  <p className="text-[17px] leading-snug text-pretty">{story.text}</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <div className={mock ? "flex items-center gap-3" : "flex flex-col gap-4 [@media(max-height:639px)]:gap-3"}>
                    {story.icon && (
                      <span className={`grid flex-none place-items-center bg-surface/70 ${mock ? "size-10 rounded-[14px]" : "size-14 rounded-[20px] [@media(max-height:639px)]:hidden"}`}>
                        <StoryGlyph icon={story.icon} size={mock ? 22 : 28} />
                      </span>
                    )}
                    <h2 className={`font-display leading-[1.1] font-semibold tracking-[-0.02em] text-balance ${mock ? "text-[24px]" : "text-[28px]"}`}>{story.title}</h2>
                  </div>
                  <p className={`leading-snug text-pretty ${mock ? "text-[15px]" : "text-base"}`}>{story.text}</p>
                </div>
              )}

              {/* Bienvenida: las seis secciones que vienen, como en el menú. */}
              {welcome && (
                <>
                  <ul aria-label="Secciones" className="grid grid-cols-3 gap-2">
                    {NAV.map((item, i) => (
                      <li
                        key={item.href}
                        className="story-step flex flex-col items-center gap-2 rounded-[18px] bg-surface/60 px-1 py-3.5 text-[13px] leading-none font-semibold"
                        style={{ animation: `story-pop 0.5s ${EASE} ${0.25 + i * 0.07}s both` }}
                      >
                        <NavIcon name={item.icon} size={22} />
                        {item.label}
                      </li>
                    ))}
                  </ul>
                  {story.points.map((p) => (
                    <p key={p} className="text-[15px] leading-snug">
                      {p}
                    </p>
                  ))}
                </>
              )}

              {mock && <StoryMock id={story.id} firstName={firstName} term={term} />}

              {story.steps && (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-1 self-start rounded-full bg-surface/60 p-1" role="group" aria-label="Tu celular">
                    {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={platform === p}
                        onClick={() => setPlatformChoice(p)}
                        className={`h-9 rounded-full px-4 text-sm font-semibold ${FOCUS} ${platform === p ? "bg-ink text-bg" : ""}`}
                      >
                        {PLATFORM_LABEL[p]}
                      </button>
                    ))}
                  </div>
                  <ol className="flex flex-col gap-2">
                    {story.steps[platform].map((step, i) => (
                      <li key={step} className={`${pill} items-center`}>
                        <span aria-hidden="true" className={`${numberBadge} size-6 text-[12px]`}>
                          {i + 1}
                        </span>
                        <span className="flex-auto">{step}</span>
                        {/* El botón que nombra el paso, dibujado como se ve en el celular. */}
                        {i === 1 && (
                          <span className="grid size-8 flex-none place-items-center rounded-[10px] bg-surface">
                            <Glyph name={STEP_GLYPH[platform]} size={18} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {!welcome &&
                story.points.length > 0 &&
                (mock ? (
                  <ol className="flex flex-col gap-2 [@media(min-height:760px)]:gap-2.5">
                    {story.points.map((p, i) => (
                      // Cada punto aparece junto con su número en la pantalla dibujada.
                      <li
                        key={p}
                        className="story-step flex items-start gap-2.5 text-[14.5px] leading-snug [@media(min-height:760px)]:text-base [@media(min-height:760px)]:leading-snug"
                        style={{ animation: `story-rise 0.5s ${EASE} ${stepAt(i + 1)}s both` }}
                      >
                        <span aria-hidden="true" className={`${numberBadge} mt-px size-5 text-[11px]`}>
                          {i + 1}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ol>
                ) : story.numbered ? (
                  <ol className="flex flex-col gap-2">
                    {story.points.map((p, i) => (
                      <li key={p} className={pill}>
                        <span aria-hidden="true" className={`${numberBadge} size-6 text-[12px]`}>
                          {i + 1}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {story.points.map((p) => (
                      <li key={p} className={pill}>
                        <span className="mt-0.5 flex-none">
                          <Glyph name="check" size={18} />
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </div>

          <div className="relative mx-5 mb-[max(20px,env(safe-area-inset-bottom))] flex h-11 flex-none items-center justify-center [@media(max-height:639px)]:mb-[max(12px,env(safe-area-inset-bottom))]">
            <span className="text-[13px] font-semibold tabular-nums" aria-live="polite">
              {index + 1} de {stories.length}
            </span>
            {last && (
              <button
                type="button"
                onClick={() => {
                  const toPlan = offerOnly;
                  close();
                  if (toPlan) router.push("/plan");
                }}
                className={`absolute right-0 h-11 rounded-full bg-ink px-5 text-[15px] font-semibold text-bg ${FOCUS}`}
              >
                {offerOnly ? "Ir al Plan" : "Empezar"}
              </button>
            )}
          </div>
        </div>

        {/* Anterior y siguiente: en el celular, abajo, sobre la tarjeta; en la computadora, a los costados. */}
        <button type="button" onClick={prev} disabled={index === 0} aria-label="Anterior" className={`${arrow} left-5 md:-left-16`}>
          <Glyph name="prev" />
        </button>
        {!last && (
          <button type="button" onClick={next} aria-label="Siguiente" className={`${arrow} right-5 md:-right-16`}>
            <Glyph name="next" />
          </button>
        )}
      </div>
    </div>
  );
}
