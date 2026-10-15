"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CareerMap,
  GRADES,
  STATE_LABEL,
  electiveTarget,
  formatAverage,
  normalizeText,
  requirementKey,
  subjectKey,
  totalCredits,
  type DisplayState,
  type MapItem,
  type Progress,
  type Subject,
  type SubjectStatus,
} from "@/lib/map/model";
import type { MapData } from "@/lib/map/data";
import { CloseIcon, STATE_ICON_LABEL, StateIcon, STATE_STYLE } from "./icons";

// Mapa de la carrera (prototipo 06-mapa) y primera carga de materias (prototipo 03-primera-carga).
// Cada cambio se guarda en la base apenas se toca; si falla, se vuelve atrás y se avisa.

const COL = 122;
const NODE_W = 112;
const NODE_H = 92;
const ROW = 100;
const TOP = 34;
const CBC_CLOSED_W = 64;

type Filter = "all" | "enabled" | "blocked";
type ButtonState = SubjectStatus | "none";

interface Props {
  userId: string;
  data: MapData;
  /** Primera carga: la ficha recorre las materias en orden y avanza sola. */
  firstLoad: boolean;
}

export function CareerMapView({ userId, data, firstLoad }: Props) {
  const map = useMemo(() => new CareerMap(data.subjects, data.requirements), [data]);
  const [progress, setProgress] = useState<Progress>(() => ({
    subjects: new Map(data.progress.subjects.map((s) => [s.subjectId, { status: s.status, grade: s.grade }])),
    requirements: new Set(data.progress.requirements),
  }));
  const sequence = useMemo(() => map.loadSequence(), [map]);
  const [sel, setSel] = useState<string | null>(firstLoad ? (sequence[0] ?? null) : null);
  const [pending, setPending] = useState<string | null>(null); // "Aprobada" elegida, falta la nota
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [cbcOpenChoice, setCbcOpenChoice] = useState<boolean | null>(firstLoad ? true : null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Cálculos ------------------------------------------------------------------

  const credits = map.approvedCredits(progress);
  const cbcComplete = map.cbcComplete(progress);
  const cbcOpen = cbcOpenChoice ?? !cbcComplete;
  const { cbc, terms } = useMemo(() => map.columns(), [map]);
  const groups = useMemo(() => map.electiveGroups(), [map]);
  const total = totalCredits(data.creditRules);
  const eTarget = electiveTarget(data.creditRules);
  const eTargetMax = eTarget ? Number(eTarget.split("–").pop()) : null;
  const eCredits = map.electiveCredits(progress);

  const stateOf = useCallback(
    (item: MapItem): DisplayState =>
      item.type === "requirement"
        ? progress.requirements.has(item.requirement.id)
          ? "approved"
          : "enabled"
        : map.displayState(progress, item.subject.id, credits),
    [map, progress, credits],
  );

  const items = useMemo(() => {
    const all = new Map<string, MapItem>();
    for (const s of map.subjects) all.set(subjectKey(s.id), { key: subjectKey(s.id), type: "subject", subject: s });
    for (const r of map.requirements) all.set(requirementKey(r.id), { key: requirementKey(r.id), type: "requirement", requirement: r });
    return all;
  }, [map]);

  const selItem = sel ? (items.get(sel) ?? null) : null;
  const selSubject = selItem?.type === "subject" ? selItem.subject : null;
  const related = useMemo(() => {
    const id = sel?.startsWith("s") ? Number(sel.slice(1)) : null;
    if (id === null || firstLoad) return { needs: new Set<string>(), unlocks: new Set<string>() };
    return {
      needs: new Set(map.expandedPrerequisites(id).map(subjectKey)),
      unlocks: new Set(map.unlocks(id).map((s) => subjectKey(s.id))),
    };
  }, [map, sel, firstLoad]);
  const q = normalizeText(query);
  const matches = (item: MapItem) =>
    !q || normalizeText(item.type === "subject" ? item.subject.name : item.requirement.name).includes(q);

  /** Opacidad y contorno de cada materia según la selección y la búsqueda. */
  const emphasis = (item: MapItem) => {
    let opacity = 1;
    const isSel = sel === item.key;
    if (!firstLoad && sel && !isSel && !related.needs.has(item.key) && !related.unlocks.has(item.key)) opacity = 0.3;
    if (!matches(item)) opacity = Math.min(opacity, 0.2);
    const outline = isSel
      ? ""
      : related.needs.has(item.key)
        ? "outline-2 outline-offset-2 outline-accent"
        : related.unlocks.has(item.key)
          ? "outline-2 outline-offset-2 outline-dashed outline-accent"
          : "";
    return { opacity, outline, isSel };
  };

  // Guardado -------------------------------------------------------------------

  const fail = () => setSaveError("No pudimos guardar el cambio. Probá de nuevo.");

  async function saveSubject(id: number, next: { status: SubjectStatus; grade: number | null } | null) {
    const before = progress.subjects.get(id) ?? null;
    setSaveError(null);
    setProgress((p) => {
      const subjects = new Map(p.subjects);
      if (next) subjects.set(id, next);
      else subjects.delete(id);
      return { ...p, subjects };
    });
    const { error } = next
      ? await supabase
          .from("user_subjects")
          .upsert({ user_id: userId, subject_id: id, status: next.status, grade: next.grade }, { onConflict: "user_id,subject_id" })
      : await supabase.from("user_subjects").delete().eq("user_id", userId).eq("subject_id", id);
    if (error) {
      setProgress((p) => {
        const subjects = new Map(p.subjects);
        if (before) subjects.set(id, before);
        else subjects.delete(id);
        return { ...p, subjects };
      });
      fail();
    }
  }

  async function saveRequirement(id: number, approved: boolean) {
    setSaveError(null);
    const apply = (on: boolean) =>
      setProgress((p) => {
        const requirements = new Set(p.requirements);
        if (on) requirements.add(id);
        else requirements.delete(id);
        return { ...p, requirements };
      });
    apply(approved);
    const { error } = approved
      ? await supabase.from("user_requirements").upsert({ user_id: userId, requirement_id: id }, { onConflict: "user_id,requirement_id" })
      : await supabase.from("user_requirements").delete().eq("user_id", userId).eq("requirement_id", id);
    if (error) {
      apply(!approved);
      fail();
    }
  }

  // Acciones de la ficha ---------------------------------------------------------

  const advance = (item: MapItem) => {
    if (!firstLoad) return;
    const i = sequence.indexOf(item.key);
    setSel(i >= 0 ? (sequence[i + 1] ?? null) : null);
  };

  function pickGrade(item: MapItem, grade: number) {
    if (item.type !== "subject") return;
    setPending(null);
    void saveSubject(item.subject.id, { status: "approved", grade });
    advance(item);
  }

  function pickState(item: MapItem, state: ButtonState) {
    if (item.type === "requirement") {
      void saveRequirement(item.requirement.id, state === "approved");
      advance(item);
      return;
    }
    const id = item.subject.id;
    const current = progress.subjects.get(id);
    if (state === "approved") {
      // "Aprobada" sin nota no se guarda: primero se elige la nota.
      if (current?.status === "approved") return;
      setPending(item.key);
      return;
    }
    setPending(null);
    void saveSubject(id, state === "none" ? null : { status: state, grade: null });
    advance(item);
  }

  const select = (key: string) => {
    setPending(null);
    setSel((s) => (s === key ? null : key));
  };
  const close = () => {
    setPending(null);
    setSel(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Geometría ----------------------------------------------------------------------

  const off = cbcOpen ? 0 : NODE_W - CBC_CLOSED_W;
  const rows = Math.max(1, cbc.length, ...terms.map((t) => t.items.length));
  const height = TOP + rows * ROW - 2;
  const width = (terms.length + 1) * COL - 10 - off;
  const positions = new Map<string, { x: number; y: number }>();
  if (cbcOpen) cbc.forEach((it, r) => positions.set(it.key, { x: 0, y: TOP + r * ROW }));
  terms.forEach((t, j) => t.items.forEach((it, r) => positions.set(it.key, { x: (j + 1) * COL - off, y: TOP + r * ROW })));

  const cbcKeys = new Set(cbc.map((i) => i.key));
  const cbcRelated = !firstLoad && [...related.needs].some((k) => cbcKeys.has(k));
  const cbcState: DisplayState = cbcComplete
    ? "approved"
    : cbc.some((i) => stateOf(i) === "in_progress")
      ? "in_progress"
      : "enabled";
  const toggleCbc = () => {
    setCbcOpenChoice(!cbcOpen);
    if (sel && cbcKeys.has(sel)) close();
  };

  const selPos = sel ? positions.get(sel) : undefined;
  const selIsElective = selSubject ? selSubject.kind === "elective" || selSubject.kind === "orientation" : false;

  // Electivas
  const passes = (s: Subject) => {
    if (filter === "all") return true;
    return map.displayState(progress, s.id, credits) === filter;
  };
  const allElectives = groups.flatMap((g) => g.items);
  const count = (f: Filter) => allElectives.filter((s) => f === "all" || map.displayState(progress, s.id, credits) === f).length;

  return (
    <main className="flex flex-col gap-4 px-6 pt-[26px] pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.01em]">{firstLoad ? "Cargá tus materias" : "Mapa de la carrera"}</h1>
          <div className="text-muted">
            {data.careerName} · Plan {data.year} · <span className="font-semibold text-ink">{credits}</span>
            {total !== null && <> de {total}</>} C · Promedio{" "}
            <span className="font-semibold text-ink">{formatAverage(map.average(progress))}</span>
          </div>
        </div>
        <div className="flex items-end gap-2.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="buscar" className="text-xs font-semibold tracking-[0.06em] text-muted">
              BUSCAR MATERIA
            </label>
            <input
              id="buscar"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej.: Física"
              className="h-[42px] w-[280px] rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-ink"
            />
          </div>
          {firstLoad && (
            <Link
              href="/"
              className="inline-flex h-[42px] items-center rounded-[10px] bg-accent px-[22px] text-[15px] font-semibold text-on-accent"
            >
              Listo
            </Link>
          )}
        </div>
      </div>

      <Legend />

      {saveError && (
        <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
          {saveError}
        </p>
      )}

      <section
        aria-label="Plan de estudios"
        className="relative flex rounded-2xl border border-line bg-surface"
        style={{ height: height + 32 }}
      >
        <div className="min-w-0 flex-1 overflow-x-auto px-3 py-4">
          <div className="relative" style={{ width, height }}>
            {/* Columnas */}
            <div className="absolute top-0 bottom-0 rounded-xl bg-map-cbc-col" style={{ left: 0, width: cbcOpen ? NODE_W + 5 : CBC_CLOSED_W + 5 }} />
            {terms.map((t, j) => (
              <div
                key={t.level}
                className={`absolute top-0 bottom-0 rounded-xl ${j % 2 ? "bg-map-col-alt" : "bg-surface"}`}
                style={{ left: (j + 1) * COL - 5 - off, width: COL }}
              />
            ))}
            {terms.map((t, j) => (
              <div
                key={t.level}
                className="absolute top-1.5 text-center text-xs font-semibold text-muted"
                style={{ left: (j + 1) * COL - off, width: NODE_W }}
              >
                {t.level}.º cuatr.
              </div>
            ))}

            {/* CBC: abierto o compactado */}
            {cbcOpen ? (
              <button
                type="button"
                onClick={toggleCbc}
                aria-expanded="true"
                title="Compactar el CBC en un solo módulo"
                className="absolute top-0.5 left-0 flex h-[26px] items-center justify-center gap-1 rounded-[7px] text-xs font-semibold text-mint-ink"
                style={{ width: NODE_W }}
              >
                CBC
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 7l5 5-5 5M20 7l-5 5 5 5" />
                </svg>
                <span className="font-medium">Compactar</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleCbc}
                aria-expanded="false"
                aria-label={`CBC compactado, ${cbc.length} materias. Tocá para ver las materias`}
                className={`absolute left-0 flex flex-col items-center justify-center gap-3.5 rounded-[10px] px-1 py-2.5 text-center transition-opacity ${STATE_STYLE[cbcState]} ${cbcRelated ? "outline-2 outline-offset-2 outline-accent" : ""}`}
                style={{ top: TOP, width: CBC_CLOSED_W, height: rows * ROW - 8, opacity: sel && !cbcRelated && !firstLoad ? 0.3 : 1 }}
              >
                <span className="text-sm font-semibold">CBC</span>
                <span className="text-[11px] leading-tight">{cbcComplete ? "Completo" : `${map.cbcApprovedCount(progress)} de ${cbc.length}`}</span>
                <span className="text-[10.5px] font-medium opacity-75">{map.cbcSubjects.reduce((a, s) => a + s.credits, 0)} C</span>
                <span className="flex flex-col items-center gap-0.5 text-[11px] font-semibold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
                  </svg>
                  Ver
                </span>
              </button>
            )}

            {/* Materias */}
            {[...positions.entries()].map(([key, pos]) => {
              const item = items.get(key)!;
              const state = stateOf(item);
              const { opacity, outline, isSel } = emphasis(item);
              return (
                <MapNode
                  key={key}
                  item={item}
                  state={state}
                  grade={item.type === "subject" ? (progress.subjects.get(item.subject.id)?.grade ?? null) : null}
                  x={pos.x}
                  y={pos.y}
                  opacity={opacity}
                  outline={outline}
                  selected={isSel}
                  onPick={() => select(key)}
                />
              );
            })}

            {selItem && selPos && !selIsElective && (
              <Popover x={selPos.x} y={selPos.y} containerWidth={width} containerHeight={height}>
                <SubjectCard
                  map={map}
                  item={selItem}
                  progress={progress}
                  credits={credits}
                  stateOf={stateOf}
                  firstLoad={firstLoad}
                  pending={pending === selItem.key}
                  inSequence={sequence.includes(selItem.key)}
                  onGrade={(g) => pickGrade(selItem, g)}
                  onState={(s) => pickState(selItem, s)}
                  onPrev={() => {
                    const i = sequence.indexOf(selItem.key);
                    setPending(null);
                    setSel(sequence[i - 1] ?? selItem.key);
                  }}
                  onNext={() => {
                    const i = sequence.indexOf(selItem.key);
                    setPending(null);
                    setSel(sequence[i + 1] ?? null);
                  }}
                  onClose={close}
                />
              </Popover>
            )}
          </div>
        </div>

        {allElectives.length > 0 && (
          <aside aria-label="Electivas" className="flex w-[276px] shrink-0 flex-col rounded-r-2xl border-l border-lavender-line bg-lavender-panel">
            <div className="flex flex-col gap-2 border-b border-lavender-line px-4 pt-4 pb-2.5">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-semibold">Electivas</h2>
                <span className="text-[13px] font-semibold">
                  {eCredits}
                  {eTarget && <> de {eTarget}</>} C
                </span>
              </div>
              {eTargetMax !== null && (
                <div className="h-2 overflow-hidden rounded-lg bg-surface" aria-hidden="true">
                  <div className="h-2 bg-accent" style={{ width: `${Math.min(100, Math.round((eCredits / eTargetMax) * 100))}%` }} />
                </div>
              )}
              <div role="group" aria-label="Filtrar electivas" className="flex h-[34px] rounded-[9px] bg-surface p-[3px]">
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
                    onClick={() => setFilter(f)}
                    className={`flex-auto rounded-md px-1.5 text-xs whitespace-nowrap ${filter === f ? "bg-lavender font-semibold text-lavender-ink" : "text-muted"}`}
                  >
                    {label} {count(f)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-auto overflow-y-auto px-3 pb-3">
              {groups.map((g) => {
                const shown = g.items.filter(passes);
                const enabled = g.items.filter((s) => map.displayState(progress, s.id, credits) === "enabled").length;
                const showHead = groups.length > 1 || g.name !== null;
                return (
                  <div key={g.name ?? ""}>
                    {showHead ? (
                      <div className="mx-0.5 mt-3.5 mb-1.5 flex items-baseline justify-between text-[11px] font-semibold tracking-[0.08em] text-muted">
                        <span>{(g.name ?? "Generales").toUpperCase()}</span>
                        <span className="tracking-normal">
                          {enabled} hab. de {g.items.length}
                        </span>
                      </div>
                    ) : (
                      <div className="h-3" />
                    )}
                    {shown.length === 0 && <div className="px-0.5 pb-1.5 text-xs text-muted">Ninguna en este filtro</div>}
                    <div className="flex flex-col gap-1.5">
                      {shown.map((s) => {
                        const item = items.get(subjectKey(s.id))!;
                        const state = stateOf(item);
                        const { opacity, outline, isSel } = emphasis(item);
                        const grade = progress.subjects.get(s.id)?.grade ?? null;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            aria-expanded={isSel}
                            onClick={() => select(item.key)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] leading-tight transition-opacity ${STATE_STYLE[state]} ${isSel ? "shadow-[0_0_0_3px_var(--accent)]" : outline}`}
                            style={{ opacity }}
                          >
                            <StateIcon state={state} size={13} />
                            <span className="flex-auto font-medium">{s.name}</span>
                            {state === "approved" && grade !== null && <span className="text-base leading-none font-bold">{grade}</span>}
                            <span className="text-[10.5px] font-medium whitespace-nowrap opacity-75">{s.credits} C</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        )}

        {selItem && selIsElective && (
          <div className="absolute right-[288px] bottom-4 z-40">
            <SubjectCard
              map={map}
              item={selItem}
              progress={progress}
              credits={credits}
              stateOf={stateOf}
              firstLoad={firstLoad}
              pending={pending === selItem.key}
              inSequence={false}
              electiveGroup={selSubject?.kind === "orientation" ? selSubject.category : null}
              onGrade={(g) => pickGrade(selItem, g)}
              onState={(s) => pickState(selItem, s)}
              onPrev={() => {}}
              onNext={() => {}}
              onClose={close}
            />
          </div>
        )}
      </section>
    </main>
  );
}

// Piezas ------------------------------------------------------------------------------

function Legend() {
  const states: DisplayState[] = ["approved", "final_pending", "in_progress", "enabled", "blocked"];
  return (
    <div aria-label="Referencias" className="flex flex-wrap items-center gap-2">
      {states.map((s) => (
        <span key={s} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold ${STATE_STYLE[s]}`}>
          <StateIcon state={s} />
          {STATE_LABEL[s]}
        </span>
      ))}
      <span className="px-1.5 py-1 text-[13px] text-muted">C = créditos</span>
    </div>
  );
}

function MapNode(props: {
  item: MapItem;
  state: DisplayState;
  grade: number | null;
  x: number;
  y: number;
  opacity: number;
  outline: string;
  selected: boolean;
  onPick: () => void;
}) {
  const { item, state, grade, x, y, opacity, outline, selected, onPick } = props;
  const name = item.type === "subject" ? item.subject.name : item.requirement.name;
  const short =
    item.type === "requirement" ? (state === "approved" ? "Aprobada" : "Pendiente") : state === "final_pending" ? "Final" : "";
  return (
    <div className="absolute transition-opacity" style={{ left: x, top: y, opacity, zIndex: selected ? 30 : 1 }}>
      <button
        type="button"
        aria-expanded={selected}
        aria-label={`${name}: ${STATE_ICON_LABEL(state, grade)}`}
        onClick={onPick}
        className={`flex flex-col justify-between rounded-[10px] px-2 py-[7px] text-left ${STATE_STYLE[state]} ${selected ? "shadow-[0_0_0_3px_var(--accent),0_8px_20px_var(--pop-shadow)]" : outline}`}
        style={{ width: NODE_W, height: NODE_H }}
      >
        <span className="line-clamp-3 text-xs leading-[1.2] font-semibold break-words hyphens-auto">{name}</span>
        <span className="flex w-full items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 font-medium">
            <StateIcon state={state} />
            {short}
            {state === "approved" && grade !== null && <span className="text-base leading-none font-bold">{grade}</span>}
          </span>
          {item.type === "subject" && <span className="text-[10.5px] font-medium whitespace-nowrap opacity-75">{item.subject.credits} C</span>}
        </span>
      </button>
    </div>
  );
}

/** Ficha flotante al lado de la materia; se corre para no salirse del mapa. */
function Popover(props: { x: number; y: number; containerWidth: number; containerHeight: number; children: ReactNode }) {
  const { x, y, containerWidth, containerHeight, children } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(y);
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 0;
    setTop(Math.max(6, Math.min(y, containerHeight - h - 6)));
  }, [y, containerHeight, children]);
  const left = x + NODE_W + 12 + 240 > containerWidth ? x - 252 : x + NODE_W + 12;
  return (
    <div ref={ref} className="absolute z-40" style={{ left, top }}>
      {children}
    </div>
  );
}

const TAG_STYLE: Record<DisplayState, string> = {
  approved: "bg-mint text-mint-ink",
  final_pending: "bg-butter text-butter-ink",
  in_progress: "bg-sky text-sky-ink",
  enabled: "bg-surface text-ink border border-enabled-line",
  blocked: "bg-blocked text-blocked-ink",
};

function Tag({ state, children }: { state: DisplayState; children: ReactNode }) {
  return <span className={`flex-none rounded-full px-2 py-px text-[11px] font-semibold ${TAG_STYLE[state]}`}>{children}</span>;
}

function SectionTitle({ line, children }: { line?: "solid" | "dashed"; children: ReactNode }) {
  return (
    <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] text-muted">
      {line && <span className={`w-4 border-t-2 border-accent ${line === "dashed" ? "border-dashed" : ""}`} />}
      {children}
    </div>
  );
}

function SubjectCard(props: {
  map: CareerMap;
  item: MapItem;
  progress: Progress;
  credits: number;
  stateOf: (item: MapItem) => DisplayState;
  firstLoad: boolean;
  pending: boolean;
  inSequence: boolean;
  electiveGroup?: string | null;
  onGrade: (grade: number) => void;
  onState: (state: ButtonState) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const { map, item, progress, credits, stateOf, firstLoad, pending, inSequence, electiveGroup, onGrade, onState, onPrev, onNext, onClose } = props;
  const state = stateOf(item);
  const isReq = item.type === "requirement";
  const subject = item.type === "subject" ? item.subject : null;
  const own = subject ? (progress.subjects.get(subject.id) ?? null) : null;
  const grade = own?.status === "approved" ? own.grade : null;
  const name = subject ? subject.name : item.type === "requirement" ? item.requirement.name : "";
  const isElective = subject?.kind === "elective" || subject?.kind === "orientation";

  const sub = isReq
    ? `Requisito · ${state === "approved" ? "Aprobada" : "Pendiente"}`
    : `${subject!.credits} créditos · ${state === "approved" && grade !== null ? `Aprobada con ${grade}` : STATE_LABEL[state]}`;

  // Necesita
  const cbcNode = map.cbcNode;
  const prereqRows = subject
    ? subject.prerequisites.map((p) => {
        if (cbcNode && p === cbcNode.id) {
          const ok = map.cbcComplete(progress);
          return { key: "cbc", name: `Ciclo Básico Común (${map.cbcSubjects.length} materias)`, state: (ok ? "approved" : "blocked") as DisplayState, label: ok ? "Completo" : "Incompleto" };
        }
        const s = map.byId.get(p)!;
        const st = map.displayState(progress, p, credits);
        return { key: String(p), name: s.name, state: st, label: STATE_LABEL[st] };
      })
    : [];
  if (subject?.requiresCbc && !(cbcNode && subject.prerequisites.includes(cbcNode.id))) {
    const ok = map.cbcComplete(progress);
    prereqRows.unshift({ key: "cbc", name: "Ciclo Básico Común completo", state: ok ? "approved" : "blocked", label: ok ? "Completo" : "Incompleto" });
  }
  const rc = subject?.requiredCredits ?? null;

  const buttons: [ButtonState, string][] = isReq
    ? [
        ["approved", "Aprobada"],
        ["none", "Pendiente"],
      ]
    : firstLoad
      ? [
          ["final_pending", "Final pend."],
          ["in_progress", "Cursando"],
          ["none", "Sin cursar"],
        ]
      : [
          ["approved", "Aprobada"],
          ["final_pending", "Final pendiente"],
          ["in_progress", "Cursando"],
          ["none", "Sin cursar"],
        ];
  const current: ButtonState = isReq ? (state === "approved" ? "approved" : "none") : (own?.status ?? "none");

  const gradeButtons = (big: boolean) => (
    <div className="flex gap-1">
      {GRADES.map((g) => {
        const on = grade === g;
        return (
          <button
            key={g}
            type="button"
            aria-pressed={on}
            aria-label={`Nota ${g}`}
            onClick={() => onGrade(g)}
            className={`flex-1 rounded-[7px] p-0 font-semibold ${big ? "h-9 text-sm" : "h-[30px] text-[13px]"} ${on ? "border border-accent bg-accent text-on-accent" : "border border-line bg-surface text-ink"}`}
          >
            {g}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      role="dialog"
      aria-label={name}
      className="flex w-[240px] flex-col gap-[7px] rounded-[14px] border border-line bg-surface px-3.5 pt-3.5 pb-3 text-left text-[13px] leading-[1.3] text-ink shadow-[0_12px_32px_var(--pop-shadow)]"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          {isElective && (
            <div className="text-[11px] font-semibold tracking-[0.08em] text-muted">
              {electiveGroup ? `ELECTIVA · ${electiveGroup.toUpperCase()}` : "ELECTIVA"}
            </div>
          )}
          <div className="text-[15px] leading-tight font-semibold">{name}</div>
          <div className="mt-0.5 text-xs text-muted">{sub}</div>
        </div>
        <button type="button" aria-label="Cerrar" onClick={onClose} className="grid size-7 flex-none place-items-center rounded-lg bg-bg text-muted">
          <CloseIcon />
        </button>
      </div>

      {firstLoad ? (
        <>
          {!isReq && (
            <>
              <SectionTitle>APROBADA CON</SectionTitle>
              {gradeButtons(true)}
            </>
          )}
          <div className={`mt-1.5 grid gap-1.5 ${buttons.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {buttons.map(([s, label]) => (
              <StateButton key={s} on={current === s && (s !== "none" || isReq)} onClick={() => onState(s)}>
                {label}
              </StateButton>
            ))}
          </div>
          {inSequence && (
            <div className="mt-1 flex justify-between border-t border-line pt-2 text-[12.5px]">
              <button type="button" onClick={onPrev} className="py-0.5 text-muted">
                ← Anterior
              </button>
              <button type="button" onClick={onNext} className="py-0.5 font-semibold text-accent">
                Siguiente →
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {!isReq && (
            <>
              <SectionTitle line="solid">NECESITA</SectionTitle>
              {prereqRows.length === 0 && rc === null && <div className="text-muted">Sin correlativas</div>}
              {prereqRows.map((r) => (
                <div key={r.key} className="flex items-center justify-between gap-2">
                  <span>{r.name}</span>
                  <Tag state={r.state}>{r.label}</Tag>
                </div>
              ))}
              {rc !== null && (
                <div className="flex items-center justify-between gap-2">
                  <span>{rc} créditos aprobados</span>
                  <Tag state={credits >= rc ? "approved" : "blocked"}>Tenés {credits}</Tag>
                </div>
              )}
            </>
          )}
          <SectionTitle line="dashed">HABILITA</SectionTitle>
          <div className="text-muted">{isReq ? "Es requisito para recibirte (no da créditos)" : map.unlockText(subject!.id)}</div>
          <SectionTitle>TU ESTADO</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {buttons.map(([s, label]) => (
              <StateButton key={s} on={current === s} waiting={pending && s === "approved"} onClick={() => onState(s)}>
                {label}
              </StateButton>
            ))}
          </div>
          {!isReq && (current === "approved" || pending) && (
            <>
              <SectionTitle>{pending ? "ELEGÍ LA NOTA PARA APROBARLA" : "NOTA"}</SectionTitle>
              {gradeButtons(false)}
            </>
          )}
        </>
      )}
    </div>
  );
}

function StateButton({ on, waiting, onClick, children }: { on: boolean; waiting?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on || waiting}
      onClick={onClick}
      className={`h-8 rounded-lg px-0.5 text-xs whitespace-nowrap text-ink ${
        on
          ? "border-[1.5px] border-accent bg-accent-soft font-semibold"
          : waiting
            ? "border-[1.5px] border-dashed border-accent bg-surface font-semibold"
            : "border border-line bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
