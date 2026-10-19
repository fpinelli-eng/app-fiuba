// From the text pasted by an admin to the rows of `offerings` and `offering_blocks` of one
// plan (admin prototype 13-administracion). Pure functions: the screen shows the preview
// and the publish action writes the drafts.

import { normalizeText } from "../map/model";
import { courseOptions, type CourseOption } from "../plan/options";
import { parseSiuOffer, type SiuFormat, type Teacher } from "../siu/parser";

/** A subject of the plan, as stored in `subjects`. */
export interface PlanSubjectRef {
  id: number;
  name: string;
}

export interface MatchedSubject {
  siuCode: string;
  siuName: string;
  subjectId: number;
  subjectName: string;
  courses: number;
}

export interface UnmatchedSubject {
  siuCode: string;
  siuName: string;
  courses: number;
}

/** What the admin sees after "Procesar". Stored in offer_imports.parsed. */
export interface ImportPreview {
  format: SiuFormat | null;
  /** e.g. "2026 - 2do Cuatrimestre", when the pasted text says it. */
  periodo: string | null;
  stats: { subjects: number; courses: number; blocks: number };
  warnings: string[];
  matched: MatchedSubject[];
  /** SIU subjects that are not in this plan (other plan of the career, other careers): ignored. */
  unmatched: UnmatchedSubject[];
  /** "Reemplazar con otro texto": the published import this one replaces, to restore it on "Descartar". */
  replacing?: { rawText: string; preview: ImportPreview; publishedAt: string | null };
  /** "Cursos con cambios": commissions that may or may not be a course of the previous term. */
  changes?: CourseChange[];
  /** What the admin chose for each change (by commissionKey). Missing: the suggestion. */
  decisions?: Record<string, CourseDecision>;
}

/** Same course as an earlier one (keeps its reviews), a new course, or new and hidden. */
export type CourseDecision = { kind: "same"; courseId: number } | { kind: "new" } | { kind: "hide" };

/** A course of the previous term the commission could be. */
export interface CourseCandidate {
  courseId: number;
  /** "Curso 3" */
  label: string;
  /** "Vargas, Torlasco" */
  teachers: string;
  /** "1C 2026" */
  term: string;
}

export interface CourseChange {
  /** commissionKey of the new commission. */
  key: string;
  siuCode: string;
  subjectName: string;
  /** "Curso 2" */
  label: string;
  teachers: string;
  /** Why it is listed: "Cambió el titular", "Cambió el número", "Curso nuevo". */
  reason: string;
  candidates: CourseCandidate[];
  suggestion: CourseDecision;
}

/** A commission published in an earlier term (from `offerings`). */
export interface PreviousOffering {
  courseId: number;
  termId: string;
  siuCode: string;
  courseNumber: string | null;
  label: string;
  teachers: { nombre: string }[] | null;
}

/** Same row of `offerings` across publications: subject, course number and practice. */
export function offeringKey(d: { siu_subject_code: string; course_number: string | null; practice: string | null }): string {
  return `${d.siu_subject_code}|${d.course_number ?? ""}|${d.practice ?? ""}`;
}

export interface BlockDraft {
  weekday: number; // 1 = Monday
  starts_at: number; // minutes since midnight
  ends_at: number;
  class_type: string;
  room: string | null;
  campus: "PC" | "LH" | "CU" | null;
  is_async: boolean;
}

/** One row of `offerings`, before it has a course_id. */
export interface OfferingDraft {
  subjectId: number;
  siu_subject_code: string;
  siu_subject_name: string;
  course_number: string | null;
  practice: string | null;
  label: string;
  modality: string | null;
  teachers: Teacher[];
  quota: number | null;
  enrolled: number | null;
  blocks: BlockDraft[];
}

const WEEKDAY: Record<string, number> = {
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
  Domingo: 7,
};

const CAMPUS_CODE = { "Paseo Colón": "PC", "Las Heras": "LH", "Ciudad Universitaria": "CU" } as const;

function toDraft(option: CourseOption, subjectId: number): OfferingDraft {
  return {
    subjectId,
    siu_subject_code: option.subjectCode,
    siu_subject_name: option.subjectName,
    course_number: option.courseNumber,
    practice: option.practice,
    label: option.label,
    modality: option.modality,
    teachers: option.teachers,
    quota: option.quota,
    enrolled: option.enrolled,
    blocks: option.blocks.map((b) => ({
      weekday: WEEKDAY[b.day],
      starts_at: b.start,
      ends_at: b.end,
      class_type: b.type,
      room: b.room,
      campus: b.campus ? CAMPUS_CODE[b.campus] : null,
      is_async: b.async,
    })),
  };
}

