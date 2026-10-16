import { titleCase } from "@/lib/plan/format";
import { createClient } from "@/lib/supabase/server";

export interface MyReview {
  id: number;
  stars: number;
  comment: string | null;
  hidden: boolean;
  /** "Gestión Integral de la Cadena de Valor" (from the offer of that term), or the SIU code. */
  subjectName: string;
  /** "Curso 3 · 1C 2026" */
  detail: string;
}

/** "2026-1C" → "1C 2026" */
export function termLabel(termId: string): string {
  const [year, half] = termId.split("-");
  return half && year ? `${half} ${year}` : termId;
}

// The student's own reviews ("Mis reseñas"). Authorship never leaves the database:
// my_reviews() only returns the caller's.
export async function getMyReviews(): Promise<MyReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_reviews");
  if (error) throw new Error(`my_reviews: ${error.message}`);
  const reviews = (data ?? []) as {
    review_id: number;
    course_id: number;
    term_id: string;
    stars: number;
    comment: string | null;
    hidden: boolean;
  }[];
  if (!reviews.length) return [];

  const { data: offerings, error: offeringsError } = await supabase
    .from("offerings")
    .select("course_id, term_id, siu_subject_code, siu_subject_name, label")
    .in("course_id", [...new Set(reviews.map((r) => r.course_id))]);
  if (offeringsError) throw new Error(`offerings: ${offeringsError.message}`);
  const offeringOf = (r: (typeof reviews)[number]) =>
    offerings?.find((o) => o.course_id === r.course_id && o.term_id === r.term_id) ??
    offerings?.find((o) => o.course_id === r.course_id);

  return reviews.map((r) => {
    const o = offeringOf(r);
    return {
      id: r.review_id,
      stars: r.stars,
      comment: r.comment,
      hidden: r.hidden,
      subjectName: o?.siu_subject_name ? titleCase(o.siu_subject_name as string) : "Curso",
      detail: [o?.label as string | undefined, termLabel(r.term_id)].filter(Boolean).join(" · "),
    };
  });
}

/** The caller's review of one course, if any (for "Tu reseña" on the course page). */
export async function getMyReviewOf(courseId: number): Promise<{ stars: number; comment: string | null; hidden: boolean } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_reviews");
  if (error) throw new Error(`my_reviews: ${error.message}`);
  const r = ((data ?? []) as { course_id: number; stars: number; comment: string | null; hidden: boolean }[]).find(
    (x) => x.course_id === courseId,
  );
  return r ? { stars: r.stars, comment: r.comment, hidden: r.hidden } : null;
}
