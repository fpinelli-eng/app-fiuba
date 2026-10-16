"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { analyzePlan } from "@/lib/plan/analyze";
import { describeSchedule, formatHour, formatHours, isVirtualRoom } from "@/lib/plan/format";
import { WEEK_DAYS, type ClassBlock, type WeekDay } from "@/lib/plan/options";
import type { Entry, OptionKey, PlanCourse, PlanData, PlanSubject, Score, SubjectGroup } from "@/lib/plan/data";
import { enrollInCourses, savePlanOption } from "./actions";

// Pantalla del plan del cuatrimestre (prototipo docs/diseno/prototipos/07-plan.html).
// Cada cambio se guarda solo en la base (plan_choices), como en el mapa.

const GROUP_TITLE: Record<SubjectGroup, string> = {
  obligatorias: "OBLIGATORIAS",
  electivas: "ELECTIVAS",
  otras: "OTRAS MATERIAS DE LA OFERTA",
};

// Un color pastel por materia, en el orden en que entran al plan.
const PALETTE = [
  { bg: "bg-lavender", ink: "text-lavender-ink", border: "border-lavender-ink/25" },
  { bg: "bg-mint", ink: "text-mint-ink", border: "border-mint-ink/25" },
  { bg: "bg-butter", ink: "text-butter-ink", border: "border-butter-ink/25" },
  { bg: "bg-sky", ink: "text-sky-ink", border: "border-sky-ink/25" },
  { bg: "bg-peach", ink: "text-peach-ink", border: "border-peach-ink/25" },
  { bg: "bg-pink", ink: "text-pink-ink", border: "border-pink-ink/25" },
  { bg: "bg-teal", ink: "text-teal-ink", border: "border-teal-ink/25" },
] as const;
type Color = (typeof PALETTE)[number];

const CAMPUS_SHORT: Record<string, string> = {
  "Paseo Colón": "PC",
  "Las Heras": "LH",
  "Ciudad Universitaria": "CU",
};

const DAY_LONG: Record<WeekDay, string> = {
  Lunes: "lunes",
  Martes: "martes",
  Miércoles: "miércoles",
  Jueves: "jueves",
  Viernes: "viernes",
  Sábado: "sábado",
  Domingo: "domingo",
};

const FIRST_HOUR = 7;
const LAST_HOUR = 23;
const HOUR_PX = 38;

const removeAccents = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const overlaps = (a: ClassBlock, b: ClassBlock) => a.day === b.day && a.start < b.end && b.start < a.end;

