// Mapa → "Cargar desde el SIU (PDF)": the student's "Historia académica" from SIU Guaraní, read on
// their device. Pure functions (no database, no React, no PDF library): the PDF text comes from
// history-pdf.ts as lines, and these turn it into what to save in user_subjects.
//
// Each page of the PDF has a header ("HISTORIA ACADÉMICA", "Propuesta: Ingeniería Industrial",
// "Alumno: …", "1 de 3 21/11/2026 08:12:44", "Actividad Fecha Tipo Nota Resultado") and one line
// per activity: "ANÁLISIS MATEMÁTICO II (CB001) 06/08/2024 Examen 7 Aprobado". Long names can wrap.

import { normalizeText, type SubjectKind, type SubjectProgress, type SubjectStatus } from "./model";

export type ActivityType = "exam" | "regularity" | "promotion" | "equivalence" | "in_progress";
export type ActivityResult = "approved" | "failed" | "absent" | null;

/** One line of the Historia académica. */
export interface HistoryRow {
  /** As the SIU writes it, with single spaces: "ANÁLISIS MATEMÁTICO II". */
  name: string;
  /** SIU code, "CB001", "CBC62"; null if the PDF did not have one. */
  code: string | null;
  /** ISO date, "2024-08-06". */
  date: string;
  type: ActivityType;
  /** "7", "D" (desaprobado), or null. */
  grade: string | null;
  result: ActivityResult;
}

export interface ParsedHistory {
  /** The title "HISTORIA ACADÉMICA" is there. */
  hasTitle: boolean;
  /** The column header "Actividad Fecha Tipo Nota Resultado" is there. */
  hasColumns: boolean;
  /** "Ingeniería Industrial", from "Propuesta: …"; null if missing. */
  career: string | null;
  rows: HistoryRow[];
  /** Lines with a date that did not read as an activity (to warn, never to guess). */
  unparsed: string[];
  summary: { rows: number; subjects: number; byType: Record<ActivityType, number> };
}

const TYPES: [RegExp, ActivityType][] = [
  [/^examen$/i, "exam"],
  [/^regularidad$/i, "regularity"],
  [/^promoci[oó]n$/i, "promotion"],
  [/^equivalencia$/i, "equivalence"],
  [/^en curso$/i, "in_progress"],
];

const ROW =
  /^(.*?)\s*(?:\(([A-Z0-9][A-Z0-9.\-]*)\))?\s*(\d{2})\/(\d{2})\/(\d{4})\s+(Examen|Regularidad|Promoci[oó]n|Equivalencia|En curso)(?:\s+(\d{1,2}|[A-Z]))?(?:\s+(Aprobad[oa]|Reprobad[oa]|Desaprobad[oa]|Ausente|Libre))?$/i;
const TITLE = /^historia acad[eé]mica$/i;
const COLUMNS = /^actividad\s+fecha\s+tipo\s+nota\s+resultado$/i;
const CAREER = /^propuesta:\s*(.+)$/i;
const STUDENT = /^alumno:/i;
const PAGE = /^\d+\s+de\s+\d+\b/i;
const DATE = /\d{2}\/\d{2}\/\d{4}/;

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

function resultOf(word: string | undefined): ActivityResult {
  if (!word) return null;
  const w = word.toLowerCase();
  if (w.startsWith("aprobad")) return "approved";
  if (w === "ausente") return "absent";
  return "failed"; // Reprobado, Desaprobado, Libre
}

/**
 * Reads the text of a Historia académica: a string (lines separated by newlines) or its lines.
 * A wrapped name is joined back: a line without a date before an activity is the start of its name;
 * after an activity that has no code yet, the rest of it ("PLANETA (TC004)").
 */