/**
 * Parses the pasted text and keeps the subjects of the plan. A SIU subject belongs to the
 * plan when its code is already known (`subject_siu_codes`) or, failing that, when its
 * name is the same as a plan subject's (ignoring accents and case).
 */
export function previewImport(
  text: string,
  planSubjects: PlanSubjectRef[],
  knownCodes: Map<string, number>,
): { preview: ImportPreview; drafts: OfferingDraft[] } {
  const { offer, warnings, format } = parseSiuOffer(text);
  const byId = new Map(planSubjects.map((s) => [s.id, s]));
  const byName = new Map(planSubjects.map((s) => [normalizeText(s.name), s]));

  const matched: MatchedSubject[] = [];
  const unmatched: UnmatchedSubject[] = [];
  const drafts: OfferingDraft[] = [];

  for (const subject of offer.materias) {
    const options = courseOptions(subject);
    if (options.length === 0) continue; // only CONDICIONALES
    const known = knownCodes.get(subject.codigo);
    const planSubject = (known !== undefined ? byId.get(known) : undefined) ?? byName.get(normalizeText(subject.nombre));
    if (!planSubject) {
      unmatched.push({ siuCode: subject.codigo, siuName: subject.nombre, courses: options.length });
      continue;
    }
    matched.push({
      siuCode: subject.codigo,
      siuName: subject.nombre,
      subjectId: planSubject.id,
      subjectName: planSubject.name,
      courses: options.length,
    });
    drafts.push(...options.map((o) => toDraft(o, planSubject.id)));
  }

  return {
    preview: {
      format,
      periodo: offer.periodo,
      stats: {
        subjects: matched.length,
        courses: drafts.length,
        blocks: drafts.reduce((n, d) => n + d.blocks.length, 0),
      },
      warnings,
      matched,
      unmatched,
    },
    drafts,
  };
}

/** The same commission is offered to several plans: they share one course (and its reviews). */
export function commissionKey(d: Pick<OfferingDraft, "siu_subject_code" | "course_number" | "label">): string {
  return `${d.siu_subject_code}|${d.course_number ?? d.label}`;
}

/** First teacher's name in capitals: the lead of the commission. */
export function leadOf(teachers: Pick<Teacher, "nombre">[] | null | undefined): string {
  return (teachers?.[0]?.nombre ?? "").toUpperCase().trim();
}

/**
 * A commission of an earlier term is the same course when it keeps its number and its
 * lead teacher. "VARGAS" (public table) and "VARGAS GABRIELA" (detail) are the same lead.
 * Changes (new number, new lead) get a new course; reviewing them is the next step of the
 * admin screen ("Cursos con cambios").
 */
export function sameLead(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);
}

/** "2026 - 2do Cuatrimestre" → { year: 2026, half: 2 } */
export function termFromPeriodo(periodo: string | null): { year: number; half: 1 | 2 } | null {
  const m = periodo?.match(/(\d{4})\s*-\s*(\d)/);
  if (!m) return null;
  const half = Number(m[2]);
  return half === 1 || half === 2 ? { year: Number(m[1]), half } : null;
}

const upperNames = (teachers: { nombre: string }[] | null | undefined) =>
  (teachers ?? []).map((t) => t.nombre.toUpperCase().trim()).filter(Boolean);

/** Teachers are written "VARGAS GABRIELA" (detail) or "VARGAS" (public table). */
function shareTeacher(a: string[], b: string[]): boolean {
  return a.some((x) => b.some((y) => sameLead(x, y)));
}

const termName = (termId: string) => {
  const [year, half] = termId.split("-");
  return half && year ? `${half} ${year}` : termId;
};

const surnameOf = (name: string) => name.split(/\s+/)[0] ?? name;
const shortList = (names: string[]) => {
  const unique = [...new Set(names.map(surnameOf))].map((n) => n.charAt(0) + n.slice(1).toLowerCase());
  return unique.length > 3 ? `${unique.slice(0, 3).join(", ")} +${unique.length - 3}` : unique.join(", ");
};

