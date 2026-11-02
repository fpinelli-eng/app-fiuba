// Exam dates for the admin screen (/admin/examenes): pure helpers to summarize a pasted
// "Fechas de examen" text and turn it into rows of exam_tables.

import { normalizeText } from "../map/model";
import type { ExamParseResult } from "../siu/exams";

export interface ExamStats {
  subjects: number;
  tables: number;
  /** First and last exam day, "YYYY-MM-DD". */
  from: string | null;
  to: string | null;
}

export interface ExamPreview {
  stats: ExamStats;
  warnings: string[];
  /** Set when the filters copied from the SIU are not the chosen plan's ("Ingeniería Civil · 2009"). */
  mismatch: string | null;
  /** Read from the page by its link (with times) or from the copied text (without them). */
  source: "link" | "text";
  rows: ExamPreviewRow[];
}

/** One exam table in the preview list. */
export interface ExamPreviewRow {
  subject: string;
  name: string;
  date: string;
  kind: string;
  startTime: string | null;
  endTime: string | null;
  room: string | null;
}

export interface ExamRow {
  plan_id: string;
  siu_subject_code: string;
  siu_subject_name: string;
  name: string;
  exam_date: string;
  kind: string;
  enroll_from: string | null;
  enroll_to: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  drop_until: string | null;
  teachers: string | null;
}

export function examStats(parsed: ExamParseResult): ExamStats {
  const dates = parsed.subjects.flatMap((s) => s.tables.map((t) => t.date)).sort();
  return {
    subjects: parsed.subjects.filter((s) => s.tables.length).length,
    tables: dates.length,
    from: dates[0] ?? null,
    to: dates.at(-1) ?? null,
  };
}

/** Every exam table, sorted by date and time, for the preview list. */
export function examPreviewRows(parsed: ExamParseResult): ExamPreviewRow[] {
  return parsed.subjects
    .flatMap((s) =>
      s.tables.map((t) => ({
        subject: s.name,
        name: t.name,
        date: t.date,
        kind: t.kind,
        startTime: t.startTime,
        endTime: t.endTime,
        room: t.room,
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}

/** Compares the SIU filters in the copy with the chosen plan, to catch a wrong paste. */
export function planMismatch(parsed: ExamParseResult, careerName: string, year: number): string | null {
  const career = parsed.career && normalizeText(parsed.career) !== normalizeText(careerName) ? parsed.career : null;
  const plan = parsed.plan && parsed.plan !== String(year) ? parsed.plan : null;
  if (!career && !plan) return null;
  return [parsed.career, parsed.plan && `Plan ${parsed.plan}`].filter(Boolean).join(" · ");
}

export function examRows(parsed: ExamParseResult, planId: string): ExamRow[] {
  return parsed.subjects.flatMap((s) =>
    s.tables.map((t) => ({
      plan_id: planId,
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
}
