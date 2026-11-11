import type { CSSProperties, ReactNode } from "react";

// Mini versiones dibujadas de cada pantalla para las historias de bienvenida (WelcomeStories),
// animadas como un video en tres pasos: un dedo toca algo y se ve qué pasa. Los números (1, 2, 3)
// y los puntos de abajo de la historia (src/lib/intro/stories.ts) aparecen en el mismo paso.
// Datos de ejemplo. Son decorativas (aria-hidden): el texto de abajo dice lo mismo.
// Los estilos normales son el estado final: con "reducir movimiento" se ven completas y quietas.

/** When step n starts (seconds). */
export const stepAt = (n: number) => 0.5 + (n - 1) * 1.6;

/** Inline animation that starts at a given second and keeps its first frame until then. */
const anim = (name: string, at: number, seconds = 0.45, easing = "ease-out"): CSSProperties => ({
  animation: `${name} ${seconds}s ${easing} ${at}s both`,
});

function Marker({ n, className }: { n: number; className: string }) {
  return (
    <span
      className={`absolute z-20 grid size-6 place-items-center rounded-full bg-ink text-[12px] font-bold text-bg shadow-[0_0_0_3px_var(--surface)] ${className}`}
      style={anim("story-pop", stepAt(n))}
    >
      {n}
    </span>
  );
}

/** A finger that taps at a given second, then goes away. */
function Finger({ at, className }: { at: number; className: string }) {
  return (
    <span className={`pointer-events-none absolute z-30 text-[22px] opacity-0 ${className}`} style={anim("story-tap", at, 1.3, "ease-in-out")}>
      👆
    </span>
  );
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div aria-hidden="true" className="story-mock relative overflow-hidden rounded-[20px] bg-surface p-3 text-ink shadow-[0_8px_24px_var(--pop-shadow)]">
      <div className="mb-2 font-display text-[15px] font-semibold">{title}</div>
      {children}
    </div>
  );
}

// Inicio: el arco se llena, aparece el promedio y después lo que estás cursando.
function Inicio() {
  return (
    <Screen title="Inicio">
      <div className="flex items-center gap-3">
        <div className="relative">
          <svg width="112" height="64" viewBox="0 0 112 64">
            <path d="M8 58 A48 48 0 0 1 104 58" fill="none" stroke="var(--arc-track)" strokeWidth="12" strokeLinecap="round" />
            <path
              d="M8 58 A48 48 0 0 1 82 18"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray="120"
              strokeDashoffset="0"
              style={anim("story-arc", stepAt(1), 1.4)}
            />
          </svg>
          <span className="absolute inset-x-0 bottom-0 text-center text-[12px] leading-tight">
            <b className="font-display text-[17px]">142</b> de 248 C
          </span>
          <Marker n={1} className="-top-2 -left-2" />
        </div>
        <div className="relative flex-1 rounded-xl bg-butter p-2 text-butter-ink" style={anim("story-pop", stepAt(2))}>
          <div className="text-[10px] font-semibold uppercase">Promedio</div>
          <div className="font-display text-[24px] leading-none font-semibold">7,8</div>
          <Marker n={2} className="-top-2.5 -right-2" />
        </div>
      </div>
      <div className="relative mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-xl bg-sky p-2 text-sky-ink" style={anim("story-rise", stepAt(3))}>
          <b>Cursando</b>
          <div>Probabilidad · Física II</div>
        </div>
        <div className="rounded-xl bg-peach p-2 text-peach-ink" style={anim("story-rise", stepAt(3) + 0.25)}>
          <b>Finales</b>
          <div>Álgebra · Química</div>
        </div>
        <Marker n={3} className="-top-2.5 left-1/2 -translate-x-1/2" />
      </div>
    </Screen>
  );
}

function Node({ name, className, children, style }: { name: string; className: string; children?: ReactNode; style?: CSSProperties }) {
  return (
    <div className={`relative flex h-[46px] flex-col justify-between overflow-hidden rounded-lg px-1.5 py-1 text-[10px] leading-tight font-semibold ${className}`} style={style}>
      <span className="line-clamp-2">{name}</span>
      {children}
    </div>
  );
}

