import { createClient } from "@/lib/supabase/server";
import { getMapData } from "@/lib/map/data";
import { CareerMap, normalizeText, type Progress, type SubjectKind } from "@/lib/map/model";
import type { Campus } from "@/lib/siu/parser";
import { shortTeacherList, surname } from "./format";
import type { ClassBlock, CourseOption, WeekDay } from "./options";

// Data of the semester plan (prototype 07-plan): this term's offer for the student's plan,
// only the subjects they can take (or are taking), with review scores and the saved
// "Opción A / B". Server only.

export type SubjectGroup = "obligatorias" | "electivas" | "otras";
export type OptionKey = "A" | "B";
export type Entry = { subject: string; course: string };

export interface Score {
  average: number;
  count: number;
}

export interface PlanCourse extends CourseOption {
  /** "Vargas, Torlasco, Jalife" */
  teacherList: string;
  score: Score | null;
}

export interface PlanSubject {
  /** Subject id in the plan, as text. */
  code: string;
  name: string;
  credits: number | null;
  group: SubjectGroup;
  courses: PlanCourse[];
}

export interface PlanData {
  /** "2C 2026"; null when no term is open yet. */
  term: string | null;
  career: string;
  subjects: PlanSubject[];
  saved: Record<OptionKey, Entry[]>;
  /** Courses of this term the student said they enrolled in ("Me inscribí en esta opción"). */
  enrolled: string[];
}