export function PlanBuilder({ data }: { data: PlanData }) {
  const [active, setActive] = useState<OptionKey>("A");
  const [plans, setPlans] = useState<Record<OptionKey, Entry[]>>(data.saved);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Los guardados van en fila: así el último cambio es el que queda.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const [enrolled, setEnrolled] = useState<string[]>(data.enrolled);
  const [enrollState, setEnrollState] = useState<"idle" | "saving" | "error">("idle");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<Entry | null>(null);

  const subjects = useMemo(() => new Map(data.subjects.map((s) => [s.code, s])), [data.subjects]);
  const courseOf = (e: Entry) => subjects.get(e.subject)?.courses.find((c) => c.id === e.course);

  const plan = plans[active];
  const selected = plan
    .map((e, i) => ({ subject: subjects.get(e.subject), course: courseOf(e), color: PALETTE[i % PALETTE.length] }))
    .filter((s): s is { subject: PlanSubject; course: PlanCourse; color: Color } => !!s.subject && !!s.course);
  const colorOf = new Map(selected.map((s) => [s.subject.code, s.color]));
  const nameOfCourse = new Map(selected.map((s) => [s.course.id, s.subject.name]));

  const analysis = analyzePlan(selected.map((s) => ({ option: s.course, credits: s.subject.credits ?? undefined })));

  const setPlan = (next: Entry[]) => {
    setPlans({ ...plans, [active]: next });
    const option = active;
    const ids = next.map((e) => e.course);
    setSaveState("saving");
    saving.current = saving.current
      .then(() => savePlanOption(option, ids))
      .then((r) => setSaveState(r.error ? "error" : "saved"))
      .catch(() => setSaveState("error"));
  };
  const pick = (subject: string, course: string) => {
    const current = plan.find((e) => e.subject === subject);
    if (current?.course === course) setPlan(plan.filter((e) => e.subject !== subject));
    else if (current) setPlan(plan.map((e) => (e.subject === subject ? { subject, course } : e)));
    else setPlan([...plan, { subject, course }]);
    setHover(null);
  };
  const planCourses = plan.map((e) => e.course);
  const isEnrolledHere =
    planCourses.length > 0 && planCourses.length === enrolled.length && planCourses.every((c) => enrolled.includes(c));
  const enroll = () => {
    setEnrollState("saving");
    // After any pending save, so both go in order.
    saving.current = saving.current
      .then(() => enrollInCourses(planCourses))
      .then((r) => {
        if (r.error) return setEnrollState("error");
        setEnrolled(planCourses);
        setEnrollState("idle");
      })
      .catch(() => setEnrollState("error"));
  };

  const toggleOpen = (code: string) => {
    const next = new Set(open);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setOpen(next);
  };

  const warnings = [
    ...analysis.overlaps.map((o) => ({
      kind: "overlap" as const,
      text: `Superposición el ${DAY_LONG[o.day]} de ${formatHour(o.start)} a ${formatHour(o.end)} hs: ${nameOfCourse.get(o.courseIds[0])} y ${nameOfCourse.get(o.courseIds[1])}`,
    })),
    ...analysis.rushedTransfers.map((t) => ({
      kind: "transfer" as const,
      text: `Traslado apurado el ${DAY_LONG[t.day]}: salís de ${t.from} a las ${formatHour(t.leaveAt)} hs y entrás en ${t.to} a las ${formatHour(t.arriveAt)} hs`,
    })),
  ];

  const q = removeAccents(query.trim());
  const visible = data.subjects.filter((s) => !q || removeAccents(s.name).includes(q));
  const groups = (Object.keys(GROUP_TITLE) as SubjectGroup[])
    .map((g) => ({ group: g, subjects: visible.filter((s) => s.group === g) }))
    .filter((g) => g.subjects.length > 0);

  const ghost = hover && !plan.some((e) => e.subject === hover.subject && e.course === hover.course) ? courseOf(hover) : undefined;

  if (data.subjects.length === 0) return <NoOffer term={data.term} career={data.career} />;

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.01em]">Armá tu {data.term}</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {data.career}
            {saveState === "saving" && " · Guardando…"}
            {saveState === "saved" && " · Guardado"}
            {saveState === "error" && <span className="text-danger"> · No pudimos guardar el último cambio</span>}
          </p>
        </div>
        <div role="tablist" aria-label="Opciones" className="flex gap-1.5 rounded-xl border border-line bg-surface p-1">
          {(["A", "B"] as const).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={active === k}
              onClick={() => {
                setActive(k);
                setHover(null);
              }}
              className={`h-9 rounded-[9px] px-4 text-sm ${
                active === k ? "bg-lavender font-semibold text-lavender-ink" : "text-muted hover:text-ink"
              }`}
            >
              Opción {k} <span className="font-normal opacity-80">· {plans[k].length} mat.</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Pill value={String(analysis.subjects)} label="materias" />
          <Pill value={String(analysis.credits)} label="créditos" />
          <Pill
            value={formatHours(analysis.weeklyMinutes)}
            label={`h por semana${analysis.asyncMinutes ? ` + ${formatHours(analysis.asyncMinutes)} h asincrónicas` : ""}`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {enrollState === "error" && <span className="text-[13px] text-danger">No pudimos guardar tu cursada</span>}
          {isEnrolledHere ? (
            <span className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-mint px-3.5 text-[13.5px] font-semibold text-mint-ink">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Te inscribiste en esta opción
            </span>
          ) : (
            planCourses.length > 0 && (
              <button
                onClick={enroll}
                disabled={enrollState === "saving"}
                className="h-[38px] rounded-[10px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink"
              >
                {enrollState === "saving" ? "Guardando…" : "Me inscribí en esta opción"}
              </button>
            )
          )}
          <button
            onClick={() => setPlan([])}
            className="h-[38px] rounded-[10px] border border-line bg-surface px-3.5 text-[13.5px] text-muted hover:text-ink"
          >
            Vaciar plan
          </button>
        </div>
      </div>

      <div className="flex items-stretch gap-4">
        <aside
          aria-label="Materias que podés cursar"
          className="flex h-[760px] flex-[0_0_390px] flex-col rounded-2xl border border-line bg-surface"
        >
          <div className="flex flex-col gap-1.5 border-b border-line px-4 pt-4 pb-2.5">
            <h2 className="text-[17px] font-semibold">Materias que podés cursar</h2>
            <label htmlFor="buscar-materia" className="sr-only">
              Buscar materia
            </label>
            <input
              id="buscar-materia"
              type="search"
              placeholder="Buscar materia"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-[38px] rounded-[9px] border border-line-strong bg-surface px-3 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {groups.map(({ group, subjects: list }) => (
              <section key={group}>
                <h3 className="mx-1 mt-4 mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted">
                  {GROUP_TITLE[group]}
                </h3>
                {list.map((subject) => (
                  <SubjectRow
                    key={subject.code}
                    subject={subject}
                    chosen={plan.find((e) => e.subject === subject.code)?.course}
                    color={colorOf.get(subject.code)}
                    open={open.has(subject.code) || !!q}
                    onToggle={() => toggleOpen(subject.code)}
                    onPick={(course) => pick(subject.code, course)}
                    onHover={(course) => setHover(course ? { subject: subject.code, course } : null)}
                    otherBlocks={selected.filter((s) => s.subject.code !== subject.code).flatMap((s) => s.course.blocks)}
                  />
                ))}
              </section>
            ))}
            {groups.length === 0 && <p className="px-3 pt-4 text-sm text-muted">No hay materias con ese nombre.</p>}
          </div>
        </aside>

        <section
          aria-label="Calendario semanal"
          className="flex min-w-0 flex-auto flex-col gap-3 rounded-2xl border border-line bg-surface px-[18px] py-4"
        >
          <div className="flex flex-col gap-1.5">
            {selected.length > 0 && warnings.length === 0 && (
              <Warning tone="ok">Sin superposiciones ni traslados apurados entre sedes</Warning>
            )}
            {warnings.map((w) => (
              <Warning key={w.text} tone={w.kind}>
                {w.text}
              </Warning>
            ))}
          </div>
          <WeekGrid selected={selected} ghost={ghost ? { course: ghost, name: subjects.get(hover!.subject)!.name } : undefined} />
          {analysis.asyncClasses.length > 0 && (
            <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-2.5">
              <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">ASINCRÓNICAS</span>
              {analysis.asyncClasses.map(({ courseId, block }) => {
                const s = selected.find((x) => x.course.id === courseId)!;
                return (
                  <span
                    key={`${courseId}-${block.day}-${block.start}`}
                    className={`inline-flex items-baseline gap-1.5 rounded-full border px-3 py-1 text-[12.5px] ${s.color.bg} ${s.color.ink} ${s.color.border}`}
                  >
                    <b>{s.subject.name}</b>
                    <span>
                      {block.type} · {formatHours(block.end - block.start)} hs por semana
                    </span>
                  </span>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Pill({ value, label }: { value: string; label: string }) {
  return (
    <span className="rounded-full border border-line bg-surface px-3.5 py-[7px] text-sm">
      <b>{value}</b> {label}
    </span>
  );
}

function Warning({ tone, children }: { tone: "ok" | "overlap" | "transfer"; children: ReactNode }) {
  const style = {
    ok: "bg-mint text-mint-ink",
    overlap: "bg-peach text-peach-ink",
    transfer: "bg-butter text-butter-ink",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-[10px] px-3 py-2 text-[13px] leading-snug ${style}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none">
        {tone === "ok" ? (
          <path d="M20 6L9 17l-5-5" />
        ) : (
          <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        )}
      </svg>
      {children}
    </div>
  );
}

function SubjectRow({
  subject,
  chosen,
  color,
  open,
  onToggle,
  onPick,
  onHover,
  otherBlocks,
}: {
  subject: PlanSubject;
  chosen: string | undefined;
  color: Color | undefined;
  open: boolean;
  onToggle: () => void;
  onPick: (course: string) => void;
  onHover: (course: string | null) => void;
  otherBlocks: ClassBlock[];
}) {
  const chosenCourse = subject.courses.find((c) => c.id === chosen);
  const sub = chosenCourse
    ? `En tu plan · ${chosenCourse.label} · ${chosenCourse.teacherList}`
    : `${subject.courses.length} ${subject.courses.length === 1 ? "curso" : "cursos"}`;

  return (
    <div>
      <button
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left hover:bg-bg"
      >
        <span
          className={`grid size-5 flex-none place-items-center rounded-full ${
            color ? `border-2 ${color.bg} ${color.border}` : "border-[1.5px] border-line-strong"
          }`}
        >
          {color && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={color.ink}>
              <path d="M20 6L9 17l-5-5" />
            </svg>
          )}
        </span>
        <span className="min-w-0 flex-auto text-[13.5px] leading-tight font-semibold">
          {subject.name}
          <span className="mt-px block text-xs font-normal text-muted">{sub}</span>
        </span>
        {subject.credits !== null && (
          <span className="text-[11px] font-medium whitespace-nowrap text-muted">{subject.credits} C</span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        subject.courses.map((course) => {
          const isChosen = course.id === chosen;
          const clashes =
            !isChosen && course.blocks.some((b) => !b.async && otherBlocks.some((o) => !o.async && overlaps(b, o)));
          const hasAsync = course.blocks.some((b) => b.async);
          return (
            <div
              key={course.id}
              onMouseEnter={() => onHover(course.id)}
              onMouseLeave={() => onHover(null)}
              className={`mb-1.5 ml-[34px] flex items-center gap-2.5 rounded-[10px] border-2 px-2.5 py-2 ${
                isChosen && color ? `bg-surface ${color.border}` : "border-transparent bg-bg"
              }`}
            >
              <div className="min-w-0 flex-auto">
                <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
                  {course.label}
                  {isChosen && color && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-px text-[11px] font-semibold ${color.bg} ${color.ink}`}>
                      En tu plan
                    </span>
                  )}
                  {clashes && (
                    <span className="rounded-full bg-peach px-[7px] py-px text-[11px] font-semibold text-peach-ink">
                      Se superpone
                    </span>
                  )}
                </div>
                {course.teacherList && <div className="text-[12.5px] leading-tight font-medium text-ink-2">{course.teacherList}</div>}
                <div className="text-xs leading-tight text-muted">
                  {describeSchedule(course.blocks)}
                  {hasAsync && " · + teórica asincrónica"}
                  {course.modality && ` · ${course.modality}`}
                </div>
              </div>
              <Rating score={course.score} />
              <button
                aria-pressed={isChosen}
                onClick={() => onPick(course.id)}
                className={`h-[30px] flex-none rounded-lg border px-3 text-[12.5px] font-semibold ${
                  isChosen
                    ? "border-line-strong bg-surface text-ink"
                    : "border-accent bg-accent text-on-accent"
                }`}
              >
                {isChosen ? "Quitar" : chosen ? "Cambiar" : "Agregar"}
              </button>
            </div>
          );
        })}
    </div>
  );
}

type Placed = { block: ClassBlock; name: string; course: PlanCourse; color?: Color; ghost: boolean; clash: boolean; lane: number };

function WeekGrid({
  selected,
  ghost,
}: {
  selected: { subject: PlanSubject; course: PlanCourse; color: Color }[];
  ghost?: { course: PlanCourse; name: string };
}) {
  const real = selected.flatMap((s) =>
    s.course.blocks.filter((b) => !b.async).map((block) => ({ block, name: s.subject.name, course: s.course, color: s.color, ghost: false })),
  );
  const preview = (ghost?.course.blocks ?? [])
    .filter((b) => !b.async)
    .map((block) => ({ block, name: ghost!.name, course: ghost!.course, color: undefined, ghost: true }));

  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-[44px_repeat(6,minmax(110px,1fr))] gap-x-1.5">
        <div />
        {WEEK_DAYS.map((d) => (
          <div key={d} className="pb-2 text-xs font-semibold text-muted">
            {d.toUpperCase()}
          </div>
        ))}
        <div className="flex flex-col text-[11px] leading-none text-muted">
          {hours.map((h) => (
            <div key={h} style={{ height: HOUR_PX }}>
              {h} hs
            </div>
          ))}
        </div>
        {WEEK_DAYS.map((day) => {
          const list = [...real, ...preview]
            .filter((p) => p.block.day === day)
            .sort((a, b) => a.block.start - b.block.start);
          // Carriles: los bloques que se pisan se reparten el ancho de la columna.
          const lanesEnd: number[] = [];
          const placed: Placed[] = list.map((p) => {
            let lane = lanesEnd.findIndex((end) => end <= p.block.start);
            if (lane < 0) {
              lane = lanesEnd.length;
              lanesEnd.push(p.block.end);
            } else lanesEnd[lane] = p.block.end;
            const clash =
              !p.ghost && real.some((o) => o.course.id !== p.course.id && overlaps(o.block, p.block));
            return { ...p, lane, clash };
          });
          const width = 100 / Math.max(1, lanesEnd.length);
          return (
            <div
              key={day}
              className="relative rounded-lg bg-bg bg-[linear-gradient(var(--line)_1px,transparent_1px)]"
              style={{ height: (LAST_HOUR - FIRST_HOUR) * HOUR_PX, backgroundSize: `100% ${HOUR_PX}px` }}
            >
              {placed.map((p) => (
                <CalendarBlock key={`${p.course.id}-${p.block.start}-${p.ghost}`} placed={p} width={width} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarBlock({ placed: p, width }: { placed: Placed; width: number }) {
  const { block } = p;
  const top = ((block.start - FIRST_HOUR * 60) / 60) * HOUR_PX + 1;
  const height = ((block.end - block.start) / 60) * HOUR_PX - 3;
  const where = block.campus
    ? CAMPUS_SHORT[block.campus]
    : isVirtualRoom(block.room)
      ? "Virtual"
      : "sede a conf.";
  const style = p.ghost
    ? "border-[1.5px] border-dashed border-accent bg-accent/10 text-lavender-ink"
    : `${p.color!.bg} ${p.color!.ink} ${p.clash ? "border-2 border-danger" : `border ${p.color!.border}`}`;
  return (
    <div
      className={`absolute overflow-hidden rounded-lg px-2 py-1.5 text-xs leading-tight ${style}`}
      style={{ top, height, left: `calc(${p.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` }}
    >
      <div className="line-clamp-2 font-semibold">{p.name}</div>
      <div className="opacity-90">
        {p.course.label.replace(" · práctica ", " ")} · {where}
      </div>
      <div className="opacity-90">
        {formatHour(block.start)}–{formatHour(block.end)} hs
      </div>
    </div>
  );
}

function NoOffer({ term, career }: { term: string | null; career: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <div>
        <h1 className="text-[32px] font-semibold tracking-[-0.01em]">{term ? `Armá tu ${term}` : "Plan del cuatrimestre"}</h1>
        <p className="text-sm text-muted">{career}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface px-6 py-8 text-ink-2">
        {term
          ? "Todavía no hay cursos para armar tu plan: la oferta de tu carrera no está cargada o no tenés materias habilitadas en tu mapa."
          : "Todavía no empezó la carga de la oferta del cuatrimestre."}
      </div>
    </main>
  );
}

function Rating({ score }: { score: Score | null }) {
  if (!score) return <span className="text-xs whitespace-nowrap text-muted">Sin reseñas</span>;
  return (
    <span className="flex items-center gap-[3px] text-[12.5px] font-semibold whitespace-nowrap">
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" className="fill-star">
        <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
      </svg>
      {score.average.toFixed(1).replace(".", ",")}
      <span className="font-normal text-muted">({score.count})</span>
    </span>
  );
}
