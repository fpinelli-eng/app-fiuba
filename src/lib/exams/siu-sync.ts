// Daily copy of the SIU's exam dates for every mapped plan (tools/exams/sync.mjs, workflow
// "Fechas de examen del SIU"). Pure (no network, no database): the script downloads each plan's
// public "Fechas de examen" search, parses it with parseSiuExamsHtml() and uses these helpers to
// decide whether the result is safe to publish and what changed against the rows in the database.
// Runs in Node with type stripping, so: only type annotations, no enums or path aliases.

import type { ExamRow } from "../admin/exams";
import { normalizeText } from "../map/model";
import type { ExamParseResult } from "../siu/exams";

/**
 * One SIU search of an app plan, from data/siu/exam-filters.json. A plan can have more than one
 * (the SIU splits some old plans in two, like Química "1986" and "1986M"): its tables are the
 * union of all its searches.
 */
export interface ExamFilter {
  planId: string;
  /** The SIU's ids ("_ID_" of its select options) and the names it shows for them. */
  career: { id: string; name: string };
  plan: { id: string; name: string };
}

export interface ExamFilters {
  /** "Responsable académica" and "Ubicación": both FIUBA's single entry. */
  ra: string;
  ubicacion: string;
  plans: ExamFilter[];
}

const SIU_ID = /^[0-9a-f]{40}$/;

/** Checks the mapping file: ids look like the SIU's, no search appears twice. Throws otherwise. */
export function validateFilters(data: unknown): ExamFilters {
  const d = data as Partial<ExamFilters> | null;
  const fail = (msg: string): never => {
    throw new Error(`exam-filters.json: ${msg}`);
  };
  if (!d || typeof d !== "object") fail("no es un objeto");
  if (!SIU_ID.test(String(d?.ra)) || !SIU_ID.test(String(d?.ubicacion))) fail("ra o ubicacion no son ids del SIU");
  if (!Array.isArray(d?.plans) || d.plans.length === 0) fail("no hay planes");
  const seen = new Set<string>();
  for (const p of d!.plans!) {
    const id = p?.planId;
    if (typeof id !== "string" || !/^[a-z-]+-\d{4}$/.test(id)) fail(`planId inválido: ${String(id)}`);
    for (const key of ["career", "plan"] as const) {
      const f = p[key];
      if (!f || !SIU_ID.test(String(f.id)) || typeof f.name !== "string" || !f.name.trim()) fail(`${id}: ${key} incompleto`);
    }
    const search = `${id} ${p.career.id} ${p.plan.id}`;
    if (seen.has(search)) fail(`${id} está dos veces`);
    seen.add(search);
  }
  return d as ExamFilters;
}

/** The searches of each plan, in the file's order. */
export function groupFilters(filters: ExamFilter[]): Map<string, ExamFilter[]> {
  const groups = new Map<string, ExamFilter[]>();
  for (const f of filters) groups.set(f.planId, [...(groups.get(f.planId) ?? []), f]);
  return groups;
}

/** The address of a plan's search in the SIU, as the page's own form builds it after "Buscar". */
export function siuSearchUrl(filters: Pick<ExamFilters, "ra" | "ubicacion">, filter: ExamFilter): string {
  const q = new URLSearchParams();
  const set = (name: string, value: string) => q.set(`formulario_filtro[${name}]`, value);
  set("ra", filters.ra);
  set("ubicacion", filters.ubicacion);
  set("carrera", filter.career.id);
  set("plan", filter.plan.id);
  set("materia", "");
  set("tipo_mesa", "");
  set("fecha_desde", "");
  set("fecha_hasta", "");
  return `https://guaraniautogestion.fi.uba.ar/g3w/fecha_examen?${q}`;
}

/** One exam table as stored, without the plan (the plan goes once per plan in the payload). */
export type SyncRow = Omit<ExamRow, "plan_id">;

