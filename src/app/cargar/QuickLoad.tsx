"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CareerMap, GRADES, formatAverage, subjectKey, totalCredits, type MapItem, type Subject } from "@/lib/map/model";
import type { MapData } from "@/lib/map/data";
import { useProgress } from "@/lib/map/useProgress";
import { StateIcon, STATE_STYLE } from "@/components/MapState";

// Carga rápida de materias: la pantalla que sigue a elegir la carrera. Recorre el plan
// cuatrimestre por cuatrimestre; cada materia se carga con un toque (o una tecla) y se guarda al instante.

type Step = { key: string; label: string; groups: { name: string | null; items: MapItem[] }[] };
type Choice = "grade" | "final_pending" | "in_progress" | "none";

export function QuickLoad({ userId, data }: { userId: string; data: MapData }) {
  const map = useMemo(() => new CareerMap(data.subjects, data.requirements), [data]);
  const { progress, saveSubject, saveRequirement, saveError } = useProgress(userId, data.progress);
  const steps = useMemo<Step[]>(() => {
    const { cbc, terms } = map.columns();
    const asItem = (s: Subject): MapItem => ({
      key: subjectKey(s.id),
      type: "subject",
      subject: s,
    });
    const out: Step[] = [];
    if (cbc.length) out.push({ key: "cbc", label: "CBC", groups: [{ name: null, items: cbc }] });
    for (const t of terms) out.push({ key: `t${t.level}`, label: `${t.level}.º cuatrimestre`, groups: [{ name: null, items: t.items }] });
    const electives = map.electiveGroups();
    if (electives.length) {
      out.push({ key: "electivas", label: "Electivas", groups: electives.map((g) => ({ name: g.name, items: g.items.map(asItem) })) });
    }
    return out;
  }, [map]);

  const [stepIndex, setStepIndex] = useState(0);
  const [focus, setFocus] = useState(0);
  const step = steps[stepIndex];
  const rows = useMemo(() => step.groups.flatMap((g) => g.items), [step]);
  const groupStart = useMemo(() => {
    const starts: number[] = [];
    let n = 0;
    for (const g of step.groups) {
      starts.push(n);
      n += g.items.length;
    }
    return starts;
  }, [step]);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const nextRef = useRef<HTMLButtonElement | null>(null);
  const isLast = stepIndex === steps.length - 1;

  const credits = map.approvedCredits(progress);
  const total = totalCredits(data.creditRules);

  const loaded = (item: MapItem) =>
    item.type === "requirement" ? progress.requirements.has(item.requirement.id) : progress.subjects.has(item.subject.id);
  const approved = (item: MapItem) =>
    item.type === "requirement"
      ? progress.requirements.has(item.requirement.id)
      : progress.subjects.get(item.subject.id)?.status === "approved";

  // Al cambiar de paso, arriba y foco en la primera materia.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    rowRefs.current[0]?.focus({ preventScroll: true });
  }, [stepIndex]);

  const goTo = (i: number) => {
    setStepIndex(i);
    setFocus(0);
  };

  const moveFocus = (i: number) => {
    if (i >= rows.length) {
      nextRef.current?.focus();
      return;
    }
    const j = Math.max(0, i);
    setFocus(j);
    rowRefs.current[j]?.focus();
  };

  function choose(index: number, choice: Choice, grade?: number) {
    const item = rows[index];
    if (item.type === "requirement") {
      void saveRequirement(item.requirement.id, choice === "grade");
    } else if (choice === "grade" && grade) {
      void saveSubject(item.subject.id, { status: "approved", grade });
    } else if (choice === "final_pending" || choice === "in_progress") {
      void saveSubject(item.subject.id, { status: choice, grade: null });
    } else {
      void saveSubject(item.subject.id, null);
    }
    moveFocus(index + 1);
  }

  function onRowKey(e: KeyboardEvent<HTMLDivElement>, index: number) {
    if (e.target !== e.currentTarget) return; // las teclas de los botones siguen siendo de los botones
    const item = rows[index];
    const k = e.key.toLowerCase();
    if (item.type === "requirement") {
      if (k === "a" || k === "enter") choose(index, "grade");
      else if (k === "p" || k === "backspace" || k === "delete") choose(index, "none");
      else if (k === "arrowdown") moveFocus(index + 1);
      else if (k === "arrowup") moveFocus(index - 1);
      else return;
    } else if (/^[4-9]$/.test(k)) choose(index, "grade", Number(k));
    else if (k === "0") choose(index, "grade", 10);
    else if (k === "f") choose(index, "final_pending");
    else if (k === "c") choose(index, "in_progress");
    else if (k === "backspace" || k === "delete" || k === "s") choose(index, "none");
    else if (k === "arrowdown") moveFocus(index + 1);
    else if (k === "arrowup") moveFocus(index - 1);
    else return;
    e.preventDefault();
  }

  return (
    <main className="mx-auto flex max-w-[1120px] flex-col gap-6 px-6 pt-10 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold">Cargá tus materias</h1>
          <div className="text-muted">
            {data.careerName} · Plan {data.year}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Stat label="Créditos">
            {credits}
            {total !== null && <span className="font-normal text-muted"> de {total}</span>}
          </Stat>
          <Stat label="Promedio">{formatAverage(map.average(progress))}</Stat>
          <Link
            href="/mapa"
            className="ml-2 inline-flex h-[42px] items-center rounded-[10px] border border-line-strong bg-surface px-[18px] text-[15px] font-semibold"
          >
            Terminar
          </Link>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
          {saveError}
        </p>
      )}

      <div className="grid grid-cols-[220px_minmax(0,1fr)] items-start gap-6">
        <nav aria-label="Cuatrimestres" className="sticky top-6 flex flex-col gap-1">
          {steps.map((s, i) => {
            const items = s.groups.flatMap((g) => g.items);
            const done = items.filter(loaded).length;
            const allApproved = items.length > 0 && items.every(approved);
            const current = i === stepIndex;
            return (
              <button
                key={s.key}
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => goTo(i)}
                className={`flex items-center justify-between gap-2 rounded-[10px] px-3 py-2.5 text-left text-sm ${
                  current ? "bg-lavender font-semibold text-lavender-ink" : "text-ink hover:bg-surface"
                }`}
              >
                <span className="flex items-center gap-2">
                  {allApproved || (items.length > 0 && done === items.length) ? (
                    <span
                      className={`grid size-[18px] place-items-center rounded-full ${allApproved ? "bg-mint text-mint-ink" : "bg-accent-soft text-accent"}`}
                    >
                      <StateIcon state="approved" size={11} />
                    </span>
                  ) : (
                    <span className={`size-[18px] rounded-full border-[1.5px] ${done ? "border-accent" : "border-line-strong"}`} />
                  )}
                  {s.label}
                </span>
                <span className={`text-xs ${current ? "" : "text-muted"}`}>
                  {done} de {items.length}
                </span>
              </button>
            );
          })}
        </nav>

        <section aria-label={step.label} className="rounded-2xl border border-line bg-surface">
          <div className="flex items-baseline justify-between border-b border-line px-6 pt-5 pb-4">
            <h2 className="text-[19px] font-semibold">{step.label}</h2>
            <span className="text-[13px] text-muted">
              Paso {stepIndex + 1} de {steps.length}
            </span>
          </div>

          <div className="flex flex-col px-3 py-2">
            {step.groups.map((g, gi) => (
              <div key={g.name ?? "-"}>
                {g.name && <div className="mx-3 mt-4 mb-1 text-[11px] font-semibold tracking-[0.08em] text-muted">{g.name.toUpperCase()}</div>}
                {g.items.map((item, k) => {
                  const i = groupStart[gi] + k;
                  return (
                    <Row
                      key={item.key}
                      ref={(el) => {
                        rowRefs.current[i] = el;
                      }}
                      item={item}
                      value={item.type === "subject" ? (progress.subjects.get(item.subject.id) ?? null) : null}
                      requirementApproved={item.type === "requirement" && progress.requirements.has(item.requirement.id)}
                      focused={focus === i}
                      onFocus={() => setFocus(i)}
                      onKeyDown={(e) => onRowKey(e, i)}
                      onChoose={(c, grade) => choose(i, c, grade)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-line px-6 py-4">
            <button
              type="button"
              onClick={() => goTo(stepIndex - 1)}
              disabled={stepIndex === 0}
              className="text-sm text-muted disabled:invisible"
            >
              ← Anterior
            </button>
            {isLast ? (
              <Link
                href="/mapa"
                className="inline-flex h-[44px] items-center rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent"
              >
                Ver mi mapa
              </Link>
            ) : (
              <button
                ref={nextRef}
                type="button"
                onClick={() => goTo(stepIndex + 1)}
                className="h-[44px] rounded-xl bg-accent px-6 text-[15px] font-semibold text-on-accent"
              >
                Siguiente: {steps[stepIndex + 1].label} →
              </button>
            )}
          </div>
        </section>
      </div>

      <p className="text-center text-xs text-muted">
        Con el teclado: 4 a 9 y 0 (10) para la nota · F final pendiente · C cursando · Borrar sin cursar · ↑ ↓ para moverte
      </p>
    </main>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface px-3.5 py-1.5">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-muted">{label.toUpperCase()}</span>
      <span className="text-base font-semibold">{children}</span>
    </div>
  );
}

function Row(props: {
  ref: (el: HTMLDivElement | null) => void;
  item: MapItem;
  value: { status: string; grade: number | null } | null;
  requirementApproved: boolean;
  focused: boolean;
  onFocus: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onChoose: (choice: Choice, grade?: number) => void;
}) {
  const { ref, item, value, requirementApproved, focused, onFocus, onKeyDown, onChoose } = props;
  const name = item.type === "subject" ? item.subject.name : item.requirement.name;
  const status = item.type === "requirement" ? (requirementApproved ? "approved" : null) : (value?.status ?? null);
  const state = status === "approved" ? "approved" : status === "final_pending" ? "final_pending" : status === "in_progress" ? "in_progress" : null;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={name}
      tabIndex={focused ? 0 : -1}
      onFocus={(e) => {
        if (e.target === e.currentTarget) onFocus();
      }}
      onKeyDown={onKeyDown}
      className={`flex items-center gap-4 rounded-xl px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent ${focused ? "bg-bg" : ""}`}
    >
      <span className={`grid size-7 flex-none place-items-center rounded-full ${state ? STATE_STYLE[state] : "border border-dashed border-line-strong text-muted"}`}>
        {state && <StateIcon state={state} size={12} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-tight font-medium">{name}</div>
        <div className="text-[13px] text-muted">{item.type === "subject" ? `${item.subject.credits} C` : "Requisito"}</div>
      </div>

      {item.type === "requirement" ? (
        <div className="flex gap-1.5">
          <Choice on={requirementApproved} tone="approved" onClick={() => onChoose("grade")}>
            Aprobada
          </Choice>
          <Choice on={!requirementApproved} tone="none" onClick={() => onChoose("none")}>
            Pendiente
          </Choice>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex gap-1" role="group" aria-label="Aprobada con">
            {GRADES.map((g) => {
              const on = status === "approved" && value?.grade === g;
              return (
                <button
                  key={g}
                  type="button"
                  tabIndex={-1}
                  aria-pressed={on}
                  aria-label={`Aprobada con ${g}`}
                  onClick={() => onChoose("grade", g)}
                  className={`size-9 rounded-lg text-sm font-semibold ${
                    on ? "border border-mint-line bg-mint text-mint-ink" : "border border-line bg-surface text-ink hover:border-line-strong"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <div className="flex gap-1">
            <Choice on={status === "final_pending"} tone="final_pending" onClick={() => onChoose("final_pending")}>
              Final
            </Choice>
            <Choice on={status === "in_progress"} tone="in_progress" onClick={() => onChoose("in_progress")}>
              Cursando
            </Choice>
            <Choice on={status === null} tone="none" onClick={() => onChoose("none")}>
              Sin cursar
            </Choice>
          </div>
        </div>
      )}
    </div>
  );
}

const TONE: Record<"approved" | "final_pending" | "in_progress" | "none", string> = {
  approved: "border border-mint-line bg-mint text-mint-ink",
  final_pending: "border border-butter-line bg-butter text-butter-ink",
  in_progress: "border border-sky-line bg-sky text-sky-ink",
  // "Sin cursar" es el estado de partida: se marca apenas, para que no compita con lo cargado.
  none: "border border-line bg-bg text-muted",
};

function Choice(props: { on: boolean; tone: keyof typeof TONE; onClick: () => void; children: ReactNode }) {
  const { on, tone, onClick, children } = props;
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-pressed={on}
      onClick={onClick}
      className={`h-9 rounded-lg px-3 text-[13px] whitespace-nowrap ${on ? `${TONE[tone]} font-semibold` : "border border-line bg-surface text-ink hover:border-line-strong"}`}
    >
      {children}
    </button>
  );
}
