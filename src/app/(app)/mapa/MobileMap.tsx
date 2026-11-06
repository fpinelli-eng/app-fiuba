"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { STATE_LABEL, normalizeText, subjectKey, type DisplayState, type MapItem, type Subject } from "@/lib/map/model";
import { STATE_ICON_LABEL, STATE_STYLE, StateIcon } from "./icons";

// Mapa en el celular (menos de 768 px): en vez de las columnas, una lista por cuatrimestre
// y las electivas en otra pestaña. El estado y el guardado son los mismos del mapa de escritorio
// (CareerMapView); acá solo se dibuja.

export type Filter = "all" | "enabled" | "blocked";
type Tab = "required" | "electives";

interface Section {
  id: string;
  title: string;
  items: MapItem[];
}

interface Props {
  cbc: MapItem[];
  terms: { level: number; items: MapItem[] }[];
  electiveGroups: { name: string | null; items: Subject[] }[];
  items: Map<string, MapItem>;
  stateOf: (item: MapItem) => DisplayState;
  gradeOf: (item: MapItem) => number | null;
  credits: number;
  sel: string | null;
  firstLoad: boolean;
  query: string;
  filter: Filter;
  onFilter: (f: Filter) => void;
  electiveCredits: number;
  electiveTarget: string | null;
  electiveTargetMax: number | null;
  onPick: (key: string) => void;
}

const nameOf = (item: MapItem) => (item.type === "subject" ? item.subject.name : item.requirement.name);

export function MobileMap(props: Props) {
  const { cbc, terms, electiveGroups, items, stateOf, gradeOf, credits, sel, firstLoad, query, filter, onFilter, onPick } = props;
  const sections: Section[] = [
    ...(cbc.length ? [{ id: "cbc", title: "CBC", items: cbc }] : []),
    ...terms.map((t) => ({ id: `t${t.level}`, title: `${t.level}.º cuatrimestre`, items: t.items })),
  ];
  const allElectives = electiveGroups.flatMap((g) => g.items);
  const hasElectives = allElectives.length > 0;

  const selIsElective = sel !== null && allElectives.some((s) => subjectKey(s.id) === sel);
  const [tabChoice, setTab] = useState<Tab>("required");
  // En la primera carga la ficha puede pasar sola a una electiva: la pestaña la sigue.
  const tab: Tab = !hasElectives ? "required" : firstLoad && sel ? (selIsElective ? "electives" : "required") : tabChoice;

  // Abiertos al entrar: el primer cuatrimestre con algo sin aprobar (el actual) y el siguiente.
  const [open, setOpen] = useState<Set<string>>(() => {
    const done = (s: Section) => s.items.every((i) => stateOf(i) === "approved");
    const i = sections.findIndex((s) => !done(s));
    const from = i < 0 ? sections.length - 1 : i;
    return new Set(sections.slice(from, from + 2).map((s) => s.id));
  });
  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const q = normalizeText(query);
  const matches = (item: MapItem) => !q || normalizeText(nameOf(item)).includes(q);
  const requiredMatches = q ? sections.reduce((n, s) => n + s.items.filter(matches).length, 0) : null;
  const electiveMatches = q ? allElectives.filter((s) => normalizeText(s.name).includes(q)).length : null;

  // En la primera carga la ficha avanza sola: la materia elegida queda a la vista.
  useEffect(() => {
    if (!firstLoad || !sel || !window.matchMedia("(max-width: 767px)").matches) return;
    document.getElementById(`fila-${sel}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [sel, firstLoad]);

  const row = (item: MapItem) => (
    <Row
      key={item.key}
      item={item}
      state={stateOf(item)}
      grade={gradeOf(item)}
      credits={credits}
      selected={sel === item.key}
      onPick={() => onPick(item.key)}
    />
  );

  return (
    <div className="flex flex-col gap-3 md:hidden">
      {hasElectives && (
        <div role="tablist" aria-label="Materias" className="flex h-11 rounded-xl border border-line bg-surface p-1">
          {(
            [
              ["required", "Obligatorias", requiredMatches],
              ["electives", "Electivas", electiveMatches],
            ] as [Tab, string, number | null][]
          ).map(([t, label, n]) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg text-sm whitespace-nowrap ${tab === t ? "bg-lavender font-semibold text-lavender-ink" : "text-muted"}`}
            >
              {label}
              {n !== null && <span className="ml-1 font-normal opacity-75">· {n}</span>}
            </button>
          ))}
        </div>
      )}

      {tab === "required" ? (
        <>
          {sections.map((s) => {
            const shown = s.items.filter(matches);
            if (q && shown.length === 0) return null;
            const isOpen = !!q || open.has(s.id) || (sel !== null && s.items.some((i) => i.key === sel));
            const approved = s.items.filter((i) => stateOf(i) === "approved").length;
            return (
              <section key={s.id} aria-label={s.title} className="rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(s.id)}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left"
                >
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="text-[15px] font-semibold">{s.title}</span>
                    <span className="flex items-center gap-2 text-[13px] text-muted">
                      {approved} de {s.items.length}
                      <Chevron open={isOpen} />
                    </span>
                  </span>
                  {/* Resumen de colores: una marca por materia, como las columnas del mapa. */}
                  <span className="flex w-full gap-1" aria-hidden="true">
                    {s.items.map((i) => (
                      <span key={i.key} className={`h-1.5 flex-1 rounded-full ${STATE_STYLE[stateOf(i)]}`} />
                    ))}
                  </span>
                </button>
                {isOpen && <div className="flex flex-col gap-1.5 px-2.5 pb-2.5">{shown.map(row)}</div>}
              </section>
            );
          })}
          {requiredMatches === 0 && <p className="px-1 py-6 text-center text-sm text-muted">Ninguna obligatoria coincide</p>}
        </>
      ) : (
        <ElectivesList {...props} q={q} filter={filter} onFilter={onFilter} items={items} row={row} />
      )}
    </div>
  );
}

