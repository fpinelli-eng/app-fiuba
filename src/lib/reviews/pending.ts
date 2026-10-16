import { createClient } from "@/lib/supabase/server";
import { shortTeacherList, surname, titleCase } from "@/lib/plan/format";
import { normalizeText } from "@/lib/map/model";
import { termLabel } from "./mine";

// Pending reviews: the courses a student took in terms whose review date already passed.
// Each course can be reviewed once per term (submit_review edits it after that).

export interface ReviewTask {
  offeringId: number;
  courseId: number;
  termId: string;
  subjectName: string;
  /** "Curso 2 · Ortega, Lucero, Paredes" */
  course: string;
  /** Stars already sent, or null while pending. */
  sentStars: number | null;
  sentComment: string | null;
}

export interface ReviewRound {
  termId: string;
  /** "2C 2026" */
  termLabel: string;
  /** The plan that unlocks when done: "1C 2027". */
  nextTermLabel: string;
  tasks: ReviewTask[];
}

/** Today in Buenos Aires, as YYYY-MM-DD (reviews open on a date, not a time). */
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

/** "2026-2C" → "1C 2027" */
export function nextTerm(termId: string): string {
  const [year, half] = termId.split("-");
  return half === "2C" ? `1C ${Number(year) + 1}` : `2C ${year}`;
}

type Row = {
  offering_id: number;
  offerings: {
    id: number;
    course_id: number;
    term_id: string;
    siu_subject_name: string;
    label: string;
    teachers: { nombre: string }[] | null;
    terms: { reviews_open_on: string | null } | null;
  } | null;
};

/** The latest term with reviews open for this student, with what is sent and what is missing. */
export async function getReviewRound(userId: string, planId: string | null): Promise<ReviewRound | null> {
  const supabase = await createClient();
  const [taken, mine, subjects] = await Promise.all([
    supabase
      .from("user_courses")
      .select("offering_id, offerings(id, course_id, term_id, siu_subject_name, label, teachers, terms(reviews_open_on))")
      .eq("user_id", userId),
    supabase.rpc("my_reviews"),
    // The plan's names only make the titles nicer; the menu count skips them.
    planId ? supabase.from("subjects").select("name").eq("plan_id", planId) : Promise.resolve({ data: [] as { name: string }[] }),
  ]);
  if (taken.error) throw new Error(`user_courses: ${taken.error.message}`);
  if (mine.error) throw new Error(`my_reviews: ${mine.error.message}`);

  const date = today();
  const open = (taken.data as unknown as Row[])
    .map((r) => r.offerings)
    .filter((o): o is NonNullable<Row["offerings"]> => !!o && !!o.terms?.reviews_open_on && o.terms.reviews_open_on <= date);
  if (!open.length) return null;

  const termId = open.map((o) => o.term_id).sort().at(-1)!;
  const names = new Map((subjects.data ?? []).map((s) => [normalizeText(s.name as string), s.name as string]));
  const sent = new Map(
    ((mine.data ?? []) as { course_id: number; term_id: string; stars: number; comment: string | null }[])
      .filter((r) => r.term_id === termId)
      .map((r) => [r.course_id, r]),
  );

  // One task per course, even if the student marked a practice and its course.
  const byCourse = new Map<number, (typeof open)[number]>();
  for (const o of open.filter((o) => o.term_id === termId)) if (!byCourse.has(o.course_id)) byCourse.set(o.course_id, o);

  return {
    termId,
    termLabel: termLabel(termId),
    nextTermLabel: nextTerm(termId),
    tasks: [...byCourse.values()].map((o) => {
      const teachers = shortTeacherList((o.teachers ?? []).map((t) => surname(t.nombre, [])));
      const r = sent.get(o.course_id);
      return {
        offeringId: o.id,
        courseId: o.course_id,
        termId,
        subjectName: names.get(normalizeText(o.siu_subject_name)) ?? titleCase(o.siu_subject_name),
        course: [o.label.split(" · ")[0], teachers].filter(Boolean).join(" · "),
        sentStars: r?.stars ?? null,
        sentComment: r?.comment ?? null,
      };
    }),
  };
}

/** How many reviews are still missing (for the menu badge and the notices). */
export async function countPendingReviews(userId: string): Promise<number> {
  const round = await getReviewRound(userId, null);
  return round ? round.tasks.filter((t) => t.sentStars === null).length : 0;
}
