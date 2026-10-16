import { createClient } from "@/lib/supabase/server";
import { describeSchedule, shortTeacherList, surname, titleCase } from "@/lib/plan/format";
import type { ClassBlock, WeekDay } from "@/lib/plan/options";
import type { Campus } from "@/lib/siu/parser";
import { normalizeText } from "@/lib/map/model";
import { termLabel } from "./mine";
import type { CourseDetail, CourseSummary, ReviewCatalog, Score, SubjectReviews } from "./types";

export type { CourseDetail, CourseSummary, ReviewCatalog, Score, SubjectReviews };

// Data for the review screens: the plan's subjects with the courses offered this term
// and their scores. Reviews belong to a course (stable across terms), not to an offering.
// Hidden reviews and hidden offerings are always left out here, also for admins.

type OfferingRow = {
  id: number;
  course_id: number;
  term_id: string;
  siu_subject_code: string;
  siu_subject_name: string;
  label: string;
  teachers: { nombre: string; rol: string }[] | null;
};

const KIND_LABEL: Record<string, string> = {
  required: "Obligatoria",
  elective: "Electiva",
  orientation: "Electiva",
  final_project: "Trabajo final",
  final_option: "Trabajo final",
};

const DAYS: WeekDay[] = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const CAMPUS: Record<string, Campus> = { PC: "Paseo Colón", LH: "Las Heras", CU: "Ciudad Universitaria" };

/** "Curso 1 · práctica A" → "Curso 1": practices of one course share its reviews. */
const courseLabel = (label: string) => label.split(" · ")[0];

const teacherList = (offerings: OfferingRow[]) =>
  shortTeacherList(offerings.flatMap((o) => (o.teachers ?? []).map((t) => surname(t.nombre, []))));

/** Subjects of the plan that have courses (no CBC), and how to find them from an offering. */
async function planSubjects(planId: string) {
  const supabase = await createClient();
  const { data: subjects, error } = await supabase
    .from("subjects")
    .select("id, name, credits, kind")
    .eq("plan_id", planId)
    .not("kind", "in", "(cbc,cbc_subject)")
    .order("name");
  if (error) throw new Error(`subjects: ${error.message}`);
  const { data: codes, error: codesError } = await supabase
    .from("subject_siu_codes")
    .select("subject_id, siu_code")
    .in("subject_id", subjects.map((s) => s.id as number));
  if (codesError) throw new Error(`subject_siu_codes: ${codesError.message}`);

  const byCode = new Map(codes.map((c) => [c.siu_code as string, c.subject_id as number]));
  const byName = new Map(subjects.map((s) => [normalizeText(s.name as string), s.id as number]));
  // The SIU code table is the source of truth; until the admin fills it, the subject name decides.
  const subjectOf = (o: Pick<OfferingRow, "siu_subject_code" | "siu_subject_name">) =>
    byCode.get(o.siu_subject_code) ?? byName.get(normalizeText(o.siu_subject_name));

  return { subjects, subjectOf };
}

async function scores(courseIds: number[]) {
  const supabase = await createClient();
  const out = new Map<number, Score>();
  if (!courseIds.length) return out;
  const { data, error } = await supabase.from("reviews").select("course_id, stars").in("course_id", courseIds).is("hidden_at", null);
  if (error) throw new Error(`reviews: ${error.message}`);
  for (const r of data) {
    const s = out.get(r.course_id as number) ?? { average: 0, count: 0 };
    s.average = (s.average * s.count + (r.stars as number)) / (s.count + 1);
    s.count += 1;
    out.set(r.course_id as number, s);
  }
  return out;
}

async function schedules(offeringIds: number[]) {
  const supabase = await createClient();
  const out = new Map<number, ClassBlock[]>();
  if (!offeringIds.length) return out;
  const { data, error } = await supabase
    .from("offering_blocks")
    .select("offering_id, weekday, starts_at, ends_at, class_type, room, campus, is_async")
    .in("offering_id", offeringIds);
  if (error) throw new Error(`offering_blocks: ${error.message}`);
  for (const b of data) {
    const list = out.get(b.offering_id as number) ?? [];
    list.push({
      day: DAYS[(b.weekday as number) - 1],
      start: b.starts_at as number,
      end: b.ends_at as number,
      type: (b.class_type as string | null) ?? "",
      room: (b.room as string | null) ?? null,
      campus: b.campus ? CAMPUS[b.campus as string] : null,
      async: b.is_async === true,
    });
    out.set(b.offering_id as number, list);
  }
  return out;
}