// Mapa: tocás Física II, se abre la ficha, elegís Aprobada y un 8, se pinta de verde y se
// habilita la que sigue.
function Mapa() {
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  return (
    <Screen title="Mapa">
      <div className="grid grid-cols-3 gap-1.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] text-muted">1.° cuat.</span>
          <Node name="Análisis II" className="bg-mint text-mint-ink">
            <span className="text-right">✓ 8</span>
          </Node>
          <Node name="Álgebra Lineal" className="bg-mint text-mint-ink">
            <span className="text-right">✓ 7</span>
          </Node>
        </div>
        <div className="relative flex flex-col gap-1.5">
          <span className="text-[10px] text-muted">2.° cuat.</span>
          <Node name="Probabilidad" className="bg-sky text-sky-ink">
            <span>Cursando</span>
          </Node>
          <Node name="Física II" className="border border-line-strong bg-surface">
            <span className="text-muted">Habilitada</span>
            {/* Al final queda aprobada: la capa verde aparece encima. */}
            <span className="absolute inset-0 flex flex-col justify-between bg-mint px-1.5 py-1 text-mint-ink" style={anim("story-fade", s3 + 0.5)}>
              <span>Física II</span>
              <span className="text-right">✓ 8</span>
            </span>
          </Node>
          <Finger at={stepAt(1)} className="top-[66px] right-0" />
          <Marker n={1} className="top-[52px] -left-2" />
        </div>
        <div className="relative flex flex-col gap-1.5">
          <span className="text-[10px] text-muted">3.° cuat.</span>
          <Node name="Estadística" className="bg-blocked text-blocked-ink">
            <span>🔒</span>
            <span className="absolute inset-0 flex flex-col justify-between border border-line-strong bg-surface px-1.5 py-1 text-ink" style={anim("story-pop", s3 + 0.9)}>
              <span>Estadística</span>
              <span className="text-muted">Habilitada</span>
            </span>
          </Node>
          <Node name="Economía" className="bg-blocked text-blocked-ink">
            <span>🔒</span>
          </Node>
          <Marker n={3} className="top-3 -right-1" />
        </div>
      </div>
      {/* La ficha de la materia sube, se elige "Aprobada" y la nota, y baja. */}
      <div
        className="absolute inset-x-0 bottom-0 z-10 translate-y-[110%] rounded-t-2xl border-t border-line bg-surface p-2.5 shadow-[0_-8px_20px_var(--pop-shadow)]"
        style={anim("story-sheet", s2 - 0.3, 2.4)}
      >
        <div className="text-[12px] font-semibold">Física II</div>
        <div className="mt-1.5 grid grid-cols-2 gap-1 text-[10.5px]">
          <span className="relative overflow-hidden rounded-md border border-line py-1 text-center">
            Aprobada
            <span className="absolute inset-0 grid place-items-center bg-accent-soft font-semibold shadow-[inset_0_0_0_1.5px_var(--accent)]" style={anim("story-fade", s2 + 0.5, 0.2)}>
              Aprobada
            </span>
          </span>
          <span className="rounded-md border border-line py-1 text-center">Cursando</span>
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-0.5 text-[10px]">
          {[4, 5, 6, 7, 8, 9, 10].map((g) => (
            <span key={g} className="relative overflow-hidden rounded border border-line py-0.5 text-center">
              {g}
              {g === 8 && (
                <span className="absolute inset-0 grid place-items-center bg-accent font-semibold text-on-accent" style={anim("story-fade", s2 + 1.2, 0.2)}>
                  8
                </span>
              )}
            </span>
          ))}
        </div>
        <Marker n={2} className="top-1 right-2" />
        <Finger at={s2 + 0.1} className="top-4 left-6" />
        <Finger at={s2 + 0.8} className="bottom-0 left-[58%]" />
      </div>
    </Screen>
  );
}

// Plan: tocás un curso, aparecen sus horarios en la semana; sumás otro que se pisa y te avisa.
function Plan() {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const s2 = stepAt(2);
  const s3 = stepAt(3);
  return (
    <Screen title="Plan">
      <div className="flex gap-2">
        <div className="relative flex w-[38%] flex-col gap-1.5 text-[10px]">
          {[
            ["Probabilidad", "Curso 2", "bg-sky text-sky-ink"],
            ["Física II", "Curso 1", "bg-mint text-mint-ink"],
            ["Economía", "Curso 3", "bg-peach text-peach-ink"],
          ].map(([n, c, k]) => (
            <div key={n} className={`rounded-lg px-1.5 py-1 ${k}`}>
              <b className="block">{n}</b>
              {c}
            </div>
          ))}
          <Finger at={stepAt(1)} className="top-3 right-0" />
          <Finger at={s3 - 0.2} className="top-[78px] right-0" />
          <Marker n={1} className="-top-2 -left-2" />
        </div>
        <div className="relative grid flex-1 grid-cols-5 gap-0.5">
          {days.map((d) => (
            <span key={d} className="text-center text-[9px] text-muted">
              {d}
            </span>
          ))}
          <div className="col-span-5 grid h-[96px] grid-cols-5 gap-0.5">
            {[0, 1, 2, 3, 4].map((d) => (
              <div key={d} className="relative rounded-md bg-bg">
                {(d === 0 || d === 2) && <span className="absolute inset-x-0 top-1 h-7 rounded bg-sky" style={anim("story-pop", s2 - 0.6 + d * 0.1)} />}
                {(d === 1 || d === 3) && <span className="absolute inset-x-0 top-9 h-8 rounded bg-mint" style={anim("story-pop", s2 + d * 0.1)} />}
                {d === 3 && (
                  <span className="absolute inset-x-0 top-12 h-8 rounded bg-peach/90 shadow-[0_0_0_2px_var(--danger)]" style={anim("story-pop", s3 + 0.4)} />
                )}
              </div>
            ))}
          </div>
          <span className="absolute -bottom-1 left-0 rounded-full bg-danger-soft px-1.5 text-[9.5px] font-semibold text-danger-ink" style={anim("story-rise", s3 + 0.8)}>
            ⚠ Jueves: se superponen
          </span>
          <Marker n={2} className="top-3 -left-2" />
          <Marker n={3} className="-right-1 bottom-2" />
        </div>
      </div>
    </Screen>
  );
}