function ElectivesList(props: Props & { q: string; row: (item: MapItem) => ReactNode }) {
  const { electiveGroups: groups, items, stateOf, q, filter, onFilter, row, electiveCredits, electiveTarget, electiveTargetMax } = props;
  const all = groups.flatMap((g) => g.items);
  const stateOfSubject = (s: Subject) => stateOf(items.get(subjectKey(s.id))!);
  const passes = (s: Subject) => (filter === "all" || stateOfSubject(s) === filter) && (!q || normalizeText(s.name).includes(q));
  const count = (f: Filter) => all.filter((s) => f === "all" || stateOfSubject(s) === f).length;
  return (
    <>
      <div className="flex flex-col gap-2.5 rounded-2xl border border-lavender-line bg-lavender-panel p-3.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Electivas</h2>
          <span className="text-sm font-semibold">
            {electiveCredits}
            {electiveTarget && <> de {electiveTarget}</>} C
          </span>
        </div>
        {electiveTargetMax !== null && (
          <div className="h-2 overflow-hidden rounded-lg bg-surface" aria-hidden="true">
            <div className="h-2 bg-accent" style={{ width: `${Math.min(100, Math.round((electiveCredits / electiveTargetMax) * 100))}%` }} />
          </div>
        )}
        <div role="group" aria-label="Filtrar electivas" className="flex h-10 rounded-[10px] bg-surface p-[3px]">
          {(
            [
              ["all", "Todas"],
              ["enabled", "Habilitadas"],
              ["blocked", "Bloqueadas"],
            ] as [Filter, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => onFilter(f)}
              className={`flex-1 rounded-lg px-1 text-[13px] whitespace-nowrap ${filter === f ? "bg-lavender font-semibold text-lavender-ink" : "text-muted"}`}
            >
              {label} {count(f)}
            </button>
          ))}
        </div>
      </div>
      {groups.map((g) => {
        const shown = g.items.filter(passes);
        if (q && shown.length === 0) return null;
        const enabled = g.items.filter((s) => stateOfSubject(s) === "enabled").length;
        const showHead = groups.length > 1 || g.name !== null;
        return (
          <section key={g.name ?? ""} aria-label={g.name ?? "Electivas"} className="flex flex-col gap-1.5">
            {showHead && (
              <div className="mx-1 mt-1 flex items-baseline justify-between gap-3 text-[11px] font-semibold tracking-[0.08em] text-muted">
                <span>{(g.name ?? "Generales").toUpperCase()}</span>
                <span className="tracking-normal whitespace-nowrap">
                  {enabled} hab. de {g.items.length}
                </span>
              </div>
            )}
            {shown.length === 0 && <div className="px-1 pb-1 text-xs text-muted">Ninguna en este filtro</div>}
            {shown.map((s) => row(items.get(subjectKey(s.id))!))}
          </section>
        );
      })}
    </>
  );
}