export async function currentTerm(): Promise<{ id: string; label: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("terms").select("id").eq("is_current", true).maybeSingle();
  return data ? { id: data.id as string, label: termLabel(data.id as string) } : null;
}

/** Every subject of the plan (no CBC) with this term's courses and their scores. */
export async function getReviewCatalog(planId: string): Promise<ReviewCatalog> {
  const supabase = await createClient();
  const [{ subjects, subjectOf }, term] = await Promise.all([planSubjects(planId), currentTerm()]);

  let offerings: OfferingRow[] = [];
  if (term) {
    const { data, error } = await supabase
      .from("offerings")
      .select("id, course_id, term_id, siu_subject_code, siu_subject_name, label, teachers")
      .eq("plan_id", planId)
      .eq("term_id", term.id)
      .eq("visible", true);
    if (error) throw new Error(`offerings: ${error.message}`);
    offerings = data as OfferingRow[];
  }

  const [scoreOf, blocksOf] = await Promise.all([
    scores([...new Set(offerings.map((o) => o.course_id))]),
    schedules(offerings.map((o) => o.id)),
  ]);

  const coursesBySubject = new Map<number, Map<number, OfferingRow[]>>();
  for (const o of offerings) {
    const subjectId = subjectOf(o);
    if (subjectId === undefined) continue;
    const courses = coursesBySubject.get(subjectId) ?? new Map<number, OfferingRow[]>();
    courses.set(o.course_id, [...(courses.get(o.course_id) ?? []), o]);
    coursesBySubject.set(subjectId, courses);
  }

  return {
    term,
    subjects: subjects.map((s) => ({
      subjectId: s.id as number,
      name: s.name as string,
      credits: s.credits as number,
      kindLabel: KIND_LABEL[s.kind as string] ?? "",
      courses: [...(coursesBySubject.get(s.id as number) ?? new Map<number, OfferingRow[]>()).entries()]
        .map(([courseId, list]) => ({
          courseId,
          label: courseLabel(list[0].label),
          teachers: teacherList(list),
          schedule: describeSchedule(list.flatMap((o) => blocksOf.get(o.id) ?? [])),
          score: scoreOf.get(courseId) ?? null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true })),
    })),
  };
}

/** One course: score, distribution, comments (pinned first, then newest) and the subject's other courses. */
export async function getCourse(courseId: number, planId: string): Promise<CourseDetail | null> {
  const supabase = await createClient();
  const { data: offerings, error } = await supabase
    .from("offerings")
    .select("id, course_id, term_id, siu_subject_code, siu_subject_name, label, teachers")
    .eq("course_id", courseId)
    .eq("visible", true)
    .order("term_id", { ascending: false });
  if (error) throw new Error(`offerings: ${error.message}`);
  if (!offerings.length) return null;
  const latest = offerings.filter((o) => o.term_id === offerings[0].term_id) as OfferingRow[];

  const [catalog, reviews] = await Promise.all([
    getReviewCatalog(planId),
    supabase
      .from("reviews")
      .select("id, stars, comment, pinned, term_id, created_at")
      .eq("course_id", courseId)
      .is("hidden_at", null)
      .order("created_at", { ascending: false }),
  ]);
  if (reviews.error) throw new Error(`reviews: ${reviews.error.message}`);

  const subject =
    catalog.subjects.find((s) => s.courses.some((c) => c.courseId === courseId)) ??
    catalog.subjects.find((s) => normalizeText(s.name) === normalizeText(latest[0].siu_subject_name));

  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const r of reviews.data) distribution[5 - (r.stars as number)] += 1;
  const count = reviews.data.length;
  const average = count ? reviews.data.reduce((a, r) => a + (r.stars as number), 0) / count : 0;

  return {
    courseId,
    label: courseLabel(latest[0].label),
    teachers: teacherList(latest),
    subject: subject ? { name: subject.name, credits: subject.credits } : { name: titleCase(latest[0].siu_subject_name), credits: 0 },
    score: count ? { average, count } : null,
    distribution,
    comments: reviews.data
      .filter((r) => r.comment)
      .map((r) => ({
        id: r.id as number,
        stars: r.stars as number,
        comment: r.comment as string,
        pinned: r.pinned === true,
        termLabel: termLabel(r.term_id as string),
      }))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned)),
    otherCourses: (subject?.courses ?? []).filter((c) => c.courseId !== courseId),
  };
}
