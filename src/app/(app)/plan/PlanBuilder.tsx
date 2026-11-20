"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { analyzePlan } from "@/lib/plan/analyze";
import { describeSchedule, formatHour, formatHours, isVirtualRoom } from "@/lib/plan/format";
import { type ClassBlock } from "@/lib/plan/options";
import {
  activityClassBlocks,
  activityKey,
  blockPosition,
  daysToShow,
  hourRange,
  nextColor,
  type ActivityColor,
  type PlanActivity,
} from "@/lib/plan/activities";
import type { Entry, OptionKey, PlanCourse, PlanData, PlanSubject, SubjectGroup } from "@/lib/plan/data";
import { enrolledEntries, startingEntries } from "@/lib/plan/cursada";
import {
  ELIGIBILITY_LABEL,
  ELIGIBILITY_TAG,
  canAdd,
  canConfirm,
  isPlanFilter,
  listedSubjects,
  type PlanFilter,
} from "@/lib/plan/offer";
import { confirmCourses, savePlanOption } from "./actions";
import { ConfirmCourses } from "./ConfirmCourses";
import { ACTIVITY_STYLE, ActivityDialog, ActivityList, AddActivityButton, hatchClass } from "./activities";
import { OfferSubmit } from "./OfferSubmit";
import { PlanMobile } from "./PlanMobile";
import {
  CAMPUS_SHORT,
  Check,
  DAY_LONG,
  EligibilityNote,
  EmptyList,
  FilterSwitch,
  GROUP_TITLE,
  PALETTE,
  PrintButton,
  Rating,
  Warning,
  overlaps,
  type Color,
} from "./shared";

// Pantalla del plan del cuatrimestre (prototipo docs/diseno/prototipos/07-plan.html).
// Cada cambio se guarda solo en la base (plan_choices), como en el mapa: las opciones A y B son
// borradores. Lo que de verdad cursa el alumno lo confirma aparte ("Confirmar mi cursada").
// Desde md (768 px) se ve la versión de escritorio; en celular, PlanMobile, con el mismo
// estado y las mismas acciones.

const HOUR_PX = 38;

// "Para cursar" o "Toda la oferta", recordado por dispositivo ("Para cursar" la primera vez).
// localStorage puede no estar (modo privado, datos bloqueados): entonces vale mientras la página siga abierta.
const FILTER_KEY = "plan-filtro";
let filterMemory: PlanFilter | null = null;
const filterListeners = new Set<() => void>();

function readFilter(): PlanFilter {
  if (filterMemory !== null) return filterMemory;
  try {
    const saved = localStorage.getItem(FILTER_KEY);
    return isPlanFilter(saved) ? saved : "cursar";
  } catch {
    return "cursar";
  }
}

function saveFilter(filter: PlanFilter) {
  filterMemory = filter;
  try {
    localStorage.setItem(FILTER_KEY, filter);
  } catch {
    // Sin localStorage queda en memoria.
  }
  filterListeners.forEach((listener) => listener());
}

function subscribeFilter(listener: () => void) {
  filterListeners.add(listener);
  return () => {
    filterListeners.delete(listener);
  };
}

const usePlanFilter = () => useSyncExternalStore(subscribeFilter, readFilter, () => "cursar" as const);