function Row(props: { item: MapItem; state: DisplayState; grade: number | null; credits: number; selected: boolean; onPick: () => void }) {
  const { item, state, grade, credits, selected, onPick } = props;
  const name = nameOf(item);
  const subject = item.type === "subject" ? item.subject : null;
  const rc = subject?.requiredCredits ?? null;
  const label = !subject
    ? `Requisito · ${state === "approved" ? "Aprobada" : "Pendiente"}`
    : state === "blocked" && rc !== null && credits < rc
      ? `Bloqueada · pide ${rc} C`
      : STATE_LABEL[state];
  return (
    <button
      id={`fila-${item.key}`}
      type="button"
      aria-expanded={selected}
      aria-label={`${name}: ${STATE_ICON_LABEL(state, grade)}`}
      onClick={onPick}
      className={`flex min-h-[52px] w-full scroll-mt-28 items-center gap-3 rounded-xl px-3 py-2 text-left ${STATE_STYLE[state]} ${selected ? "shadow-[0_0_0_3px_var(--accent)]" : ""}`}
    >
      <StateIcon state={state} size={16} />
      <span className="min-w-0 flex-auto">
        <span className="block text-sm leading-tight font-semibold break-words">{name}</span>
        <span className="mt-0.5 block text-xs opacity-80">{label}</span>
      </span>
      {state === "approved" && grade !== null && <span className="text-lg leading-none font-bold">{grade}</span>}
      {subject && <span className="text-xs font-medium whitespace-nowrap opacity-75">{subject.credits} C</span>}
    </button>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Ficha de la materia en el celular: hoja que sube desde abajo, por encima de la barra de pestañas. */
export function BottomSheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  // Al abrirse toma el foco; al cerrarse lo devuelve a lo que la abrió (la fila de la materia).
  const ref = useRef<HTMLDivElement>(null);
  // Mientras está abierta, la página de atrás queda quieta: ni el foco ni arrastrar el dedo la mueven
  // (en el iPhone, overflow: hidden no alcanza; se fija el body en su lugar y al cerrar se vuelve ahí).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const y = window.scrollY;
    const body = document.body.style;
    const before = { position: body.position, top: body.top, width: body.width, overflow: body.overflow };
    Object.assign(body, { position: "fixed", top: `-${y}px`, width: "100%", overflow: "hidden" });
    ref.current?.focus({ preventScroll: true });
    return () => {
      Object.assign(body, before);
      window.scrollTo(0, y);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  // Mientras está abierta, Tab y Shift+Tab dan la vuelta dentro de la hoja en vez de salir a la página.
  const keepFocusInside = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !ref.current) return;
    const focusable = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === ref.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };
  return (
    <div className="fixed inset-0 z-[60] md:hidden">
      <button type="button" aria-label="Cerrar la ficha" onClick={onClose} className="absolute inset-0 bg-pop-shadow" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        className="absolute inset-x-0 bottom-0 outline-none max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-[18px] border-t border-line bg-surface px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-12px_32px_var(--pop-shadow)]"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