// Reseñas: el puntaje, los comentarios y, al tocar "Dejar mi reseña", las estrellas se llenan.
function Resenas() {
  const s3 = stepAt(3);
  return (
    <Screen title="Reseñas">
      <div className="relative flex items-center gap-2.5 rounded-xl bg-bg p-2" style={anim("story-pop", stepAt(1))}>
        <div className="font-display text-[28px] leading-none font-semibold">4,6</div>
        <div className="text-[11px]">
          <div className="text-star">★★★★★</div>
          <div className="text-muted">Curso 2 · Pérez · 32 reseñas</div>
        </div>
        <Marker n={1} className="-top-2 -right-1" />
      </div>
      <div className="relative mt-2 flex flex-col gap-1.5 text-[11px]">
        <div className="rounded-xl border border-line p-2" style={anim("story-rise", stepAt(2))}>
          <span className="text-star">★★★★★</span> Explica muy bien y los parciales son justos.
        </div>
        <div className="rounded-xl border border-line p-2" style={anim("story-rise", stepAt(2) + 0.35)}>
          <span className="text-star">★★★★</span>☆ Mucha práctica, vale la pena ir a clase.
        </div>
        <Marker n={2} className="-top-2 -left-2" />
      </div>
      <div className="relative mt-2 flex items-center justify-between rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-on-accent">
        Tu reseña
        <span className="flex gap-0.5 text-[14px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="relative">
              <span className="opacity-40">★</span>
              <span className="absolute inset-0 text-star" style={anim("story-pop", s3 + 0.5 + i * 0.18, 0.25)}>
                ★
              </span>
            </span>
          ))}
        </span>
        <Finger at={s3} className="-top-1 right-3" />
        <Marker n={3} className="-top-2.5 -left-1" />
      </div>
    </Screen>
  );
}

// Finales: la mesa con día y hora; después se resaltan la inscripción y la baja.
function Finales() {
  return (
    <Screen title="Finales">
      <div className="flex flex-col gap-1.5 text-[11px]">
        {[
          ["9", "DIC", "17:00", "Álgebra Lineal"],
          ["14", "DIC", "9:00", "Química Básica"],
        ].map(([d, m, h, n], i) => (
          <div key={n} className="relative flex items-center gap-2 rounded-xl bg-bg p-1.5" style={anim("story-rise", stepAt(1) + i * 0.3)}>
            <span className="flex w-[52px] flex-none flex-col items-center rounded-lg bg-lavender py-1 leading-none text-lavender-ink">
              <span className="text-[9px] font-semibold">{m}</span>
              <b className="font-display text-[17px]">{d}</b>
              <span className="text-[9px]">{h}</span>
            </span>
            <span className="min-w-0 flex-1">
              <b className="block">{n}</b>
              <span className="relative inline-block rounded px-0.5">
                {i === 0 && <span className="absolute inset-0 rounded bg-butter" style={anim("story-fade", stepAt(2))} />}
                <span className="relative">Inscripción: 30/11 al 7/12</span>
              </span>
              <span className="relative block w-fit rounded px-0.5 text-[10px]">
                {i === 0 && <span className="absolute inset-0 rounded bg-peach" style={anim("story-fade", stepAt(3))} />}
                <span className="relative">Baja hasta el 8/12</span>
              </span>
            </span>
            {i === 0 && (
              <>
                <Marker n={1} className="-top-2 -left-2" />
                <Marker n={2} className="top-3 right-1" />
                <Marker n={3} className="-bottom-2 right-8" />
              </>
            )}
          </div>
        ))}
      </div>
    </Screen>
  );
}