export function parseHistoriaAcademica(input: string | string[]): ParsedHistory {
  const lines = (typeof input === "string" ? input.split(/\r?\n/) : input).map(squash).filter(Boolean);
  let hasTitle = false;
  let hasColumns = false;
  let career: string | null = null;
  const rows: HistoryRow[] = [];
  const unparsed: string[] = [];
  let prefix: string[] = [];
  // The last row, while its name is still missing its code (the name wrapped after the date).
  let open: HistoryRow | null = null;

  for (const line of lines) {
    if (TITLE.test(line)) {
      hasTitle = true;
      prefix = [];
      open = null;
      continue;
    }
    if (COLUMNS.test(line)) {
      hasColumns = true;
      prefix = [];
      open = null;
      continue;
    }
    const c = CAREER.exec(line);
    if (c) {
      career ??= c[1].trim();
      prefix = [];
      open = null;
      continue;
    }
    if (STUDENT.test(line) || (PAGE.test(line) && !ROW.test(line))) {
      prefix = [];
      open = null;
      continue;
    }

    const m = ROW.exec(line);
    if (m) {
      const [, rawName, code, dd, mm, yyyy, rawType, grade, result] = m;
      const type = TYPES.find(([re]) => re.test(rawType))![1];
      const row: HistoryRow = {
        name: squash([...prefix, rawName].join(" ")),
        code: code ? code.toUpperCase() : null,
        date: `${yyyy}-${mm}-${dd}`,
        type,
        grade: grade ? grade.toUpperCase() : null,
        result: resultOf(result),
      };
      rows.push(row);
      prefix = [];
      open = row.code ? null : row;
      continue;
    }

    if (DATE.test(line)) {
      unparsed.push(line);
      prefix = [];
      open = null;
      continue;
    }

    // A piece of a wrapped name: activity names are in capitals.
    if (line !== line.toUpperCase() || !/\p{L}/u.test(line)) continue;
    if (open) {
      const tail = /^(.*?)\s*(?:\(([A-Z0-9][A-Z0-9.\-]*)\))?$/.exec(line)!;
      open.name = squash(`${open.name} ${tail[1]}`);
      if (tail[2]) {
        open.code = tail[2];
        open = null;
      }
    } else {
      prefix.push(line);
    }
  }

  const byType: Record<ActivityType, number> = { exam: 0, regularity: 0, promotion: 0, equivalence: 0, in_progress: 0 };
  for (const r of rows) byType[r.type] += 1;
  return {
    hasTitle,
    hasColumns,
    career,
    rows,
    unparsed,
    summary: { rows: rows.length, subjects: new Set(rows.map(rowKey)).size, byType },
  };
}

/** The same subject across rows: its code, or its name when the PDF had no code. */
const rowKey = (r: HistoryRow) => r.code ?? `name:${normalizeName(r.name)}`;

// Validation -------------------------------------------------------------------------------

export type HistoryCheck = { ok: false; error: string } | { ok: true; warnings: string[] };

/** Fewer activities than this, with no regularity nor course in progress, looks like a filtered listing. */
const FEW_ROWS = 6;

/**
 * Only the complete Historia académica works: another report (alumno regular, analítico) would load
 * the wrong thing. A filtered listing (only approved, one period) is allowed, with a warning.
 */
export function checkHistory(parsed: ParsedHistory): HistoryCheck {
  if (!parsed.hasTitle || !parsed.hasColumns) {
    return { ok: false, error: "Este PDF no es la Historia académica completa del SIU." };
  }
  if (parsed.rows.length === 0) {
    return { ok: false, error: "No encontramos materias en este PDF. Fijate que sea la Historia académica completa del SIU." };
  }
  const warnings: string[] = [];
  const { byType } = parsed.summary;
  if (parsed.rows.length < FEW_ROWS || (byType.regularity === 0 && byType.in_progress === 0)) {
    warnings.push(
      "Parece una historia académica incompleta o filtrada. Si en el SIU elegiste un filtro (por ejemplo, solo aprobadas), descargala de nuevo sin filtros.",
    );
  }
  if (parsed.unparsed.length > 0) {
    warnings.push(
      parsed.unparsed.length === 1
        ? "Una línea del PDF no se pudo leer y no se carga."
        : `${parsed.unparsed.length} líneas del PDF no se pudieron leer y no se cargan.`,
    );
  }
  return { ok: true, warnings };
}

// Career -----------------------------------------------------------------------------------

const CAREER_WORDS = new Set(["ingenieria", "ing", "licenciatura", "lic", "en", "de", "y", "la", "el"]);
// The SIU and the app can name the same career differently.
const CAREER_ALIASES: Record<string, string> = {
  electricista: "energia electrica",
  "naval mecanica": "naval",
};

function careerKey(name: string): string {
  const key = normalizeText(name)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w && !CAREER_WORDS.has(w))
    .join(" ");
  return CAREER_ALIASES[key] ?? key;
}

