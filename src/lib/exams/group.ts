// Pure grouping of the plan's exam tables by subject, for the Finales section (unit tested).
import { normalizeText } from "../map/model";
import { titleCase } from "../plan/format";
import type { ExamSubjectView, ExamTableView } from "./types";

/** A row of exam_tables as Supabase returns it. */
export interface ExamTableRow {
  id: number;
  siu_subject_code: string;
  siu_subject_name: string;
  name: string;
  exam_date: string;
  kind: string;
  enroll_from: string | null;
  enroll_to: string | null;
}

export interface PlanSubjectRef {
  id: number;
  name: string;
}

/** "2026-12-07T14:00:00" or "2026-12-07 14:00:00" → "2026-12-07T14:00". */
export function toMoment(value: string | null): string | null {
  return value ? value.replace(" ", "T").slice(0, 16) : null;
}

/**
 * Groups upcoming exam tables by plan subject (by known SIU code, then by name) and returns
 * every subject with tables, sorted by name, plus the pending finals in the given order
 * (with `tables: []` when they have none). Rows must come sorted by date and name.
 */
export function groupExamTables(input: {
  rows: ExamTableRow[];
  /** Plan subjects in map order. */
  subjects: PlanSubjectRef[];
  /** siu_code → subject id, from subject_siu_codes. */
  subjectByCode: Map<string, number>;
  pendingIds: number[];
}): { all: ExamSubjectView[]; pending: ExamSubjectView[] } {
  const { rows, subjects, subjectByCode, pendingIds } = input;
  const byName = new Map(subjects.map((s) => [normalizeText(s.name), s]));
  const byId = new Map(subjects.map((s) => [s.id, s]));

  const groups = new Map<string, ExamSubjectView>();
  for (const r of rows) {
    const codeId = subjectByCode.get(r.siu_subject_code);
    const subject = (codeId !== undefined ? byId.get(codeId) : undefined) ?? byName.get(normalizeText(r.siu_subject_name));
    const key = subject ? String(subject.id) : r.siu_subject_code;
    let group = groups.get(key);
    if (!group) {
      group = { key, name: subject ? subject.name : titleCase(r.siu_subject_name), code: r.siu_subject_code, tables: [] };
      groups.set(key, group);
    }
    const table: ExamTableView = {
      id: r.id,
      name: r.name,
      date: r.exam_date,
      kind: r.kind,
      enrollFrom: toMoment(r.enroll_from),
      enrollTo: toMoment(r.enroll_to),
    };
    group.tables.push(table);
  }
  // Several SIU codes of one subject may interleave: keep each subject's tables in date order.
  for (const g of groups.values()) {
    g.tables.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name, "es", { numeric: true }));
  }

  const all = [...groups.values()].sort((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name), "es"));
  const pending = pendingIds
    .map((id) => byId.get(id))
    .filter((s): s is PlanSubjectRef => s !== undefined)
    .map((s) => groups.get(String(s.id)) ?? { key: String(s.id), name: s.name, code: "", tables: [] });

  return { all, pending };
}