// Novedades: el aviso fijado, el calendario con la barra de lo que está pasando y las noticias.
function Novedades() {
  return (
    <Screen title="Novedades">
      <div className="relative rounded-xl bg-butter p-2 text-[11px] text-butter-ink" style={anim("story-rise", stepAt(1))}>
        <b>📌 Inscripción a cursos de verano</b>
        <div>Del 9 al 14 de noviembre.</div>
        <Marker n={1} className="-top-2 -right-1" />
      </div>
      <div className="relative mt-2 grid grid-cols-2 gap-1.5 text-[10.5px]" style={anim("story-rise", stepAt(2))}>
        <div className="rounded-xl bg-mint p-2 text-mint-ink">
          <b className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-mint-ink motion-safe:animate-ping" /> Ahora
          </b>
          <div>Inscripción a finales</div>
          <span className="mt-1 block h-1.5 w-[70%] origin-left rounded-full bg-mint-ink" style={anim("story-grow", stepAt(2) + 0.4, 1.2)} />
        </div>
        <div className="rounded-xl border border-line p-2">
          <b>Se viene</b>
          <div>Receso de verano</div>
          <span className="mt-0.5 inline-block rounded-full bg-sky px-1.5 text-sky-ink">En 12 días</span>
        </div>
        <Marker n={2} className="-top-2.5 left-1/2 -translate-x-1/2" />
      </div>
      <div className="relative mt-2 flex items-center gap-2 rounded-xl border border-line p-1.5 text-[10.5px]" style={anim("story-rise", stepAt(3))}>
        <span className="h-9 w-14 flex-none rounded-lg bg-lavender" />
        <span>
          <b className="block">Noticias de la FIUBA</b>
          <span className="text-muted">La facultad lanza la credencial…</span>
        </span>
        <Marker n={3} className="-top-2 -right-1" />
      </div>
    </Screen>
  );
}

// Web: se recomienda la compu; la misma cuenta en los dos, lo que marcás en uno aparece en el otro.
function Web() {
  const s3 = stepAt(3);
  const subject = (late: number) => (
    <span className="relative block overflow-hidden rounded-md border border-line-strong bg-surface px-1.5 py-1 text-[9.5px] font-semibold">
      Física II
      <span className="absolute inset-0 flex items-center justify-between bg-mint px-1.5 text-mint-ink" style={anim("story-fade", s3 + late, 0.3)}>
        Física II <span>✓ 8</span>
      </span>
    </span>
  );
  return (
    <Screen title="Compu y celular">
      <div className="flex items-end justify-center gap-3">
        <div className="relative w-[64%]" style={anim("story-rise", stepAt(1))}>
          <div className="rounded-t-lg border-[3px] border-b-0 border-ink/80 bg-bg p-1.5">
            <div className="mb-1 truncate rounded bg-surface px-1 text-[8.5px] text-muted">fiubi.com.ar</div>
            <div className="grid grid-cols-3 gap-1">
              <span className="rounded-md bg-mint py-2" />
              {subject(0)}
              <span className="rounded-md bg-blocked py-2" />
            </div>
          </div>
          <div className="mx-[-8px] h-1.5 rounded-b-md bg-ink/80" />
          <span className="absolute -top-2.5 right-0 rounded-full bg-mint px-1.5 text-[9px] font-semibold text-mint-ink">Recomendada</span>
          <Marker n={1} className="-top-2 -left-2" />
          <Finger at={s3 - 0.4} className="top-6 left-[46%]" />
        </div>
        <div className="relative w-[24%]" style={anim("story-rise", stepAt(2))}>
          <div className="rounded-[12px] border-[3px] border-ink/80 bg-bg p-1 pb-3">
            <div className="mx-auto mb-1 h-1 w-5 rounded-full bg-ink/60" />
            <div className="flex flex-col gap-1">
              <span className="rounded-md bg-mint py-1.5" />
              {subject(0.6)}
            </div>
          </div>
          <Marker n={2} className="-top-2 -right-2" />
        </div>
      </div>
      <div className="relative mt-2 text-center text-[11px] font-semibold text-mint-ink" style={anim("story-rise", s3 + 0.7)}>
        ⇄ Se sincroniza solo
        <Marker n={3} className="-top-1 left-2" />
      </div>
    </Screen>
  );
}

const MOCKS: Record<string, () => ReactNode> = {
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
export function StoryMock({ id }: { id: string }) {
  const Mock = MOCKS[id];
  return Mock ? <Mock /> : null;
}