export type SyncCheck = { rows: SyncRow[] } | { skip: string };

/**
 * Whether a parsed page can replace the plan's exam tables. Never with zero tables (an error
 * page, a format change or a search with nothing published would wipe the plan) nor when the
 * page shows another career or plan than the one asked for (the SIU renumbered its options).
 */
export function checkSync(parsed: ExamParseResult, filter: ExamFilter): SyncCheck {
  const same = (a: string | null, b: string) => a !== null && normalizeText(a) === normalizeText(b);
  if (!same(parsed.career, filter.career.name) || !same(parsed.plan, filter.plan.name)) {
    return { skip: "el SIU no devolvió la carrera y el plan pedidos" };
  }
  const rows = parsed.subjects.flatMap((s) =>
    s.tables.map((t) => ({
      siu_subject_code: s.code,
      siu_subject_name: s.name,
      name: t.name,
      exam_date: t.date,
      kind: t.kind,
      enroll_from: t.enrollFrom,
      enroll_to: t.enrollTo,
      start_time: t.startTime,
      end_time: t.endTime,
      room: t.room,
      drop_until: t.dropUntil,
      teachers: t.teachers,
    })),
  );
  if (rows.length === 0) return { skip: NO_TABLES };
  return { rows };
}

const NO_TABLES = "el SIU no devolvió mesas";

/**
 * checkSync() for a plan with one or more SIU searches. A search of another career or plan skips
 * the whole plan; an empty search is fine while another one has tables. A table listed by two
 * searches (the same exam, shown in both SIU plans) is kept once.
 */
