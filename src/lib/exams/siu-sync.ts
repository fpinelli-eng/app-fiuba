// Daily copy of the SIU's exam dates for every mapped plan (tools/exams/sync.mjs, workflow
// "Fechas de examen del SIU"). Pure (no network, no database): the script downloads each plan's
// public "Fechas de examen" search, parses it with parseSiuExamsHtml() and uses these helpers to
// decide whether the result is safe to publish and which rows to insert, update or delete
// (planExamChanges(): only the rows that changed are written, never a whole plan).
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

/** A row of exam_tables as current.sql prints it: its id and the parser's formats. */
export type StoredRow = SyncRow & { id: number };

/** normalizeRow() keeping the row's id, which must be a positive integer. Throws otherwise. */
export function storedRow(row: Record<string, unknown>): StoredRow {
  const id = Number(row.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`exam_tables: id inválido: ${String(row.id)}`);
  return { id, ...normalizeRow(row) };
}

/**
 * The row-level changes that turn the rows in the database into the SIU's, matched by the natural
 * key (subject code, table name, kind and day; the same one exam_reminders uses):
 * - a row with the same key and the same details stays untouched;
 * - a row with the same key and other details (time, room, enrollment, teachers…) is updated in
 *   place, so its key, id and created_at do not change and reminders keep matching it;
 * - the rest of the SIU's rows are inserted, and the rest of the database's rows deleted.
 * Repeated keys (the SIU lists some tables twice) are paired one by one, in the database's order.
 */
export interface ExamChanges {
  diff: ExamDiff;
  inserts: SyncRow[];
  /** The new values of each changed row, by its id. */
  updates: StoredRow[];
  /** Ids of the rows that are no longer in the SIU. */
  deletes: number[];
}

export function planExamChanges(before: StoredRow[], after: SyncRow[]): ExamChanges {
  const groups = new Map<string, { before: StoredRow[]; after: SyncRow[] }>();
  const group = (r: SyncRow) => {
    const key = identity(r);
    const g = groups.get(key) ?? { before: [], after: [] };
    groups.set(key, g);
    return g;
  };
  before.forEach((r) => group(r).before.push(r));
  after.forEach((r) => group(r).after.push(r));

  const out: ExamChanges = { diff: { added: 0, removed: 0, changed: 0, unchanged: 0 }, inserts: [], updates: [], deletes: [] };
  for (const g of groups.values()) {
    const rest = [...g.before];
    const unmatched: SyncRow[] = [];
    for (const r of g.after) {
      const s = signature(r);
      const i = rest.findIndex((b) => signature(b) === s);
      if (i >= 0) {
        rest.splice(i, 1);
        out.diff.unchanged++;
      } else {
        unmatched.push(r);
      }
    }
    const changed = Math.min(unmatched.length, rest.length);
    for (let i = 0; i < changed; i++) out.updates.push({ ...unmatched[i], id: rest[i].id });
    out.inserts.push(...unmatched.slice(changed));
    out.deletes.push(...rest.slice(changed).map((r) => r.id));
  }
  out.diff.changed = out.updates.length;
  out.diff.added = out.inserts.length;
  out.diff.removed = out.deletes.length;
  return out;
}

/** What replacing `before` with `after` changes. A new day for a table counts as removed + added. */
export function diffExamRows(before: SyncRow[], after: SyncRow[]): ExamDiff {
  return planExamChanges(before.map((r, i) => ({ ...r, id: i + 1 })), after).diff;
}

export const hasChanges = (d: ExamDiff) => d.added + d.removed + d.changed > 0;

/** What tools/exams/apply.sql receives for one plan with changes (the 'exams.payload' setting). */
export interface PlanWrite {
  plan_id: string;
  /** For exam_imports, from all the SIU's rows: { subjects, tables, from, to }. */
  stats: { subjects: number; tables: number; from: string; to: string };
  /** How many rows the plan had when current.sql read it: apply.sql stops if that moved. */
  before: number;
  inserts: SyncRow[];
  updates: StoredRow[];
  deletes: number[];
}

export function planWrite(planId: string, before: StoredRow[], after: SyncRow[], changes: ExamChanges): PlanWrite {
  const dates = after.map((r) => r.exam_date).sort();
  const subjects = new Set(after.map((r) => r.siu_subject_code)).size;
  return {
    plan_id: planId,
    stats: { subjects, tables: after.length, from: dates[0] ?? "", to: dates.at(-1) ?? "" },
    before: before.length,
    inserts: changes.inserts,
    updates: changes.updates,
    deletes: changes.deletes,
  };
}

/** Rows written by these plans' changes (inserted, updated or deleted), for the summary. */
export const writtenRows = (writes: PlanWrite[]) =>
  writes.reduce((n, w) => n + w.inserts.length + w.updates.length + w.deletes.length, 0);

/**
 * The whole SQL file of a run, for psql -v ON_ERROR_STOP=1 -f: one transaction with the changes
 * (if any) and the checked_at of the plans read. The payload goes as a dollar-quoted literal with
 * `tag`, which must not appear in it (nothing in the SIU's text can close it); length() so that
 * psql prints a number, not the payload (teacher names) into the public log. `applyPath` is
 * tools/exams/apply.sql by its full path (the generated file lives in the runner's temp folder).
 * Without changes it writes nothing but exam_imports.checked_at.
 */
export function changesSql(writes: PlanWrite[], readPlanIds: string[], applyPath: string, tag: string): string {
  const sql = ["\\set ON_ERROR_STOP on", "begin;"];
  if (writes.length) {
    const payload = JSON.stringify({ plans: writes });
    if (!/^[a-z_][a-z0-9_]*$/.test(tag) || payload.includes(tag)) throw new Error("Etiqueta inválida para el SQL");
    sql.push(
      `select length(set_config('exams.payload', $${tag}$${payload}$${tag}$, true)) as payload_chars;`,
      `\\i '${applyPath.replaceAll("\\", "/").replaceAll("'", "''")}'`,
    );
  } else {
    sql.push("-- Sin cambios en las fechas.");
  }
  // Also without changes: the plans read now, for the health monitor (Administración → Estado).
  sql.push(checkedSql(readPlanIds), "commit;", "");
  return sql.join("\n");
}

export type PlanOutcome =
  | { planId: string; skip: string }
  | { planId: string; tables: number; diff: ExamDiff | null };

/** Markdown for the job summary: one line per plan, counts only (the repository and its logs are public). */
export function summaryMarkdown(outcomes: PlanOutcome[], dryRun: boolean, written?: number): string {
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
    : `${ok} de ${outcomes.length} planes leídos; ${changed} con cambios se actualizaron` +
      (written === undefined ? "." : ` (${written} ${written === 1 ? "fila escrita" : "filas escritas"} en exam_tables).`);
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