const DAYS: WeekDay[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const CAMPUS: Record<string, Campus> = { PC: "Paseo Colón", LH: "Las Heras", CU: "Ciudad Universitaria" };

const GROUP_OF: Partial<Record<SubjectKind, SubjectGroup>> = {
  required: "obligatorias",
  final_project: "obligatorias",
  final_option: "obligatorias",
  elective: "electivas",
  orientation: "electivas",
};

type OfferingRow = {
  id: number;
  course_id: number;
  siu_subject_code: string;
  siu_subject_name: string;
  course_number: string | null;
  practice: string | null;
  label: string;
  modality: string | null;
  teachers: { nombre: string; rol: string }[] | null;
  quota: number | null;
  enrolled: number | null;
  offering_blocks: {
    weekday: number;
    starts_at: number;
    ends_at: number;
    class_type: string | null;
    room: string | null;
    campus: string | null;
    is_async: boolean;
  }[];
};

const empty = (term: string | null, career: string): PlanData => ({ term, career, subjects: [], saved: { A: [], B: [] }, enrolled: [] });

export async function getPlanData(userId: string, planId: string): Promise<PlanData> {
  const supabase = await createClient();
  const [map, termRow] = await Promise.all([
    getMapData(userId, planId),
    supabase.from("terms").select("id, year, half").eq("is_current", true).maybeSingle(),
  ]);
  if (termRow.error) throw new Error(`terms: ${termRow.error.message}`);
  const career = `${map.careerName.replace(/^Ingeniería /, "Ing. ")} · Plan ${map.year}`;
  if (!termRow.data) return empty(null, career);
  const term = { id: termRow.data.id as string, label: `${termRow.data.half}C ${termRow.data.year}` };

  // What the student can take: enabled by their map, or already taking it.
  const careerMap = new CareerMap(map.subjects, map.requirements);
  const progress: Progress = {
    subjects: new Map(map.progress.subjects.map((s) => [s.subjectId, { status: s.status, grade: s.grade }])),
    requirements: new Set(map.progress.requirements),
  };
  const credits = careerMap.approvedCredits(progress);
  const available = map.subjects.filter((s) => {
    if (!GROUP_OF[s.kind]) return false;
    const state = careerMap.displayState(progress, s.id, credits);
    return state === "enabled" || state === "in_progress";
  });

  const [codes, offerings] = await Promise.all([
    supabase.from("subject_siu_codes").select("subject_id, siu_code").in("subject_id", map.subjects.map((s) => s.id)),
    supabase
      .from("offerings")
      .select(
        "id, course_id, siu_subject_code, siu_subject_name, course_number, practice, label, modality, teachers, quota, enrolled, offering_blocks(weekday, starts_at, ends_at, class_type, room, campus, is_async)",
      )
      .eq("term_id", term.id)
      .eq("plan_id", planId)
      .eq("visible", true), // admins see hidden offerings too: the plan never shows them
  ]);
  if (codes.error) throw new Error(`subject_siu_codes: ${codes.error.message}`);
  if (offerings.error) throw new Error(`offerings: ${offerings.error.message}`);
  const rows = offerings.data as unknown as OfferingRow[];
  if (rows.length === 0) return empty(term.label, career);

  const byCode = new Map(codes.data.map((c) => [c.siu_code as string, c.subject_id as number]));
  const byName = new Map(map.subjects.map((s) => [normalizeText(s.name), s.id]));
  const subjectOf = (o: OfferingRow) => byCode.get(o.siu_subject_code) ?? byName.get(normalizeText(o.siu_subject_name));

  const ids = rows.map((o) => o.id);
  const [reviews, choices, taken] = await Promise.all([
    supabase.from("reviews").select("course_id, stars").in("course_id", [...new Set(rows.map((o) => o.course_id))]).is("hidden_at", null),
    supabase.from("plan_choices").select("option, offering_id").eq("user_id", userId).in("offering_id", ids),
    supabase.from("user_courses").select("offering_id").eq("user_id", userId).in("offering_id", ids),
  ]);
  if (reviews.error) throw new Error(`reviews: ${reviews.error.message}`);
  if (choices.error) throw new Error(`plan_choices: ${choices.error.message}`);
  if (taken.error) throw new Error(`user_courses: ${taken.error.message}`);

  const scoreOf = new Map<number, Score>();
  for (const r of reviews.data) {
    const s = scoreOf.get(r.course_id as number) ?? { average: 0, count: 0 };
    s.average = (s.average * s.count + (r.stars as number)) / (s.count + 1);
    s.count += 1;
    scoreOf.set(r.course_id as number, s);
  }

  const coursesBy = new Map<number, PlanCourse[]>();
  for (const o of rows) {
    const subjectId = subjectOf(o);
    if (subjectId === undefined) continue;
    const blocks: ClassBlock[] = o.offering_blocks.map((b) => ({
      day: DAYS[b.weekday - 1],
      start: b.starts_at,
      end: b.ends_at,
      type: b.class_type ?? "",
      room: b.room,
      campus: b.campus ? CAMPUS[b.campus] : null,
      async: b.is_async,
    }));
    const teachers = o.teachers ?? [];
    const list = coursesBy.get(subjectId) ?? [];
    list.push({
      id: String(o.id),
      subjectCode: o.siu_subject_code,
      subjectName: o.siu_subject_name,
      label: o.label,
      courseNumber: o.course_number,
      practice: o.practice,
      teachers,
      modality: o.modality,
      blocks,
      quota: o.quota,
      enrolled: o.enrolled,
      teacherList: shortTeacherList(teachers.map((t) => surname(t.nombre, []))),
      score: scoreOf.get(o.course_id) ?? null,
    });
    coursesBy.set(subjectId, list);
  }

  const groupRank: Record<SubjectGroup, number> = { obligatorias: 0, electivas: 1, otras: 2 };
  const subjects: PlanSubject[] = available
    .filter((s) => coursesBy.has(s.id))
    .sort(
      (a, b) =>
        groupRank[GROUP_OF[a.kind]!] - groupRank[GROUP_OF[b.kind]!] ||
        (a.level ?? 99) - (b.level ?? 99) ||
        a.name.localeCompare(b.name, "es"),
    )
    .map((s) => ({
      code: String(s.id),
      name: s.name,
      credits: s.credits,
      group: GROUP_OF[s.kind]!,
      courses: coursesBy.get(s.id)!.sort((x, y) => x.label.localeCompare(y.label, "es", { numeric: true })),
    }));

  // Saved options, only for courses still on screen.
  const subjectOfCourse = new Map(subjects.flatMap((s) => s.courses.map((c) => [c.id, s.code] as const)));
  const saved: Record<OptionKey, Entry[]> = { A: [], B: [] };
  for (const c of choices.data) {
    const course = String(c.offering_id);
    const subject = subjectOfCourse.get(course);
    const option = c.option as OptionKey;
    if (subject && !saved[option].some((e) => e.subject === subject)) saved[option].push({ subject, course });
  }

  return { term: term.label, career, subjects, saved, enrolled: taken.data.map((t) => String(t.offering_id)) };
}
