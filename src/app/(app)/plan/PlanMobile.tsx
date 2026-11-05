"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PlanAnalysis } from "@/lib/plan/analyze";
import { DAY_SHORT, describeSchedule, formatHour, formatHours, isVirtualRoom } from "@/lib/plan/format";
import { WEEK_DAYS, type ClassBlock, type WeekDay } from "@/lib/plan/options";
import { firstDayToShow } from "@/lib/home/calendar";
import type { Entry, OptionKey, PlanCourse, PlanSubject, SubjectGroup } from "@/lib/plan/data";
import { Check, DAY_LONG, GROUP_TITLE, Rating, Warning, overlaps, type Color } from "./shared";

// Plan del cuatrimestre en celular (menos de 768 px). No copia el escritorio: dos vistas,
// "Materias" (lista; cada materia abre una hoja con sus cursos) y "Semana" (agenda día por
// día). El estado y las acciones son los de PlanBuilder.

type Selected = { subject: PlanSubject; course: PlanCourse; color: Color };
type PlanWarning = { kind: "overlap" | "transfer"; day: WeekDay; text: string };
type View = "materias" | "semana";

// La barra de pestañas de la app ocupa 61 px abajo: lo fijo va encima.
const ABOVE_TAB_BAR = "bottom-[calc(61px+env(safe-area-inset-bottom))]";

const noSubscribe = () => () => {};
// Día de hoy según el dispositivo (domingo → lunes). En el servidor, lunes.
const useToday = (): WeekDay => {
  const day = useSyncExternalStore(noSubscribe, () => new Date().getDay(), () => 1);
  return WEEK_DAYS[day === 0 ? 0 : day - 1];
};