export function checkPlanSync(pages: { parsed: ExamParseResult; filter: ExamFilter }[]): SyncCheck {
  const kept = new Map<string, { row: SyncRow; count: number }>();
  for (const { parsed, filter } of pages) {
    const check = checkSync(parsed, filter);
    if ("skip" in check) {
      if (check.skip === NO_TABLES) continue;
      return check;
    }
    const counts = new Map<string, { row: SyncRow; count: number }>();
    for (const row of check.rows) {
      const key = JSON.stringify(row);
      counts.set(key, { row, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    for (const [key, c] of counts) if (c.count > (kept.get(key)?.count ?? 0)) kept.set(key, c);
  }
  const rows = [...kept.values()].flatMap((c) => Array.from({ length: c.count }, () => c.row));
  return rows.length ? { rows } : { skip: NO_TABLES };
}

const DATE_TIME_KEYS = ["enroll_from", "enroll_to", "drop_until"] as const;
const TIME_KEYS = ["start_time", "end_time"] as const;

/** A row from the database in the parser's formats ("2026-11-16T08:00", "17:00"). */
export function normalizeRow(row: Record<string, unknown>): SyncRow {
  const text = (v: unknown) => (v === null || v === undefined ? null : String(v));
  const out = {
    siu_subject_code: String(row.siu_subject_code ?? ""),
    siu_subject_name: String(row.siu_subject_name ?? ""),
    name: String(row.name ?? ""),
    exam_date: String(row.exam_date ?? "").slice(0, 10),
    kind: String(row.kind ?? ""),
    enroll_from: null,
    enroll_to: null,
    start_time: null,
    end_time: null,
    room: text(row.room),
    drop_until: null,
    teachers: text(row.teachers),
  } as SyncRow;
  for (const k of DATE_TIME_KEYS) out[k] = text(row[k])?.replace(" ", "T").slice(0, 16) ?? null;
  for (const k of TIME_KEYS) out[k] = text(row[k])?.slice(0, 5) ?? null;
  return out;
}

export interface ExamDiff {
  added: number;
  removed: number;
  /** Same subject, name, kind and day, with other details (time, room, enrollment, teachers…). */
  changed: number;
  unchanged: number;
}

const identity = (r: SyncRow) => [r.siu_subject_code, r.name, r.kind, r.exam_date].join("\u0000");
const signature = (r: SyncRow) =>
  JSON.stringify([
    r.siu_subject_name, r.enroll_from, r.enroll_to, r.start_time, r.end_time, r.room, r.drop_until, r.teachers,
  ]);

/** What replacing `before` with `after` changes. A new day for a table counts as removed + added. */
export function diffExamRows(before: SyncRow[], after: SyncRow[]): ExamDiff {
  const groups = new Map<string, { before: string[]; after: string[] }>();
  const add = (r: SyncRow, side: "before" | "after") => {
    const key = identity(r);
    const g = groups.get(key) ?? { before: [], after: [] };
    g[side].push(signature(r));
    groups.set(key, g);
  };
  before.forEach((r) => add(r, "before"));
  after.forEach((r) => add(r, "after"));

  const diff: ExamDiff = { added: 0, removed: 0, changed: 0, unchanged: 0 };
  for (const g of groups.values()) {
    const rest = [...g.before];
    let unmatched = 0;
    for (const s of g.after) {
      const i = rest.indexOf(s);
      if (i >= 0) {
        rest.splice(i, 1);
        diff.unchanged++;
      } else {
        unmatched++;
      }
    }
    const changed = Math.min(unmatched, rest.length);
    diff.changed += changed;
    diff.added += unmatched - changed;
    diff.removed += rest.length - changed;
  }
  return diff;
}

export const hasChanges = (d: ExamDiff) => d.added + d.removed + d.changed > 0;

export type PlanOutcome =
  | { planId: string; skip: string }
  | { planId: string; tables: number; diff: ExamDiff | null };

/** Markdown for the job summary: one line per plan, counts only (the repository and its logs are public). */
export function summaryMarkdown(outcomes: PlanOutcome[], dryRun: boolean): string {
  const lines = outcomes.map((o) => {
    if ("skip" in o) return `| ${o.planId} | — | salteado: ${o.skip} |`;
    if (!o.diff) return `| ${o.planId} | ${o.tables} | prueba, sin comparar con la base |`;
    const d = o.diff;
    const what = hasChanges(d) ? `+${d.added} nuevas, −${d.removed} quitadas, ${d.changed} cambiadas` : "sin cambios";
    return `| ${o.planId} | ${o.tables} | ${what} |`;
  });
  const ok = outcomes.filter((o) => !("skip" in o)).length;
  const changed = outcomes.filter((o) => "diff" in o && o.diff && hasChanges(o.diff)).length;
  const head = dryRun
    ? `Prueba: ${ok} de ${outcomes.length} planes leídos, nada se guardó.`
    : `${ok} de ${outcomes.length} planes leídos; ${changed} con cambios se actualizaron.`;
  return ["### Fechas de examen del SIU", "", head, "", "| Plan | Mesas | Cambios |", "|---|---:|---|", ...lines, ""].join("\n");
}

/**
 * SQL that records that these plans were read from the SIU now, changed or not
 * (exam_imports.checked_at, migration 20261115130000_salud.sql). The health monitor
 * (Administración → Estado and tools/reminders/apps-script/Salud.gs) uses it to notice when the
 * daily sync stops running: published_at only moves when the dates change. Plan ids come from
 * exam-filters.json and are checked anyway. Does nothing while the column does not exist yet.
 */
export function checkedSql(planIds: string[]): string {
  const ids = planIds.filter((id) => /^[a-z0-9-]+$/.test(id));
  if (!ids.length) return "-- Ningún plan leído.";
  return [
    "do $checked$",
    "begin",
    "  if exists (select 1 from information_schema.columns",
    "             where table_schema = 'public' and table_name = 'exam_imports' and column_name = 'checked_at') then",
    `    update public.exam_imports set checked_at = now() where plan_id in (${ids.map((id) => `'${id}'`).join(", ")});`,
    "  end if;",
    "end",
    "$checked$;",
  ].join("\n");
}
