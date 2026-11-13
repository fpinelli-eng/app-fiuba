import type { CSSProperties, ReactNode } from "react";
import { STATE_STYLE, StateIcon } from "@/app/(app)/mapa/icons";
import { NavIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";
import { StarIcon } from "@/components/Stars";
import { NAV, type NavIcon as NavIconName } from "@/lib/app";
import type { DisplayState } from "@/lib/map/model";

// Mini versiones dibujadas de cada pantalla para las historias de bienvenida (WelcomeStories),
// animadas como un video en tres pasos: un toque y se ve qué pasa. Los números (1, 2, 3) y los
// puntos de abajo de la historia (src/lib/intro/stories.ts) aparecen en el mismo paso.
// Se dibujan como la pantalla del celular (la barra de arriba, la de pestañas con la sección
// marcada) y con las mismas piezas de las pantallas reales: los colores de estado del mapa, los
// tramos del arco, las etiquetas de inscripción. Datos de ejemplo.
// Son decorativas (aria-hidden): el texto de abajo dice lo mismo.
// Los estilos normales son el estado final: con "reducir movimiento" se ven completas y quietas.

/** When step n starts (seconds). */
export const stepAt = (n: number) => 0.5 + (n - 1) * 1.6;

/** Arrivals slow down softly, without bounce. */
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

/** Inline animation that starts at a given second and keeps its first frame until then. */
const anim = (name: string, at: number, seconds = 0.5, easing = EASE): CSSProperties => ({
  animation: `${name} ${seconds}s ${easing} ${at}s both`,
});

/** Seconds from the start of a touch until it presses: what it touches reacts then. */
const PRESS = 0.55;

/** The number of a step: over a corner of what it points at, or (inline) right after it in the row. */
function Marker({ n, className = "", inline = false }: { n: number; className?: string; inline?: boolean }) {
  return (
    <span
      className={`${inline ? "flex-none" : "absolute"} z-20 grid size-5 place-items-center rounded-full bg-ink text-[11px] leading-none font-bold text-bg shadow-[0_0_0_2px_var(--surface)] ${className}`}
      style={anim("story-pop", stepAt(n), 0.4)}
    >
      {n}
    </span>
  );
}

/** A fingertip that lands at a given second, presses and goes away. */
function Touch({ at, className }: { at: number; className: string }) {
  return (
    <span className={`pointer-events-none absolute z-30 size-[22px] rounded-full opacity-0 ${className}`} style={anim("story-tap", at, 1.15, "ease-in-out")}>
      <span className="absolute inset-0 rounded-full border-2 border-ink/70 bg-ink/25 shadow-[0_0_0_1.5px_var(--surface)]" />
      <span className="absolute inset-0 rounded-full border-2 border-ink/60 opacity-0" style={anim("story-ripple", at, 1.15, "ease-out")} />
    </span>
  );
}

function Check({ size = 8 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const TABS = NAV.filter((item) => item.mobile === "tab").map((item) => item.icon);
// Con muy poco alto (celulares chicos con las barras del navegador) se saca el marco para que entre todo.
const CHROME = "[@media(max-height:639px)]:hidden";

/** The phone screen: top bar, the page and the tab bar with the section marked. */
function Phone({ active, initial, overlay, children }: { active: NavIconName; initial: string; overlay?: ReactNode; children: ReactNode }) {
  return (
    <div aria-hidden="true" className="story-mock relative overflow-hidden rounded-[22px] bg-bg text-ink shadow-[0_14px_28px_-14px_var(--card-shadow)]">
      <div className={`flex items-center justify-between px-3 pt-2.5 ${CHROME}`}>
        <Logo decorative className="h-[9px]" />
        <span className="flex items-center gap-1">
          <span
            className={`grid size-[18px] place-items-center rounded-full ${active === "bell" ? "bg-lavender text-lavender-ink" : "border border-line bg-surface text-muted"}`}
          >
            <NavIcon name="bell" size={10} />
          </span>
          <span className="grid size-[18px] place-items-center rounded-full bg-mint text-[8px] leading-none font-bold text-mint-ink">{initial}</span>
        </span>
      </div>
      <div className="relative px-3 pt-2 pb-2.5">{children}</div>
      <div className={`grid grid-cols-5 border-t border-line bg-surface px-2 py-[5px] ${CHROME}`}>
        {TABS.map((icon) => (
          <span key={icon} className="grid place-items-center">
            <span className={`grid h-[18px] w-8 place-items-center rounded-full ${icon === active ? "bg-lavender text-lavender-ink" : "text-muted"}`}>
              <NavIcon name={icon} size={12} />
            </span>
          </span>
        ))}
      </div>
      {overlay}
    </div>
  );
}

function PageTitle({ children }: { children: ReactNode }) {
  return <div className="truncate font-display text-[13px] leading-tight font-semibold tracking-[-0.01em]">{children}</div>;
}

const CARD = "rounded-[14px] bg-surface shadow-[0_8px_14px_-12px_var(--card-shadow)]";
const BORDERED = "rounded-[14px] border border-line bg-surface";

export interface MockProps {
  firstName: string;
  term: string | null;
}

// Inicio: el arco se llena tramo por tramo, aparecen el promedio y las aprobadas, y después la semana
// y los finales pendientes.
const ARC = "M12 56 A44 44 0 0 1 100 56";
// Tramos del arco (de 0 a 100), como en ProgressArc: CBC, obligatorias y electivas, uno tras otro.
const ARC_SEGMENTS = [
  { stroke: "stroke-cat-cbc", from: 0, len: 18, at: 0, seconds: 0.3 },
  { stroke: "stroke-cat-required", from: 18, len: 30, at: 0.3, seconds: 0.5 },
  { stroke: "stroke-cat-elective", from: 48, len: 9, at: 0.8, seconds: 0.25 },
];

function Inicio({ firstName }: MockProps) {
  const s1 = stepAt(1);
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  return (
    <Phone active="home" initial={firstName.charAt(0) || "F"}>
      <PageTitle>{firstName ? `Hola, ${firstName}` : "Hola"}</PageTitle>
      <div className="mt-2 grid grid-cols-[1.35fr_1fr] gap-1.5">
        <div className={`relative px-2 pt-1.5 pb-2 ${CARD}`}>
          <div className="text-[9.5px] leading-tight font-semibold">Avance de la carrera</div>
          <div className="relative mx-auto mt-1.5 w-[108px]">
            <svg viewBox="0 0 112 62" className="block h-auto w-full">
              <path d={ARC} fill="none" className="stroke-arc-track" strokeWidth="9" strokeLinecap="round" />
              <circle cx="12" cy="56" r="4.5" className="fill-cat-cbc" style={anim("story-fade", s1, 0.15)} />
              {ARC_SEGMENTS.map((seg) => (
                <path
                  key={seg.stroke}
                  d={ARC}
                  pathLength={100}
                  fill="none"
                  className={seg.stroke}
                  strokeWidth="9"
                  strokeDasharray={`${seg.len} 100`}
                  strokeDashoffset={-seg.from}
                  style={anim("story-arc", s1 + seg.at, seg.seconds, "linear")}
                />
              ))}
              <circle cx="65.6" cy="13.1" r="6" strokeWidth="3" className="fill-surface stroke-ink" style={anim("story-fade", s1 + 1, 0.25)} />
            </svg>
            <div className="absolute inset-x-0 bottom-0 text-center font-display text-[17px] leading-none font-medium tracking-[-0.03em]" style={anim("story-fade", s1 + 0.4)}>
              57<span className="text-[9px]">%</span>
            </div>
          </div>
          <div className="mt-1 text-center text-[9px] leading-tight text-muted">142 de 248 créditos</div>
          <Marker n={1} className="top-7 -left-1.5" />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="relative flex flex-1 flex-col justify-center rounded-[14px] bg-mint px-2 py-1" style={anim("story-pop", s2)}>
            <div className="text-[9.5px] leading-tight font-semibold text-mint-ink">Promedio</div>
            <div className="font-display text-[18px] leading-[1.2] font-medium tracking-[-0.03em]">7,8</div>
            <Marker n={2} className="-top-1.5 -right-1.5" />
          </div>
          <div className="flex flex-1 flex-col justify-center rounded-[14px] bg-lavender px-2 py-1 text-lavender-ink" style={anim("story-pop", s2 + 0.12)}>
            <div className="text-[9.5px] leading-tight font-semibold">Aprobadas</div>
            <div className="font-display text-[18px] leading-[1.2] font-medium tracking-[-0.03em] text-ink">18</div>
          </div>
        </div>
      </div>
      <div className="relative mt-1.5 grid grid-cols-2 gap-1.5">
        <div className={`p-2 ${CARD}`} style={anim("story-rise", s3)}>
          <div className="text-[9.5px] leading-tight font-semibold">Tu semana</div>
          <div className="mt-1 rounded-md border border-sky-line bg-sky px-1.5 py-1 text-[9px] leading-tight text-sky-ink">
            <b className="block font-semibold">Probabilidad</b>
            Lun 18–22 hs
          </div>
        </div>
        <div className={`p-2 ${CARD}`} style={anim("story-rise", s3 + 0.12)}>
          <div className="text-[9.5px] leading-tight font-semibold">Finales pendientes</div>
          <div className="mt-1 flex flex-col gap-1 text-[9px] leading-tight">
            <span className="flex justify-between gap-1">
              Álgebra II <span className="text-muted">destraba 2</span>
            </span>
            <span>Química</span>
          </div>
        </div>
        <Marker n={3} className="-top-2 left-1/2 -translate-x-1/2" />
      </div>
    </Phone>
  );
}

function MapRow({ state, name, note, className = "", style }: { state: DisplayState; name: string; note: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex h-[26px] items-center gap-1.5 rounded-lg px-2 text-[10px] leading-none ${STATE_STYLE[state]} ${className}`} style={style}>
      <StateIcon state={state} size={10} />
      <span className="flex-auto font-semibold">{name}</span>
      {note}
    </div>
  );
}

const STATE_NOTE = "text-[9px]";
const GRADE = <span className="text-[12px] font-bold">8</span>;

// Mapa: tocás Física II, sube la ficha, elegís Aprobada y un 8, la ficha baja, la materia queda
// aprobada y se habilita la que sigue.
function Mapa({ firstName }: MockProps) {
  const s1 = stepAt(1);
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  const pickState = s2 + 0.05;
  const pickGrade = s2 + 0.7;
  // La ficha arranca y termina abajo, fuera de la pantalla. Va con `transform` (no con la clase translate-y
  // de Tailwind, que usa la propiedad `translate` y la animación no la pisaría).
  const sheet = (
    <div
      className="absolute inset-x-0 bottom-0 z-10 [transform:translateY(105%)] rounded-t-[16px] border-t border-line bg-surface px-3 pt-1.5 pb-3 shadow-[0_-10px_24px_var(--pop-shadow)]"
      style={anim("story-sheet", s2 - 0.35, 2.3, "cubic-bezier(0.3, 0, 0.2, 1)")}
    >
      <div className="mx-auto h-[3px] w-6 rounded-full bg-line-strong" />
      <div className="mt-1.5 flex items-baseline justify-between text-[11px] leading-tight font-semibold">
        Física II <span className="text-[9px] font-normal text-muted">8 C</span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-[9.5px] leading-none">
        {["Aprobada", "Final pend.", "Cursando"].map((label, i) => (
          <span key={label} className="relative rounded-md border border-line-strong py-[5px] text-center">
            {label}
            {i === 0 && (
              <span
                className="absolute -inset-px grid place-items-center rounded-md bg-accent-soft font-semibold shadow-[inset_0_0_0_1.5px_var(--accent)]"
                style={anim("story-fade", pickState + PRESS, 0.15)}
              >
                {label}
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-[3px] text-[10px] leading-none font-semibold">
        {[4, 5, 6, 7, 8, 9, 10].map((g) => (
          <span key={g} className="relative rounded-[5px] border border-line py-1 text-center">
            {g}
            {g === 8 && (
              <span className="absolute -inset-px grid place-items-center rounded-[5px] bg-accent text-on-accent" style={anim("story-fade", pickGrade + PRESS, 0.15)}>
                8
              </span>
            )}
          </span>
        ))}
      </div>
      <Marker n={2} className="-top-2.5 right-3" />
      <Touch at={pickState} className="top-[32px] left-[21%]" />
      <Touch at={pickGrade} className="bottom-0.5 left-[60%]" />
    </div>
  );
  return (
    <Phone active="map" initial={firstName.charAt(0) || "F"} overlay={sheet}>
      <PageTitle>Mapa de la carrera</PageTitle>
      <div className={`mt-2 flex flex-col gap-1 p-1.5 ${BORDERED}`}>
        <div className="px-1 text-[10px] leading-tight font-semibold">
          3.er cuatrimestre
        </div>
        <MapRow state="approved" name="Análisis II" note={GRADE} />
        <div className="relative">
          <MapRow state="enabled" name="Física II" note={<span className={STATE_NOTE}>Habilitada</span>} />
          {/* Al final queda aprobada: la fila verde aparece encima. */}
          <MapRow state="approved" name="Física II" note={GRADE} className="absolute inset-0" style={anim("story-fade", s3 + 0.3, 0.35)} />
          {/* Elegida: el contorno de la fila mientras la ficha está abierta. */}
          <span className="absolute -inset-px rounded-lg opacity-0 shadow-[0_0_0_2px_var(--accent)]" style={anim("story-pick", s1 + PRESS, 3.2, "linear")} />
          <Touch at={s1} className="top-0.5 left-[55%]" />
          <Marker n={1} className="-top-2 -left-3.5" />
        </div>
        <div className="mt-0.5 px-1 text-[10px] leading-tight font-semibold">
          4.º cuatrimestre
        </div>
        <div className="relative">
          <MapRow state="blocked" name="Física III" note={<span className={STATE_NOTE}>Bloqueada</span>} />
          <MapRow state="enabled" name="Física III" note={<span className={STATE_NOTE}>Habilitada</span>} className="absolute inset-0" style={anim("story-fade", s3 + 0.65, 0.35)} />
          <Marker n={3} className="-top-2 -right-3.5" />
        </div>
      </div>
    </Phone>
  );
}

// Plan: elegís dos cursos y aparecen en la semana; sumás un tercero que se pisa el jueves y te avisa.
const PLAN_COURSES = [
  { name: "Probabilidad", course: "Curso 2", bg: "bg-sky", ink: "text-sky-ink", dot: "bg-sky-ink" },
  { name: "Física II", course: "Curso 1", bg: "bg-mint", ink: "text-mint-ink", dot: "bg-mint-ink" },
  { name: "Economía", course: "Curso 3", bg: "bg-peach", ink: "text-peach-ink", dot: "bg-peach-ink" },
];
// Qué cursos tiene cada día (índices de PLAN_COURSES): el jueves se pisan Física II y Economía.
const PLAN_DAYS: [string, number[]][] = [
  ["Lun", [0]],
  ["Mar", [1]],
  ["Mié", [0]],
  ["Jue", [1, 2]],
  ["Vie", []],
];

function Plan({ firstName, term }: MockProps) {
  const s1 = stepAt(1);
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  // Cuándo se toca cada curso: los dos primeros en el paso 1, el tercero al empezar el paso 3.
  const touches = [s1, s1 + 0.6, s3 - 0.3];
  const dotAt = (course: number, day: number) => (course === 2 ? touches[2] + PRESS + 0.1 : s2 + day * 0.07);
  return (
    <Phone active="calendar" initial={firstName.charAt(0) || "F"}>
      <PageTitle>Armá tu {term ?? "cuatrimestre"}</PageTitle>
      <div className={`relative mt-2 ${BORDERED}`}>
        {PLAN_COURSES.map((c, i) => (
          <div key={c.name} className="relative flex h-6 items-center gap-1.5 border-t border-line pr-2 pl-3.5 text-[10px] leading-none first:border-t-0">
            <span className="relative size-3 flex-none rounded-full border-[1.5px] border-line-strong">
              <span className={`absolute -inset-[1.5px] grid place-items-center rounded-full ${c.bg} ${c.ink}`} style={anim("story-pop", touches[i] + PRESS, 0.3)}>
                <Check size={7} />
              </span>
            </span>
            <span className="flex-auto font-semibold">{c.name}</span>
            <span className="text-[9px] text-muted">{c.course}</span>
            <Touch at={touches[i]} className="top-px left-[38%]" />
          </div>
        ))}
        <Marker n={1} className="-top-2.5 -left-2.5" />
      </div>
      <div className="relative mt-1.5 grid grid-cols-5 gap-1">
        {PLAN_DAYS.map(([day, courses], d) => (
          <span
            key={day}
            className={`relative flex h-[26px] flex-col items-center justify-center gap-[3px] rounded-lg border text-[9px] leading-none ${
              day === "Jue" ? "border-transparent bg-lavender font-semibold text-lavender-ink" : "border-line bg-surface text-ink-2"
            }`}
          >
            {day}
            <span className="flex h-1 gap-0.5">
              {courses.map((c) => (
                <span key={c} className={`size-1 rounded-full ${PLAN_COURSES[c].dot}`} style={anim("story-pop", dotAt(c, d), 0.3)} />
              ))}
            </span>
            {courses.length > 1 && <span className="absolute top-0.5 right-0.5 size-[5px] rounded-full bg-danger" style={anim("story-pop", s3 + 0.5, 0.3)} />}
          </span>
        ))}
        <Marker n={2} className="-top-2 -left-2" />
      </div>
      <div className="relative mt-1.5 flex flex-col gap-1 text-[9.5px] leading-none">
        <div className="flex h-6 items-center gap-2 rounded-lg border border-mint-line bg-mint px-2 text-mint-ink" style={anim("story-rise", s2 + 0.3)}>
          <b className="font-semibold">18:00</b>
          <span className="flex-auto font-semibold">Física II</span>
        </div>
        <div className="flex h-6 items-center gap-2 rounded-lg border-[1.5px] border-danger bg-peach px-2 text-peach-ink" style={anim("story-rise", s3 + 0.35)}>
          <b className="font-semibold">19:00</b>
          <span className="flex-auto font-semibold">Economía</span>
          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[8.5px] font-semibold text-danger">Se superpone</span>
        </div>
        <Marker n={3} className="-right-2 -bottom-2" />
      </div>
    </Phone>
  );
}

function StarOutline({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="block fill-none stroke-star" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
    </svg>
  );
}

function MiniStars({ value }: { value: number }) {
  return (
    <span className="flex gap-px">
      {[1, 2, 3, 4, 5].map((k) => (k <= value ? <StarIcon key={k} size={9} /> : <StarOutline key={k} size={9} />))}
    </span>
  );
}

// Reseñas: la ficha de un curso con su puntaje, los comentarios y, al tocar las estrellas, tu reseña.
function Resenas({ firstName }: MockProps) {
  const s1 = stepAt(1);
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  return (
    <Phone active="star" initial={firstName.charAt(0) || "F"}>
      <PageTitle>Curso 2</PageTitle>
      <div className="text-[9px] leading-tight text-muted">Probabilidad · Pérez, García</div>
      <div className={`relative mt-1.5 flex items-center gap-2.5 px-2.5 py-1.5 ${BORDERED}`} style={anim("story-pop", s1)}>
        <div>
          <div className="font-display text-[22px] leading-none font-medium tracking-[-0.03em]">4,6</div>
          <div className="mt-1 text-[8.5px] leading-none text-muted">32 reseñas</div>
        </div>
        <div className="flex flex-auto flex-col gap-[3px]">
          {[72, 18, 6, 2, 2].map((pct, i) => (
            <span key={i} className="flex items-center gap-1 text-[7.5px] leading-none text-muted">
              {5 - i}
              <span className="h-[3px] flex-auto overflow-hidden rounded-full bg-disabled">
                <span className="block h-full origin-left rounded-full bg-star" style={{ width: `${pct}%`, ...anim("story-grow", s1 + 0.2 + i * 0.06, 0.6) }} />
              </span>
            </span>
          ))}
        </div>
        <Marker n={1} className="-top-2 -right-2" />
      </div>
      <div className={`relative mt-1.5 px-2.5 text-[9.5px] leading-snug text-ink-2 ${BORDERED}`}>
        <div className="flex flex-col gap-0.5 py-1" style={anim("story-rise", s2)}>
          <MiniStars value={5} />
          Explica muy bien y los parciales son justos.
        </div>
        <div className={`flex flex-col gap-0.5 border-t border-disabled py-1 ${CHROME}`} style={anim("story-rise", s2 + 0.2)}>
          <MiniStars value={4} />
          Mucha práctica: conviene ir a clase.
        </div>
        <Marker n={2} className="-top-2 -left-2" />
      </div>
      <div className={`relative mt-1.5 flex items-center justify-between gap-2 py-1 pr-1 pl-2.5 ${BORDERED}`}>
        <span className="relative flex gap-0.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="relative">
              <StarOutline size={14} />
              <span className="absolute inset-0" style={anim("story-pop", s3 + PRESS + i * 0.05, 0.3)}>
                <StarIcon size={14} />
              </span>
            </span>
          ))}
          <Touch at={s3} className="-top-1 -right-1" />
        </span>
        <span className="rounded-md bg-accent px-2 py-[5px] text-[9px] leading-none font-semibold text-on-accent">Enviar reseña</span>
        <Marker n={3} className="-top-2 -left-2" />
      </div>
    </Phone>
  );
}

// Finales: las mesas con día y hora; después la inscripción y hasta cuándo darse de baja.
function Finales({ firstName }: MockProps) {
  const s1 = stepAt(1);
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  const chip = "w-fit rounded-full px-1.5 py-0.5 text-[8.5px] leading-tight font-semibold";
  return (
    <Phone active="exam" initial={firstName.charAt(0) || "F"}>
      <div className="flex items-center justify-between gap-2">
        <PageTitle>Finales</PageTitle>
        <span className="rounded-full border border-line-strong bg-surface px-2 py-[3px] text-[8.5px] leading-none font-semibold">Recordarme</span>
      </div>
      <div className={`mt-2 px-2.5 ${BORDERED}`}>
        <div className="pt-2 text-[10.5px] leading-tight font-semibold">Tus finales pendientes</div>
        <div className="flex flex-col gap-1 py-2 text-[9.5px] leading-tight">
          <b className="font-semibold">Álgebra Lineal</b>
          <span className="flex items-center gap-1.5">
            <span className="text-ink-2" style={anim("story-rise", s1)}>
              <b className="font-semibold">Mié 9/12</b> · 17:00
            </span>
            <Marker n={1} inline />
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`${chip} bg-mint text-mint-ink`} style={anim("story-pop", s2)}>
              Inscripción abierta hasta el 7/12
            </span>
            <Marker n={2} inline />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted" style={anim("story-fade", s3)}>
              Te podés dar de baja hasta el 8/12
            </span>
            <Marker n={3} inline />
          </span>
        </div>
        <div className="flex flex-col gap-1 border-t border-line py-2 text-[9.5px] leading-tight">
          <b className="font-semibold">Química Básica</b>
          <span className="text-ink-2" style={anim("story-rise", s1 + 0.15)}>
            <b className="font-semibold">Lun 14/12</b> · 9:00
          </span>
          <span className={`${chip} bg-butter text-butter-ink`} style={anim("story-pop", s2 + 0.15)}>
            Inscripción desde el 5/12
          </span>
        </div>
      </div>
    </Phone>
  );
}

// Novedades: el aviso fijado, las próximas fechas (lo que está pasando y lo que viene) y las noticias.
function Novedades({ firstName }: MockProps) {
  const s1 = stepAt(1);
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  return (
    <Phone active="bell" initial={firstName.charAt(0) || "F"}>
      <PageTitle>Novedades</PageTitle>
      <div className={`relative mt-2 px-2.5 py-2 text-[9.5px] leading-tight ${BORDERED}`} style={anim("story-rise", s1)}>
        <span className="mr-1.5 rounded-full bg-butter px-1.5 py-0.5 text-[8.5px] font-semibold text-butter-ink">Fijado</span>
        <b className="font-semibold">Inscripción a cursos de verano</b>
        <div className="mt-1 text-ink-2">Del 9 al 14 de diciembre, por el SIU.</div>
        <Marker n={1} className="-top-2 -right-2" />
      </div>
      <div className="relative mt-1.5 grid grid-cols-2 gap-1.5 text-[9.5px] leading-tight" style={anim("story-rise", s2)}>
        <div className="flex flex-col gap-1.5 rounded-[14px] bg-mint p-2 text-mint-ink">
          <b className="font-semibold">Inscripción a finales</b>
          <span className="mt-auto flex flex-col gap-1">
            <span className="h-1 overflow-hidden rounded-full bg-surface/70">
              <span className="block h-full w-[62%] origin-left rounded-full bg-mint-ink" style={anim("story-grow", s2 + 0.3, 0.9)} />
            </span>
            <span className="text-[8.5px] font-semibold">Quedan 4 días</span>
          </span>
        </div>
        <div className={`flex flex-col gap-1.5 p-2 ${BORDERED}`}>
          <span className="flex items-start justify-between gap-1">
            <span className="flex w-7 flex-col items-center rounded-md bg-lavender py-0.5 leading-none text-lavender-ink">
              <span className="text-[7px] font-semibold uppercase">dic</span>
              <span className="font-display text-[11px] font-semibold">21</span>
            </span>
            <span className="rounded-full bg-sky px-1.5 py-0.5 text-[8px] font-semibold whitespace-nowrap text-sky-ink">En 12 días</span>
          </span>
          <b className="font-semibold">Receso de verano</b>
        </div>
        <Marker n={2} className="-top-2.5 left-1/2 -translate-x-1/2" />
      </div>
      <div className={`relative mt-1.5 flex items-center gap-2 p-1.5 text-[9.5px] leading-tight ${BORDERED}`} style={anim("story-rise", s3)}>
        <span className="grid h-8 w-14 flex-none place-items-center rounded-lg bg-lavender text-lavender-ink">
          {/* La foto de la noticia: un paisaje dibujado. */}
          <svg width="22" height="16" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 14l6-7 4 4.5 3-3L21 14" />
            <circle cx="16" cy="3.5" r="1.5" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block text-[8.5px] text-muted">Noticias de la FIUBA · hoy</span>
          <b className="block truncate font-semibold">Charla abierta en Paseo Colón</b>
        </span>
        <Marker n={3} className="-top-2 -right-2" />
      </div>
    </Phone>
  );
}

// Web: se recomienda la compu; la misma cuenta en los dos, lo que marcás en uno aparece en el otro.
function Web() {
  const s1 = stepAt(1);
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  const touch = s3 - 0.35;
  const cell = "flex h-[18px] items-center gap-[3px] overflow-hidden rounded-md px-1 text-[7.5px] leading-none font-semibold whitespace-nowrap";
  const subject = (late: number) => (
    <span className="relative block">
      <span className={`${cell} ${STATE_STYLE.enabled}`}>Física II</span>
      <span className={`absolute inset-0 ${cell} ${STATE_STYLE.approved}`} style={anim("story-fade", touch + PRESS + late, 0.3)}>
        <Check size={7} />
        Física II
      </span>
    </span>
  );
  return (
    <div aria-hidden="true" className="story-mock relative rounded-[22px] bg-bg px-4 pt-5 pb-3 text-ink shadow-[0_14px_28px_-14px_var(--card-shadow)]">
      <div className="flex items-end justify-center gap-4">
        <div className="relative w-[62%]" style={anim("story-rise", s1)}>
          <div className="rounded-t-[10px] border-[2.5px] border-b-0 border-ink-2 bg-surface p-1.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Logo decorative className="h-[6px]" />
              <span className="flex-auto truncate rounded-full bg-bg px-1.5 py-px text-[8px] leading-tight text-muted">fiubi.com.ar</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <span className={`h-[18px] rounded-md ${STATE_STYLE.approved}`} />
              {subject(0)}
              <span className={`h-[18px] rounded-md ${STATE_STYLE.blocked}`} />
              <span className={`h-[18px] rounded-md ${STATE_STYLE.approved}`} />
              <span className={`h-[18px] rounded-md ${STATE_STYLE.in_progress}`} />
              <span className={`h-[18px] rounded-md ${STATE_STYLE.blocked}`} />
            </div>
          </div>
          <div className="-mx-2.5 h-1.5 rounded-b-md bg-ink-2" />
          <Marker n={1} className="-top-2 -left-2" />
          <Touch at={touch} className="top-[26px] left-[44%]" />
        </div>
        <div className="relative w-[22%]" style={anim("story-rise", s2)}>
          <div className="rounded-[12px] border-[2.5px] border-ink-2 bg-surface px-1 pt-1 pb-2.5">
            <div className="mx-auto mb-1 h-[3px] w-4 rounded-full bg-line-strong" />
            <div className="flex flex-col gap-1">
              <span className={`h-[18px] rounded-md ${STATE_STYLE.approved}`} />
              {subject(0.5)}
            </div>
          </div>
          <Marker n={2} className="-top-2 -right-2" />
        </div>
      </div>
      <div className="relative mx-auto mt-2.5 flex w-fit items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-[10px] leading-none font-semibold text-mint-ink" style={anim("story-rise", touch + PRESS + 0.6)}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 9h14l-4-4M20 15H6l4 4" />
        </svg>
        Se sincroniza solo
        <Marker n={3} className="-top-2 -left-3.5" />
      </div>
    </div>
  );
}

const MOCKS: Record<string, (props: MockProps) => ReactNode> = {
  web: Web,
  inicio: Inicio,
  mapa: Mapa,
  plan: Plan,
  resenas: Resenas,
  finales: Finales,
  novedades: Novedades,
};

export const hasStoryMock = (id: string) => id in MOCKS;

/** The drawn screen of a story, or null when the story has none. */
export function StoryMock({ id, firstName, term }: { id: string } & MockProps) {
  const Mock = MOCKS[id];
  return Mock ? <Mock firstName={firstName} term={term} /> : null;
}
