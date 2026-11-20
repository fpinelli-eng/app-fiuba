import { createClient } from "@/lib/supabase/server";
import { describeSchedule, shortTeacherList, surname, titleCase } from "@/lib/plan/format";
import type { ClassBlock, WeekDay } from "@/lib/plan/options";
import { campusQuery, withCampus, type CampusCode } from "@/lib/campus/infer";
import type { Campus } from "@/lib/siu/parser";
import { normalizeText } from "@/lib/map/model";
import { termLabel } from "./mine";
import { courseStars, mixComments, type CourseStars, type StarCount } from "./merge";
import {
  getCurrentTermRow,
  getOfferStarCounts,
  getReviewSubjects,
  getSharedPlan,
  getTermOffer,
  type OfferRow,
  type StarCountRow,
} from "@/lib/cache/catalog";
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
  // Shared cache (src/lib/cache/): the same for every student of the plan.
  const [subjects, plan] = await Promise.all([getReviewSubjects(planId), getSharedPlan(planId)]);
  const subjectIds = new Set(subjects.map((s) => s.id));
  const byCode = new Map(plan.siuCodes.filter((c) => subjectIds.has(c.subject_id)).map((c) => [c.siu_code, c.subject_id]));
  const byName = new Map(subjects.map((s) => [normalizeText(s.name), s.id]));
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
  return starsFromCounts(data as StarCountRow[]);
}

/** Scores of the courses in the plan's offer of a term, from the shared cache (Reseñas search and Plan). */
export async function offerScores(termId: string, planId: string): Promise<Map<number, CourseStars>> {
  return starsFromCounts(await getOfferStarCounts(termId, planId));
}

// One row per course: how many gave 1..5 stars (array position 0 = 1 star), for each source.
function starsFromCounts(rows: StarCountRow[]): Map<number, CourseStars> {
  return courseStars(
    rows.flatMap((r) =>
      (["app", "dolly"] as const).flatMap((source) =>
        (r[source] ?? []).map((n, i): StarCount => ({ courseId: Number(r.course_id), source, stars: i + 1, n })),
      ),
    ),
  );
}

function schedules(offerings: OfferRow[], planId: string) {
  const out = new Map<number, ClassBlock[]>();
  for (const o of offerings) {
    if (!o.offering_blocks.length) continue;
    const list: (Omit<ClassBlock, "campus"> & { campus: CampusCode | null })[] = o.offering_blocks.map((b) => ({
      day: DAYS[b.weekday - 1],
      start: b.starts_at,
      end: b.ends_at,
      type: b.class_type ?? "",
      room: b.room ?? null,
      campus: (b.campus as CampusCode | null) ?? null,
      async: b.is_async === true,
    }));
    // The SIU leaves some classes without a campus: they are filled from the campus table (data/sedes/).
    out.set(o.id, withCampus(list, campusQuery(planId, o)).map((b) => ({ ...b, campus: b.campus ? CAMPUS[b.campus] : null })));
  }
  return out;
}

export async function currentTerm(): Promise<{ id: string; label: string } | null> {
  const term = await getCurrentTermRow();
  return term ? { id: term.id, label: termLabel(term.id) } : null;
}

/** Every subject of the plan (no CBC) with this term's courses and their scores. */
export async function getReviewCatalog(planId: string): Promise<ReviewCatalog> {
  const [{ subjects, subjectOf }, term] = await Promise.all([planSubjects(planId), currentTerm()]);
  const offerings: OfferRow[] = term ? await getTermOffer(term.id, planId) : [];
  const scoreOf = term ? await offerScores(term.id, planId) : new Map<number, CourseStars>();
  const blocksOf = schedules(offerings, planId);

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
      .order("created_at", { ascending: false })
      .order("id", { ascending: false }),
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