/** "Ingeniería Industrial" (PDF) is the student's "Ingeniería Industrial" (app). */
export function sameCareer(pdfCareer: string | null, appCareer: string): boolean {
  return pdfCareer !== null && careerKey(pdfCareer) !== "" && careerKey(pdfCareer) === careerKey(appCareer);
}

// Interpretation ---------------------------------------------------------------------------

/** What the history says about one subject. */
export interface SubjectOutcome {
  code: string | null;
  name: string;
  /** null: only failed or absent attempts, nothing to load. */
  status: SubjectStatus | null;
  /** Grade of the approval (4–10), or null (by equivalence, or not approved). */
  grade: number | null;
  /** Approved by equivalence, without a grade. */
  equivalence: boolean;
  /** Date of the activity that decided the status (ISO). */
  date: string;
  /** Failed final exams ("Examen … Reprobado"), not absences. */
  failedExams: number;
}

const numericGrade = (g: string | null) => (g !== null && /^\d+$/.test(g) ? Number(g) : null);
const passing = (n: number | null): n is number => n !== null && n >= 4 && n <= 10;

/**
 * One outcome per subject, the best one:
 * - approved: an exam, promotion or equivalence with "Aprobado" (the latest, if several). With a
 *   grade from 4 to 10 it keeps it; an approved equivalence without one is "by equivalence";
 * - final pending: an approved regularity and no approval;
 * - in progress: "En curso" and nothing of the above.
 * Failed and absent attempts approve nothing; failed exams are counted (aplazos).
 */