export function PlanBuilder({ data }: { data: PlanData }) {
  const [active, setActive] = useState<OptionKey>("A");
  const [plans, setPlans] = useState<Record<OptionKey, Entry[]>>(data.saved);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Los guardados van en fila: así el último cambio es el que queda.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const [enrolled, setEnrolled] = useState<string[]>(data.enrolled);
  // Cursos de la cursada que se está confirmando (null: el diálogo está cerrado).
  const [confirming, setConfirming] = useState<Entry[] | null>(null);
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const filter = usePlanFilter();
  const [hover, setHover] = useState<Entry | null>(null);
  // Actividades propias (null: la tabla todavía no está en la base y no se muestran).
  const [activities, setActivities] = useState<PlanActivity[] | null>(data.activities);
  // Actividad que se está editando ("nueva" para crear una; null: el diálogo está cerrado).
  const [editing, setEditing] = useState<PlanActivity | "nueva" | null>(null);

  const subjects = useMemo(() => new Map(data.subjects.map((s) => [s.code, s])), [data.subjects]);
  const courseOf = (e: Entry) => subjects.get(e.subject)?.courses.find((c) => c.id === e.course);

  const plan = plans[active];
  const selected = plan
    .map((e, i) => ({ subject: subjects.get(e.subject), course: courseOf(e), color: PALETTE[i % PALETTE.length] }))
    .filter((s): s is { subject: PlanSubject; course: PlanCourse; color: Color } => !!s.subject && !!s.course);
  const colorOf = new Map(selected.map((s) => [s.subject.code, s.color]));
  const mine = activities ?? [];
  const nameOfCourse = new Map([
    ...selected.map((s) => [s.course.id, s.subject.name] as const),
    ...mine.map((a) => [activityKey(a.id), a.name] as const),
  ]);

  const analysis = analyzePlan(
    selected.map((s) => ({ option: s.course, credits: s.subject.credits ?? undefined })),
    mine,
  );
  const addActivity = activities ? () => setEditing("nueva") : undefined;
  // La lámina para la pared: la opción que se está viendo, después del último guardado.
  const router = useRouter();
  const canPrint = selected.length + mine.length > 0;
  const printPlan = async () => {
    await saving.current;
    router.push(`/plan/imprimir?opcion=${active}&imprimir=1`);
  };
  const editActivity = (a: PlanActivity) => setEditing(a);

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
  const remove = (subject: string) => {
    setPlan(plan.filter((e) => e.subject !== subject));
    setHover(null);
  };
  const pick = (subject: string, course: string) => {
    const current = plan.find((e) => e.subject === subject);
    if (current?.course === course) setPlan(plan.filter((e) => e.subject !== subject));
    else if (current) setPlan(plan.map((e) => (e.subject === subject ? { subject, course } : e)));
    else setPlan([...plan, { subject, course }]);
    setHover(null);
  };
  const cursada = enrolledEntries(enrolled, data.subjects);
  // "Confirmar mi cursada" solo lleva lo que el mapa deja cursar: lo agregado desde "Toda la oferta"
  // sin correlativas sirve para comparar horarios, pero no pasa al Inicio ni al mapa.
  const confirmable = data.subjects.filter((s) => canConfirm(s.eligibility));
  const notConfirmable = data.subjects.filter((s) => !canConfirm(s.eligibility));
  const openConfirm = () => {
    setJustConfirmed(false);
    setConfirming(startingEntries(cursada, plan));
  };
  const saveCursada = async (entries: Entry[]): Promise<boolean> => {
    // Subjects confirmed before, to unmark them in the map if they are no longer taken.
    const dropped = cursada.map((e) => e.subject);
    // After any pending save of the options, so both go in order.
    await saving.current;
    const r = await confirmCourses(entries, dropped);
    if (r.error) return false;
    setEnrolled(entries.map((e) => e.course));
    setJustConfirmed(true);
    return true;
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
      day: o.day,
      text: `Superposición el ${DAY_LONG[o.day]} de ${formatHour(o.start)} a ${formatHour(o.end)} hs: ${nameOfCourse.get(o.courseIds[0])} y ${nameOfCourse.get(o.courseIds[1])}`,
    })),
    ...analysis.rushedTransfers.map((t) => ({
      kind: "transfer" as const,
      day: t.day,
      text: `Traslado apurado el ${DAY_LONG[t.day]}: salís de ${t.from} a las ${formatHour(t.leaveAt)} hs y entrás en ${t.to} a las ${formatHour(t.arriveAt)} hs`,
    })),
  ];
  // Materias del plan que el alumno todavía no puede cursar (agregadas desde "Toda la oferta").
  const outside = selected.filter((s) => s.subject.eligibility !== "ok");

  const q = query.trim();
  const inOptions = new Set([...plans.A, ...plans.B].map((e) => e.subject));
  const visible = listedSubjects(data.subjects, filter, query, inOptions);
  const counts: Record<PlanFilter, number> = {
    cursar: listedSubjects(data.subjects, "cursar", "", inOptions).length,
    oferta: data.subjects.length,
  };
  const groups = (Object.keys(GROUP_TITLE) as SubjectGroup[])
    .map((g) => ({ group: g, subjects: visible.filter((s) => s.group === g) }))
    .filter((g) => g.subjects.length > 0);

  const ghost = hover && !plan.some((e) => e.subject === hover.subject && e.course === hover.course) ? courseOf(hover) : undefined;

  if (data.subjects.length === 0) return <NoOffer data={data} />;

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 pt-4 pb-40 md:px-6 md:pt-6 md:pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-semibold md:text-[32px] tracking-[-0.01em]">Armá tu {data.term}</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {data.career}
            {saveState === "saving" && " · Guardando…"}
            {saveState === "saved" && " · Guardado"}
            {saveState === "error" && <span className="text-danger"> · No pudimos guardar el último cambio</span>}
            {justConfirmed && " · Cursada confirmada"}
          </p>
        </div>
        <div role="tablist" aria-label="Opciones" className="hidden gap-1.5 md:flex rounded-xl border border-line bg-surface p-1">
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

      {/* Escritorio: display contents, así el contenedor no cambia el diseño de siempre. */}
      <div className="hidden md:contents">
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
          {cursada.length > 0 ? (
            <button
              onClick={openConfirm}
              aria-haspopup="dialog"
              className="inline-flex h-[38px] items-center gap-1.5 rounded-[10px] bg-mint px-3.5 text-[13.5px] font-semibold text-mint-ink"
            >
              <Check size={14} />
              Cursada confirmada · {cursada.length} mat.
              <span className="ml-1 font-normal underline underline-offset-2">Editar</span>
            </button>
          ) : (
            <button
              onClick={openConfirm}
              aria-haspopup="dialog"
              className="h-[38px] rounded-[10px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent"
            >
              Confirmar mi cursada
            </button>
          )}
          {addActivity && <AddActivityButton onClick={addActivity} />}
          {canPrint && <PrintButton onClick={printPlan} />}
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
          aria-labelledby="materias-titulo"
          className="flex h-[760px] flex-[0_0_390px] flex-col rounded-2xl border border-line bg-surface"
        >
          <div className="flex flex-col gap-2 border-b border-line px-4 pt-4 pb-2.5">
            <h2 id="materias-titulo" className="text-[17px] font-semibold">
              {filter === "oferta" ? "Toda la oferta de tu plan" : "Materias que podés cursar"}
            </h2>
            <FilterSwitch filter={filter} counts={counts} onChange={saveFilter} />
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
                    onRemove={() => remove(subject.code)}
                    onPick={(course) => pick(subject.code, course)}
                    onHover={(course) => setHover(course ? { subject: subject.code, course } : null)}
                    otherBlocks={selected.filter((s) => s.subject.code !== subject.code).flatMap((s) => s.course.blocks)}
                  />
                ))}
              </section>
            ))}
            {groups.length === 0 && <EmptyList filter={filter} searching={!!q} onShowAll={() => saveFilter("oferta")} />}
          </div>
        </aside>

        <section
          aria-label="Calendario semanal"
          className="flex min-w-0 flex-auto flex-col gap-3 rounded-2xl border border-line bg-surface px-[18px] py-4"
        >
          <div className="flex flex-col gap-1.5">
            {outside.map((s) => (
              <Warning key={s.subject.code} tone="transfer">
                {s.subject.name}: {ELIGIBILITY_LABEL[s.subject.eligibility]?.toLowerCase()}. Te sirve para comparar horarios, pero no
                la vas a poder confirmar como cursada.
              </Warning>
            ))}
            {selected.length + mine.length > 0 && warnings.length === 0 && (
              <Warning tone="ok">Sin superposiciones ni traslados apurados entre sedes</Warning>
            )}
            {warnings.map((w) => (
              <Warning key={w.text} tone={w.kind}>
                {w.text}
              </Warning>
            ))}
          </div>
          <WeekGrid
            selected={selected}
            activities={mine}
            onEditActivity={editActivity}
            ghost={ghost ? { course: ghost, name: subjects.get(hover!.subject)!.name, tag: ELIGIBILITY_TAG[subjects.get(hover!.subject)!.eligibility] } : undefined}
          />
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
          {addActivity && mine.length > 0 && <ActivityList activities={mine} onEdit={editActivity} onAdd={addActivity} />}
        </section>
      </div>
      </div>

      <PlanMobile
        active={active}
        onOption={setActive}
        counts={{ A: plans.A.length, B: plans.B.length }}
        query={query}
        onQuery={setQuery}
        groups={groups}
        filter={filter}
        filterCounts={counts}
        plan={plan}
        selected={selected}
        colorOf={colorOf}
        analysis={analysis}
        warnings={warnings}
        onFilter={saveFilter}
        onPick={pick}
        onRemove={remove}
        onClear={() => setPlan([])}
        cursadaCount={cursada.length}
        onConfirm={openConfirm}
        activities={mine}
        onAddActivity={addActivity}
        onEditActivity={editActivity}
        onPrint={canPrint ? printPlan : undefined}
      />

      {editing && (
        <ActivityDialog
          activity={editing === "nueva" ? null : editing}
          defaultColor={nextColor(mine)}
          term={data.term}
          onSaved={(a) => setActivities((list) => (list?.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [...(list ?? []), a]))}
          onDeleted={(id) => setActivities((list) => (list ?? []).filter((x) => x.id !== id))}
          onClose={() => setEditing(null)}
        />
      )}

      {confirming && (
        <ConfirmCourses
          initial={confirming}
          subjects={confirmable}
          outside={notConfirmable}
          options={plans}
          term={data.term}
          confirmed={cursada.map((e) => e.course)}
          onSave={saveCursada}
          onClose={() => setConfirming(null)}
        />
      )}
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

