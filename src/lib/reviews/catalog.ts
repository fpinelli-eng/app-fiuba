import { createClient } from "@/lib/supabase/server";
import { describeSchedule, shortTeacherList, surname, titleCase } from "@/lib/plan/format";
import type { ClassBlock, WeekDay } from "@/lib/plan/options";
import { campusQuery, withCampus, type CampusCode } from "@/lib/campus/infer";
import type { Campus } from "@/lib/siu/parser";
import { normalizeText } from "@/lib/map/model";
import { termLabel } from "./mine";
import { courseStars, mixComments, type CourseStars, type StarCount } from "./merge";
import type { CourseDetail, CourseSummary, ReviewCatalog, Score, SubjectReviews } from "./types";

export type { CourseDetail, CourseSummary, ReviewCatalog, Score, SubjectReviews };

// Data for the review screens: the plan's subjects with the courses offered this term
// and their scores. Reviews belong to a course (stable across terms), not to an offering.
// Hidden reviews and hidden offerings are always left out here, also for admins.
// Scores and comments mix the app's reviews with the historical Dolly opinions (merge.ts).

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

/**
 * Score of each course: app reviews and Dolly opinions, without hidden ones. Counts come grouped
 * by course from course_star_counts() because there are thousands of Dolly rows (the API returns 1000 at most).
 * The Plan uses it too.
 */
export async function courseScores(courseIds: number[]): Promise<Map<number, CourseStars>> {
  if (!courseIds.length) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("course_star_counts", { course_ids: courseIds });
  if (error) throw new Error(`course_star_counts: ${error.message}`);
  // One row per course: how many gave 1..5 stars (array position 0 = 1 star), for each source.
  const rows = data as { course_id: number; app: number[] | null; dolly: number[] | null }[];
  return courseStars(
    rows.flatMap((r) =>
      (["app", "dolly"] as const).flatMap((source) =>
        (r[source] ?? []).map((n, i): StarCount => ({ courseId: Number(r.course_id), source, stars: i + 1, n })),
      ),
    ),
  );
}

async function schedules(offerings: OfferingRow[], planId: string) {
  const supabase = await createClient();
  const out = new Map<number, ClassBlock[]>();
  if (!offerings.length) return out;
  const { data, error } = await supabase
    .from("offering_blocks")
    .select("offering_id, weekday, starts_at, ends_at, class_type, room, campus, is_async")
    .in("offering_id", offerings.map((o) => o.id));
  if (error) throw new Error(`offering_blocks: ${error.message}`);
  const raw = new Map<number, (Omit<ClassBlock, "campus"> & { campus: CampusCode | null })[]>();
  for (const b of data) {
    const list = raw.get(b.offering_id as number) ?? [];
    list.push({
      day: DAYS[(b.weekday as number) - 1],
      start: b.starts_at as number,
      end: b.ends_at as number,
      type: (b.class_type as string | null) ?? "",
      room: (b.room as string | null) ?? null,
      campus: (b.campus as CampusCode | null) ?? null,
      async: b.is_async === true,
    });
    raw.set(b.offering_id as number, list);
  }
  // The SIU leaves some classes without a campus: they are filled from the campus table (data/sedes/).
  for (const o of offerings) {
    const list = raw.get(o.id);
    if (list) out.set(o.id, withCampus(list, campusQuery(planId, o)).map((b) => ({ ...b, campus: b.campus ? CAMPUS[b.campus] : null })));
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
    courseScores([...new Set(offerings.map((o) => o.course_id))]),
    schedules(offerings, planId),
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
          score: scoreOf.get(courseId)?.score ?? null,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true })),
    })),
  };
}

/** Dolly comments shown on the course page; `allComments` raises it (a course can have hundreds). */
export const DOLLY_COMMENTS = 30;
const DOLLY_COMMENTS_ALL = 500;

/**
 * One course: score and distribution (app reviews and Dolly opinions), one comments list (pinned
 * first, then newest; every app comment and the newest Dolly ones) and the subject's other courses.
 */
export async function getCourse(courseId: number, planId: string, { allComments = false } = {}): Promise<CourseDetail | null> {
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

  const [catalog, stars, reviews, historical] = await Promise.all([
    getReviewCatalog(planId),
    courseScores([courseId]),
    supabase
      .from("reviews")
      .select("id, stars, comment, pinned, term_id, created_at")
      .eq("course_id", courseId)
      .is("hidden_at", null)
      .not("comment", "is", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("historical_reviews")
      .select("id, stars, comment, teacher, term_label, year", { count: "exact" })
      .eq("course_id", courseId)
      .is("hidden_at", null)
      .not("comment", "is", null)
      .order("year", { ascending: false })
      .order("term_label", { ascending: false })
      .order("id", { ascending: false })
      .limit(allComments ? DOLLY_COMMENTS_ALL : DOLLY_COMMENTS),
  ]);
  if (reviews.error) throw new Error(`reviews: ${reviews.error.message}`);
  if (historical.error) throw new Error(`historical_reviews: ${historical.error.message}`);

  const subject =
    catalog.subjects.find((s) => s.courses.some((c) => c.courseId === courseId)) ??
    catalog.subjects.find((s) => normalizeText(s.name) === normalizeText(latest[0].siu_subject_name));
  const own = stars.get(courseId);

  return {
    courseId,
    label: courseLabel(latest[0].label),
    teachers: teacherList(latest),
    subject: subject ? { name: subject.name, credits: subject.credits } : { name: titleCase(latest[0].siu_subject_name), credits: 0 },
    score: own?.score ?? null,
    distribution: own?.distribution ?? [0, 0, 0, 0, 0],
    comments: mixComments(
      reviews.data.map((r) => ({
        id: r.id as number,
        stars: r.stars as number,
        comment: r.comment as string,
        pinned: r.pinned === true,
        termId: r.term_id as string,
        termLabel: termLabel(r.term_id as string),
        createdAt: r.created_at as string,
      })),
      historical.data.map((r) => ({
        id: r.id as number,
        stars: r.stars as number,
        comment: r.comment as string,
        teacher: r.teacher as string,
        termLabel: r.term_label as string,
      })),
    ),
    commentCount: reviews.data.length + (historical.count ?? historical.data.length),
    dollyCount: own?.dolly ?? 0,
    otherCourses: (subject?.courses ?? []).filter((c) => c.courseId !== courseId),
  };
}