export function interpretHistory(rows: HistoryRow[]): SubjectOutcome[] {
  const groups = new Map<string, HistoryRow[]>();
  for (const r of rows) groups.set(rowKey(r), [...(groups.get(rowKey(r)) ?? []), r]);

  const out: SubjectOutcome[] = [];
  for (const list of groups.values()) {
    const byDate = [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
    const failedExams = list.filter((r) => r.type === "exam" && r.result === "failed").length;
    const name = byDate[0].name;
    const code = byDate[0].code;

    const approval = byDate.find((r) => {
      if (r.result !== "approved") return false;
      if (r.type === "exam" || r.type === "promotion") return passing(numericGrade(r.grade));
      return r.type === "equivalence";
    });
    if (approval) {
      const n = numericGrade(approval.grade);
      const graded = passing(n);
      out.push({ code, name, status: "approved", grade: graded ? n : null, equivalence: !graded, date: approval.date, failedExams });
      continue;
    }
    const regular = byDate.find((r) => r.type === "regularity" && r.result === "approved");
    if (regular) {
      out.push({ code, name, status: "final_pending", grade: null, equivalence: false, date: regular.date, failedExams });
      continue;
    }
    const course = byDate.find((r) => r.type === "in_progress");
    if (course) {
      out.push({ code, name, status: "in_progress", grade: null, equivalence: false, date: course.date, failedExams });
      continue;
    }
    out.push({ code, name, status: null, grade: null, equivalence: false, date: byDate[0].date, failedExams });
  }
  return out;
}

/** Failed final exams in the whole history: what the Mapa calls aplazos. */
export const countFailedExams = (rows: HistoryRow[]) => rows.filter((r) => r.type === "exam" && r.result === "failed").length;

// Matching to the plan ---------------------------------------------------------------------

export interface PlanSubjectRef {
  id: number;
  code: string;
  name: string;
  kind: SubjectKind;
}

/** "CBC03" and "CBC3" are the same CBC subject. */
export function normalizeCode(code: string): string {
  const c = code.trim().toUpperCase();
  const cbc = /^CBC0*(\d+)$/.exec(c);
  return cbc ? `CBC${cbc[1]}` : c;
}

/** "ALGEBRA  A" and "Álgebra A" are the same name. */
export function normalizeName(name: string): string {
  return normalizeText(name)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface MatchedOutcome {
  subject: PlanSubjectRef;
  outcome: SubjectOutcome & { status: SubjectStatus };
}

const RANK: Record<SubjectStatus, number> = { approved: 3, final_pending: 2, in_progress: 1 };

/**
 * Each outcome to a subject of the plan: by SIU code (subject_siu_codes, then subjects.code, which
 * is the SIU code for the CBC), then by name. Outcomes with nothing to load are left out; the ones
 * not in the plan come back apart. Two rows on the same subject keep the best.
 */
export function matchToPlan(
  outcomes: SubjectOutcome[],
  subjects: PlanSubjectRef[],
  siuCodes: { subjectId: number; code: string }[],
): { matched: MatchedOutcome[]; unmatched: SubjectOutcome[] } {
  const usable = subjects.filter((s) => s.kind !== "cbc");
  const byId = new Map(usable.map((s) => [s.id, s]));
  const byCode = new Map<string, PlanSubjectRef>();
  for (const c of siuCodes) {
    const s = byId.get(c.subjectId);
    if (s) byCode.set(normalizeCode(c.code), s);
  }
  for (const s of usable) if (!byCode.has(normalizeCode(s.code))) byCode.set(normalizeCode(s.code), s);
  const byName = new Map<string, PlanSubjectRef | null>();
  for (const s of usable) {
    const key = normalizeName(s.name);
    byName.set(key, byName.has(key) ? null : s); // the same name twice: ambiguous, never guessed
  }

  const best = new Map<number, MatchedOutcome>();
  const unmatched: SubjectOutcome[] = [];
  for (const o of outcomes) {
    if (o.status === null) continue;
    const subject = (o.code ? byCode.get(normalizeCode(o.code)) : undefined) ?? byName.get(normalizeName(o.name)) ?? null;
    if (!subject) {
      unmatched.push(o);
      continue;
    }
    const current = best.get(subject.id);
    const status = o.status;
    if (!current || RANK[status] > RANK[current.outcome.status] || (RANK[status] === RANK[current.outcome.status] && o.date > current.outcome.date)) {
      best.set(subject.id, { subject, outcome: { ...o, status } });
    }
  }
  return { matched: [...best.values()], unmatched };
}

// What to save ------------------------------------------------------------------------------

export type ImportChange = "new" | "same" | "different";

export interface ImportItem {
  subject: PlanSubjectRef;
  next: SubjectProgress;
  current: SubjectProgress | null;
  change: ImportChange;
  date: string;
}

export function toProgress(o: MatchedOutcome["outcome"]): SubjectProgress {
  return o.status === "approved"
    ? { status: "approved", grade: o.equivalence ? null : o.grade, equivalence: o.equivalence }
    : { status: o.status, grade: null, equivalence: false };
}

const sameProgress = (a: SubjectProgress, b: SubjectProgress) =>
  a.status === b.status && (a.grade ?? null) === (b.grade ?? null) && (a.equivalence === true) === (b.equivalence === true);

/** Each matched subject against what the Mapa already has. */
export function importItems(matched: MatchedOutcome[], current: Map<number, SubjectProgress>): ImportItem[] {
  return matched.map(({ subject, outcome }) => {
    const next = toProgress(outcome);
    const now = current.get(subject.id) ?? null;
    return { subject, next, current: now, change: now === null ? "new" : sameProgress(now, next) ? "same" : "different", date: outcome.date };
  });
}

/** Rows for one upsert into user_subjects. Without the by_equivalence column, it is not sent. */
export function upsertRows(userId: string, items: ImportItem[], withEquivalence: boolean) {
  return items.map((i) => ({
    user_id: userId,
    subject_id: i.subject.id,
    status: i.next.status,
    grade: i.next.grade,
    ...(withEquivalence ? { by_equivalence: i.next.equivalence === true } : {}),
  }));
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Encontramos 28 aprobadas, 4 finales pendientes y 3 cursando; 2 no están en tu plan." */
export function summaryText(counts: { approved: number; finalPending: number; inProgress: number; unmatched: number }): string {
  const parts = [
    counts.approved ? plural(counts.approved, "aprobada", "aprobadas") : null,
    counts.finalPending ? plural(counts.finalPending, "final pendiente", "finales pendientes") : null,
    counts.inProgress ? `${counts.inProgress} cursando` : null,
  ].filter((p): p is string => p !== null);
  const found = parts.length === 0 ? "ninguna materia para cargar" : parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
  const rest = counts.unmatched ? `; ${counts.unmatched} ${counts.unmatched === 1 ? "no está" : "no están"} en tu plan` : "";
  return `Encontramos ${found}${rest}.`;
}