function SubjectRow({
  subject,
  chosen,
  color,
  open,
  onToggle,
  onRemove,
  onPick,
  onHover,
  otherBlocks,
}: {
  subject: PlanSubject;
  chosen: string | undefined;
  color: Color | undefined;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onPick: (course: string) => void;
  onHover: (course: string | null) => void;
  otherBlocks: ClassBlock[];
}) {
  const chosenCourse = subject.courses.find((c) => c.id === chosen);
  const sub = chosenCourse
    ? `En tu plan · ${chosenCourse.label} · ${chosenCourse.teacherList}`
    : `${subject.courses.length} ${subject.courses.length === 1 ? "curso" : "cursos"}`;
  const addable = canAdd(subject.eligibility);

  return (
    <div>
      <div className="flex items-center rounded-[10px] hover:bg-bg">
        {/* El círculo: con la materia en el plan, la saca; si no, abre sus cursos como la flecha. */}
        <button
          onClick={chosenCourse ? onRemove : onToggle}
          aria-label={chosenCourse ? `Quitar ${subject.name} del plan` : `Ver cursos de ${subject.name}`}
          aria-expanded={chosenCourse ? undefined : open}
          title={chosenCourse ? "Quitar del plan" : undefined}
          className="group grid size-10 flex-none place-items-center rounded-[10px] pl-1"
        >
          <span
            className={`grid size-5 place-items-center rounded-full transition-colors ${
              color ? `border-2 ${color.bg} ${color.border} group-hover:border-danger` : "border-[1.5px] border-line-strong group-hover:border-accent"
            }`}
          >
            {color && <Check className={`${color.ink} group-hover:text-danger`} />}
          </span>
        </button>
        <button
          aria-expanded={open}
          onClick={onToggle}
          className="flex min-w-0 flex-auto items-center gap-2.5 py-2.5 pr-3 pl-1 text-left"
        >
          <span className="min-w-0 flex-auto text-[13.5px] leading-tight font-semibold">
            {subject.name}
            <span className="mt-px block text-xs font-normal text-muted">{sub}</span>
            <EligibilityNote eligibility={subject.eligibility} />
          </span>
          {subject.credits !== null && (
            <span className="text-[11px] font-medium whitespace-nowrap text-muted">{subject.credits} C</span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

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
                disabled={!isChosen && !chosen && !addable}
                title={!isChosen && !chosen && !addable ? `${ELIGIBILITY_LABEL[subject.eligibility]}: no hace falta sumarla` : undefined}
                className={`h-[30px] flex-none rounded-lg border px-3 text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:border-transparent disabled:bg-disabled disabled:text-disabled-ink ${
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

// Lo que va en el calendario: una clase de un curso (o su vista previa) o un horario de una actividad.
type Item = {
  /** Course id, or activityKey(id). */
  id: string;
  block: ClassBlock;
  name: string;
  detail: string;
  color?: Color;
  activity?: PlanActivity;
  ghost: boolean;
  /** "Sin correlativas" on subjects the student cannot take yet. */
  tag?: string | null;
};
type Placed = Item & { clash: boolean; lane: number };

const where = (block: ClassBlock) =>
  block.campus ? CAMPUS_SHORT[block.campus] : isVirtualRoom(block.room) ? "Virtual" : "sede a conf.";

function WeekGrid({
  selected,
  activities,
  onEditActivity,
  ghost,
}: {
  selected: { subject: PlanSubject; course: PlanCourse; color: Color }[];
  activities: PlanActivity[];
  onEditActivity: (a: PlanActivity) => void;
  ghost?: { course: PlanCourse; name: string; tag?: string | null };
}) {
  const courseItems = (course: PlanCourse, name: string, color: Color | undefined, isGhost: boolean, tag?: string | null) =>
    course.blocks
      .filter((b) => !b.async)
      .map((block): Item => ({
        id: course.id,
        block,
        name,
        detail: `${course.label.replace(" · práctica ", " ")} · ${where(block)}`,
        color,
        ghost: isGhost,
        tag,
      }));
  const real: Item[] = [
    ...selected.flatMap((s) => courseItems(s.course, s.subject.name, s.color, false, ELIGIBILITY_TAG[s.subject.eligibility])),
    ...activities.flatMap((a) =>
      activityClassBlocks(a).map(
        (block): Item => ({ id: activityKey(a.id), block, name: a.name, detail: a.place ?? "Actividad", activity: a, ghost: false }),
      ),
    ),
  ];
  const preview = ghost ? courseItems(ghost.course, ghost.name, undefined, true, ghost.tag) : [];

  const all = [...real, ...preview];
  const days = daysToShow(all.map((p) => p.block));
  const range = hourRange(all.map((p) => p.block));
  const hours = Array.from({ length: range.last - range.first }, (_, i) => range.first + i);
  const seven = days.length === 7;

  return (
    <div className="overflow-x-auto">
      <div
        className={`grid gap-x-1.5 ${
          seven ? "min-w-[800px] grid-cols-[44px_repeat(7,minmax(100px,1fr))]" : "min-w-[720px] grid-cols-[44px_repeat(6,minmax(110px,1fr))]"
        }`}
      >
        <div />
        {days.map((d) => (
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
        {days.map((day) => {
          const list = all.filter((p) => p.block.day === day).sort((a, b) => a.block.start - b.block.start);
          // Carriles: los bloques que se pisan se reparten el ancho de la columna.
          const lanesEnd: number[] = [];
          const placed: Placed[] = list.map((p) => {
            let lane = lanesEnd.findIndex((end) => end <= p.block.start);
            if (lane < 0) {
              lane = lanesEnd.length;
              lanesEnd.push(p.block.end);
            } else lanesEnd[lane] = p.block.end;
            const clash = !p.ghost && real.some((o) => o.id !== p.id && overlaps(o.block, p.block));
            return { ...p, lane, clash };
          });
          const width = 100 / Math.max(1, lanesEnd.length);
          return (
            <div
              key={day}
              className="relative rounded-lg bg-bg bg-[linear-gradient(var(--line)_1px,transparent_1px)]"
              style={{ height: (range.last - range.first) * HOUR_PX, backgroundSize: `100% ${HOUR_PX}px` }}
            >
              {placed.map((p) => (
                <CalendarBlock
                  key={`${p.id}-${p.block.start}-${p.ghost}`}
                  placed={p}
                  width={width}
                  firstHour={range.first}
                  onEdit={p.activity ? () => onEditActivity(p.activity!) : undefined}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CalendarBlock({
  placed: p,
  width,
  firstHour,
  onEdit,
}: {
  placed: Placed;
  width: number;
  firstHour: number;
  onEdit?: () => void;
}) {
  const { block } = p;
  const { top, height } = blockPosition(block.start, block.end, firstHour, HOUR_PX);
  const color: ActivityColor | undefined = p.activity?.color;
  const style = p.ghost
    ? "border-[1.5px] border-dashed border-accent bg-accent/10 text-lavender-ink"
    : color
      ? `${hatchClass(color)} ${p.clash ? "border-2 border-danger" : `border border-dashed ${ACTIVITY_STYLE[color].border}`}`
      : `${p.color!.bg} ${p.color!.ink} ${p.clash ? "border-2 border-danger" : `border ${p.color!.border}`}`;
  const content = (
    <>
      {p.tag && (
        <span className="mb-0.5 block w-fit max-w-full truncate rounded-full bg-surface px-1.5 text-[10.5px] font-semibold text-peach-ink">{p.tag}</span>
      )}
      <div className="line-clamp-2 font-semibold">{p.name}</div>
      <div className="truncate opacity-90">{p.detail}</div>
      <div className="opacity-90">
        {formatHour(block.start)}–{formatHour(block.end)} hs
      </div>
    </>
  );
  const box = `absolute overflow-hidden rounded-lg px-2 py-1.5 text-left text-xs leading-tight ${style}`;
  const position = { top, height, left: `calc(${p.lane * width}% + 2px)`, width: `calc(${width}% - 4px)` };
  if (onEdit) {
    return (
      <button onClick={onEdit} aria-haspopup="dialog" aria-label={`Editar ${p.name}`} className={`${box} flex flex-col justify-start`} style={position}>
        {content}
      </button>
    );
  }
  return (
    <div className={box} style={position}>
      {content}
    </div>
  );
}

function NoOffer({ data }: { data: PlanData }) {
  const { term, career, noOffer } = data;
  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-10">
      <div>
        <h1 className="text-[26px] font-semibold md:text-[32px] tracking-[-0.01em]">{term ? `Armá tu ${term}` : "Plan del cuatrimestre"}</h1>
        <p className="text-sm text-muted">{career}</p>
      </div>
      <div className="rounded-2xl border border-line bg-surface px-4 py-6 text-ink-2 md:px-6 md:py-8">
        {term && noOffer ? (
          <div className="flex flex-col gap-4">
            <p>Todavía no está cargada la oferta de tu plan para el {term}.</p>
            <OfferSubmit term={term} submission={noOffer.submission} />
          </div>
        ) : term ? (
          "Todavía no hay cursos para armar tu plan: no tenés materias habilitadas en tu mapa."
        ) : (
          "Todavía no empezó la carga de la oferta del cuatrimestre."
        )}
      </div>
    </main>
  );
}