/**
 * "Cursos con cambios" (PRODUCTO.md, section 8). Each commission of the new text is compared
 * with the same subject's commissions in the latest earlier term it was offered:
 * - same number and same lead teacher: the same course, nothing to ask;
 * - same number, another lead: "Cambió el titular" (suggested: same course if they share a teacher);
 * - another number, same lead: "Cambió el número" (suggested: same course);
 * - neither: "Curso nuevo" (suggested: new; earlier courses that share a teacher are offered).
 * Subjects never offered before are not listed: everything is new.
 */
export function detectCourseChanges(
  drafts: OfferingDraft[],
  previous: PreviousOffering[],
  termId: string,
  subjectNames: Map<number, string>,
): CourseChange[] {
  // One entry per commission: practices share the course, and their teachers add up.
  const commissions = new Map<string, { first: OfferingDraft; teachers: string[] }>();
  for (const d of drafts) {
    const key = commissionKey(d);
    const c = commissions.get(key) ?? { first: d, teachers: [] };
    c.teachers.push(...upperNames(d.teachers));
    commissions.set(key, c);
  }

  const changes: CourseChange[] = [];
  for (const [key, { first, teachers }] of commissions) {
    const earlier = previous.filter((p) => p.siuCode === first.siu_subject_code && p.termId < termId);
    if (!earlier.length) continue;
    const lastTerm = earlier.map((p) => p.termId).sort().at(-1)!;
    // One candidate per course of that term, with the teachers of all its practices.
    const byCourse = new Map<number, { p: PreviousOffering; teachers: string[] }>();
    for (const p of earlier.filter((p) => p.termId === lastTerm)) {
      const c = byCourse.get(p.courseId) ?? { p, teachers: [] };
      c.teachers.push(...upperNames(p.teachers));
      byCourse.set(p.courseId, c);
    }
    const courses = [...byCourse.values()];
    const lead = teachers[0] ?? "";
    const leadOfCourse = (c: (typeof courses)[number]) => c.teachers[0] ?? "";

    const sameNumber = courses.filter((c) => c.p.courseNumber !== null && c.p.courseNumber === first.course_number);
    if (sameNumber.some((c) => sameLead(leadOfCourse(c), lead))) continue; // unchanged

    const sameLeadCourses = courses.filter((c) => sameLead(leadOfCourse(c), lead));
    const sharing = courses.filter((c) => shareTeacher(c.teachers, teachers));
    const asCandidate = (c: (typeof courses)[number]): CourseCandidate => ({
      courseId: c.p.courseId,
      label: c.p.label.split(" · ")[0],
      teachers: shortList(c.teachers),
      term: termName(lastTerm),
    });
    const unique = (list: (typeof courses)[number][]) => [...new Map(list.map((c) => [c.p.courseId, c])).values()];

    let reason: string;
    let candidates: (typeof courses)[number][];
    let suggestion: CourseDecision;
    if (sameNumber.length) {
      const was = sameNumber[0];
      reason = `Cambió el titular: antes ${shortList(was.teachers.slice(0, 1)) || "sin docentes"}`;
      candidates = unique([was, ...sameLeadCourses, ...sharing]);
      const pick = shareTeacher(was.teachers, teachers) ? was : sameLeadCourses[0];
      suggestion = pick ? { kind: "same", courseId: pick.p.courseId } : { kind: "new" };
    } else if (sameLeadCourses.length) {
      const was = sameLeadCourses[0];
      reason = `Cambió el número: antes ${was.p.label.split(" · ")[0]}`;
      candidates = unique([was, ...sharing]);
      suggestion = { kind: "same", courseId: was.p.courseId };
    } else {
      reason = sharing.length ? "Curso nuevo que comparte docentes con uno anterior" : "Curso nuevo";
      candidates = unique(sharing);
      suggestion = { kind: "new" };
    }

    changes.push({
      key,
      siuCode: first.siu_subject_code,
      subjectName: subjectNames.get(first.subjectId) ?? first.siu_subject_name,
      label: first.label.split(" · ")[0],
      teachers: shortList(teachers),
      reason,
      candidates: candidates.map(asCandidate),
      suggestion,
    });
  }
  return changes;
}

/** The decision that applies to a commission: the admin's, or else the suggestion. */
export function decisionFor(preview: Pick<ImportPreview, "changes" | "decisions">, key: string): CourseDecision | null {
  return preview.decisions?.[key] ?? preview.changes?.find((c) => c.key === key)?.suggestion ?? null;
}