export function PlanMobile({
  active,
  onOption,
  counts,
  query,
  onQuery,
  groups,
  plan,
  selected,
  colorOf,
  analysis,
  warnings,
  onPick,
  onClear,
  enroll,
  enrollState,
  isEnrolledHere,
}: {
  active: OptionKey;
  onOption: (k: OptionKey) => void;
  counts: Record<OptionKey, number>;
  query: string;
  onQuery: (q: string) => void;
  groups: { group: SubjectGroup; subjects: PlanSubject[] }[];
  plan: Entry[];
  selected: Selected[];
  colorOf: Map<string, Color>;
  analysis: PlanAnalysis;
  warnings: PlanWarning[];
  onPick: (subject: string, course: string) => void;
  onClear: () => void;
  enroll: () => void;
  enrollState: "idle" | "saving" | "error";
  isEnrolledHere: boolean;
}) {
  const [view, setView] = useState<View>(() => (plan.length > 0 ? "semana" : "materias"));
  const [sheet, setSheet] = useState<string | null>(null);
  const sheetSubject = sheet ? groups.flatMap((g) => g.subjects).find((s) => s.code === sheet) : undefined;

  return (
    <div className="flex flex-col gap-3 md:hidden">
      <div role="tablist" aria-label="Opciones" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
        {(["A", "B"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={active === k}
            onClick={() => onOption(k)}
            className={`h-10 rounded-[9px] text-sm ${active === k ? "bg-lavender font-semibold text-lavender-ink" : "text-muted"}`}
          >
            Opción {k} <span className="font-normal opacity-80">· {counts[k]} mat.</span>
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="Vista" className="flex border-b border-line">
        {(
          [
            ["materias", "Materias"],
            ["semana", "Semana"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={`-mb-px flex h-11 flex-1 items-center justify-center gap-1.5 border-b-2 text-[15px] ${
              view === key ? "border-accent font-semibold text-ink" : "border-transparent text-muted"
            }`}
          >
            {label}
            {key === "semana" && warnings.length > 0 && (
              <span className="rounded-full bg-peach px-1.5 text-xs font-semibold text-peach-ink" aria-label={`${warnings.length} avisos`}>
                {warnings.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {view === "materias" ? (
        <SubjectList query={query} onQuery={onQuery} groups={groups} plan={plan} colorOf={colorOf} onOpen={setSheet} />
      ) : (
        <Week
          option={active}
          selected={selected}
          analysis={analysis}
          warnings={warnings}
          onChoose={() => setView("materias")}
          onClear={onClear}
        />
      )}

      {plan.length > 0 && (
        <div
          className={`fixed inset-x-0 ${ABOVE_TAB_BAR} z-30 flex items-center justify-between gap-3 border-t border-line bg-surface px-4 py-2.5 shadow-[0_-4px_16px_var(--pop-shadow)]`}
        >
          <div className="min-w-0 text-[13px] leading-tight">
            <div>
              <b>{analysis.subjects}</b> {analysis.subjects === 1 ? "materia" : "materias"} · <b>{analysis.credits}</b> C
            </div>
            <div className="text-muted">
              <b className="text-ink">{formatHours(analysis.weeklyMinutes)}</b> h por semana
              {analysis.asyncMinutes > 0 && ` + ${formatHours(analysis.asyncMinutes)} asinc.`}
            </div>
            {enrollState === "error" && <div className="text-danger">No pudimos guardar tu cursada</div>}
          </div>
          {isEnrolledHere ? (
            <span className="inline-flex h-10 flex-none items-center gap-1.5 rounded-[10px] bg-mint px-3 text-[13.5px] font-semibold text-mint-ink">
              <Check size={14} />
              Te inscribiste
            </span>
          ) : (
            <button
              onClick={enroll}
              disabled={enrollState === "saving"}
              aria-label="Me inscribí en esta opción"
              className="h-10 flex-none rounded-[10px] bg-accent px-3.5 text-[13.5px] font-semibold text-on-accent disabled:cursor-not-allowed disabled:bg-disabled disabled:text-disabled-ink"
            >
              {enrollState === "saving" ? "Guardando…" : "Me inscribí"}
            </button>
          )}
        </div>
      )}

      <CourseSheet
        subject={sheetSubject}
        chosen={sheetSubject && plan.find((e) => e.subject === sheetSubject.code)?.course}
        color={sheetSubject && colorOf.get(sheetSubject.code)}
        others={selected.filter((s) => s.subject.code !== sheetSubject?.code)}
        onPick={(course) => {
          if (sheetSubject) onPick(sheetSubject.code, course);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </div>
  );
}

function SubjectList({
  query,
  onQuery,
  groups,
  plan,
  colorOf,
  onOpen,
}: {
  query: string;
  onQuery: (q: string) => void;
  groups: { group: SubjectGroup; subjects: PlanSubject[] }[];
  plan: Entry[];
  colorOf: Map<string, Color>;
  onOpen: (code: string) => void;
}) {
  return (
    <section aria-label="Materias que podés cursar" className="flex flex-col">
      <label htmlFor="buscar-materia-celular" className="sr-only">
        Buscar materia
      </label>
      <input
        id="buscar-materia-celular"
        type="search"
        placeholder="Buscar materia"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        className="h-11 rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink outline-none focus:border-accent"
      />
      {groups.map(({ group, subjects }) => (
        <div key={group}>
          <h3 className="mx-1 mt-4 mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted">{GROUP_TITLE[group]}</h3>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {subjects.map((subject) => {
              const color = colorOf.get(subject.code);
              const chosen = subject.courses.find((c) => c.id === plan.find((e) => e.subject === subject.code)?.course);
              return (
                <li key={subject.code}>
                  <button
                    aria-haspopup="dialog"
                    onClick={() => onOpen(subject.code)}
                    className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left active:bg-bg"
                  >
                    <span
                      className={`grid size-5 flex-none place-items-center rounded-full ${
                        color ? `border-2 ${color.bg} ${color.border}` : "border-[1.5px] border-line-strong"
                      }`}
                    >
                      {color && <Check className={color.ink} />}
                    </span>
                    <span className="min-w-0 flex-auto text-[14.5px] leading-tight font-semibold">
                      {subject.name}
                      <span className="mt-0.5 block truncate text-[13px] font-normal text-muted">
                        {chosen
                          ? `En tu plan · ${chosen.label}${chosen.teacherList ? ` · ${chosen.teacherList}` : ""}`
                          : `${subject.courses.length} ${subject.courses.length === 1 ? "curso" : "cursos"}`}
                      </span>
                    </span>
                    {subject.credits !== null && (
                      <span className="text-xs font-medium whitespace-nowrap text-muted">{subject.credits} C</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-muted">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {groups.length === 0 && <p className="px-1 pt-4 text-sm text-muted">No hay materias con ese nombre.</p>}
    </section>
  );
}

// Hoja que sube desde abajo con los cursos de una materia. <dialog> nativo: queda por encima
// de todo (también de la barra de pestañas), cierra con Escape y mantiene el foco adentro.
function CourseSheet({
  subject,
  chosen,
  color,
  others,
  onPick,
  onClose,
}: {
  subject: PlanSubject | undefined;
  chosen: string | undefined;
  color: Color | undefined;
  others: Selected[];
  onPick: (course: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isOpen = !!subject;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
    // Que la página de atrás no se desplace mientras la hoja está abierta.
    document.documentElement.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      aria-label={subject ? `Cursos de ${subject.name}` : undefined}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="inset-x-0 mx-0 mt-auto mb-0 max-h-[85dvh] w-full max-w-full flex-col rounded-t-[20px] border-0 bg-surface p-0 text-ink transition-transform duration-200 backdrop:bg-pop-shadow open:flex starting:open:translate-y-full"
    >
      {subject && (
        <>
          <div className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-line-strong" aria-hidden="true" />
          <div className="flex flex-none items-start gap-3 border-b border-line px-4 pt-2 pb-3">
            <div className="min-w-0 flex-auto">
              <h2 className="text-[17px] leading-tight font-semibold">{subject.name}</h2>
              <p className="text-[13px] text-muted">
                {subject.credits !== null && `${subject.credits} C · `}
                {subject.courses.length} {subject.courses.length === 1 ? "curso" : "cursos"}
              </p>
            </div>
            <button onClick={onClose} aria-label="Cerrar" className="-mt-1 -mr-2 grid size-10 flex-none place-items-center rounded-full text-muted">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <ul className="flex flex-col gap-2.5 overflow-y-auto overscroll-contain px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
            {subject.courses.map((course) => {
              const isChosen = course.id === chosen;
              const clashWith = isChosen
                ? []
                : others
                    .filter((o) => o.course.blocks.some((ob) => !ob.async && course.blocks.some((b) => !b.async && overlaps(b, ob))))
                    .map((o) => o.subject.name);
              const hasAsync = course.blocks.some((b) => b.async);
              return (
                <li
                  key={course.id}
                  className={`flex flex-col gap-1.5 rounded-xl border-2 p-3 ${
                    isChosen && color ? `bg-surface ${color.border}` : "border-transparent bg-bg"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[15px] font-bold">
                      {course.label}
                      {isChosen && color && (
                        <span className={`rounded-full px-2 py-px text-[11px] font-semibold ${color.bg} ${color.ink}`}>En tu plan</span>
                      )}
                    </div>
                    <Rating score={course.score} />
                  </div>
                  {course.teacherList && <div className="text-[13px] leading-tight font-medium text-ink-2">{course.teacherList}</div>}
                  <div className="text-[13px] leading-snug text-muted">
                    {describeSchedule(course.blocks)}
                    {hasAsync && " · + teórica asincrónica"}
                    {course.modality && ` · ${course.modality}`}
                  </div>
                  {clashWith.length > 0 && (
                    <div className="self-start rounded-full bg-peach px-2 py-px text-xs font-semibold text-peach-ink">
                      Se superpone con {clashWith.join(" y ")}
                    </div>
                  )}
                  <button
                    aria-pressed={isChosen}
                    onClick={() => onPick(course.id)}
                    className={`mt-1 h-11 rounded-[10px] border text-sm font-semibold ${
                      isChosen ? "border-line-strong bg-surface text-ink" : "border-accent bg-accent text-on-accent"
                    }`}
                  >
                    {isChosen ? "Quitar del plan" : chosen ? "Cambiar a este curso" : "Agregar al plan"}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </dialog>
  );
}

function Week({
  option,
  selected,
  analysis,
  warnings,
  onChoose,
  onClear,
}: {
  option: OptionKey;
  selected: Selected[];
  analysis: PlanAnalysis;
  warnings: PlanWarning[];
  onChoose: () => void;
  onClear: () => void;
}) {
  const today = useToday();
  const [picked, setPicked] = useState<WeekDay | null>(null);
  const classes = selected.flatMap((s) => s.course.blocks.filter((b) => !b.async).map((block) => ({ ...s, block })));
  // Sin elegir, arranca en hoy si tiene clases; si no, en el próximo día que tenga (como el inicio).
  const byDay = WEEK_DAYS.map((d) => classes.filter((c) => c.block.day === d));
  const day = picked ?? WEEK_DAYS[firstDayToShow(byDay, (WEEK_DAYS as readonly WeekDay[]).indexOf(today))];

  if (selected.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-ink-2">Todavía no elegiste materias para la Opción {option}.</p>
        <button onClick={onChoose} className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent">
          Elegir materias
        </button>
      </div>
    );
  }

  const ofDay = classes.filter((c) => c.block.day === day).sort((a, b) => a.block.start - b.block.start || a.block.end - b.block.end);
  const dayWarnings = warnings.filter((w) => w.day === day);

  return (
    <section aria-label="Semana" className="flex flex-col gap-3">
      <div role="tablist" aria-label="Día" className="grid grid-cols-6 gap-1.5">
        {WEEK_DAYS.map((d) => {
          const colors = [...new Set(classes.filter((c) => c.block.day === d).map((c) => c.color))];
          const problem = warnings.some((w) => w.day === d);
          return (
            <button
              key={d}
              role="tab"
              aria-selected={d === day}
              aria-label={`${d}${colors.length ? `, ${colors.length} ${colors.length === 1 ? "materia" : "materias"}` : ", sin clases"}${problem ? ", con avisos" : ""}`}
              onClick={() => setPicked(d)}
              className={`relative flex h-14 flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px] ${
                d === day ? "border-transparent bg-lavender font-semibold text-lavender-ink" : "border-line bg-surface text-ink-2"
              } ${d === today && d !== day ? "font-semibold text-accent" : ""}`}
            >
              {DAY_SHORT[d]}
              <span className="flex h-1.5 gap-[3px]" aria-hidden="true">
                {colors.slice(0, 4).map((c) => (
                  <span key={c.dot} className={`size-1.5 rounded-full ${c.dot}`} />
                ))}
              </span>
              {problem && <span className="absolute top-1 right-1 size-2 rounded-full bg-danger" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {warnings.length === 0 && <Warning tone="ok">Sin superposiciones ni traslados apurados entre sedes</Warning>}
      {dayWarnings.map((w) => (
        <Warning key={w.text} tone={w.kind}>
          {w.text}
        </Warning>
      ))}

      {ofDay.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-6 text-center text-sm text-muted">Sin clases el {DAY_LONG[day]}.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {ofDay.map((c, i) => {
            const prev = ofDay[i - 1];
            const gap = prev ? c.block.start - Math.max(...ofDay.slice(0, i).map((p) => p.block.end)) : 0;
            const clash = classes.some((o) => o.course.id !== c.course.id && overlaps(o.block, c.block));
            return (
              <li key={`${c.course.id}-${c.block.start}-${c.block.type}`} className="flex flex-col gap-2">
                {gap >= 60 && <div className="text-center text-xs text-muted">Libre {formatHours(gap)} h</div>}
                <AgendaItem block={c.block} name={c.subject.name} course={c.course} color={c.color} clash={clash} />
              </li>
            );
          })}
        </ol>
      )}

      {analysis.asyncClasses.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-line pt-3">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">ASINCRÓNICAS</span>
          {analysis.asyncClasses.map(({ courseId, block }) => {
            const s = selected.find((x) => x.course.id === courseId)!;
            return (
              <div key={`${courseId}-${block.day}-${block.start}`} className={`rounded-xl border px-3 py-2 text-[13px] ${s.color.bg} ${s.color.ink} ${s.color.border}`}>
                <b>{s.subject.name}</b> · {block.type} · {formatHours(block.end - block.start)} hs por semana
              </div>
            );
          })}
        </div>
      )}

      <button onClick={onClear} className="h-10 self-start rounded-[10px] border border-line bg-surface px-3.5 text-[13.5px] text-muted">
        Vaciar plan
      </button>
    </section>
  );
}

function AgendaItem({
  block,
  name,
  course,
  color,
  clash,
}: {
  block: ClassBlock;
  name: string;
  course: PlanCourse;
  color: Color;
  clash: boolean;
}) {
  const where = block.campus ?? (isVirtualRoom(block.room) ? "Virtual" : "Sede a confirmar");
  return (
    <div className={`flex gap-3 rounded-xl px-3 py-2.5 ${color.bg} ${color.ink} ${clash ? "border-2 border-danger" : `border ${color.border}`}`}>
      <div className="w-12 flex-none leading-tight">
        <div className="text-[15px] font-semibold">{formatHour(block.start)}</div>
        <div className="text-xs opacity-80">a {formatHour(block.end)} hs</div>
      </div>
      <div className="min-w-0 flex-auto text-[13px] leading-snug">
        <div className="text-[14.5px] leading-tight font-semibold">{name}</div>
        <div className="opacity-90">
          {course.label} · {block.type}
        </div>
        <div className="opacity-90">
          {where}
          {block.room && !isVirtualRoom(block.room) && ` · ${block.room}`}
        </div>
        {clash && (
          <span className="mt-1 inline-block rounded-full bg-surface px-2 py-px text-[11px] font-semibold text-danger">Se superpone</span>
        )}
      </div>
    </div>
  );
}
