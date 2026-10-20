import { createClient } from "@/lib/supabase/server";
import { shortTeacherList, surname, titleCase } from "@/lib/plan/format";
import { termLabel } from "@/lib/reviews/mine";

// Reviews for the admin moderation tab (prototype 13, "Reseñas"). Admins read hidden
// reviews too (RLS). There is never an author here: it lives in review_authors, which
// nobody can read.

export interface ModerationReview {
  id: number;
  stars: number;
  comment: string | null;
  pinned: boolean;
  hidden: boolean;
  /** "2C 2026" */
  term: string;
  createdAt: string;
  /** "Álgebra Lineal" */
  subject: string;
  /** "Curso 2" */
  course: string;
  /** "Vargas, Torlasco" */
  teachers: string;
}

type OfferingRow = {
  course_id: number;
  term_id: string;
  siu_subject_name: string;
  label: string;
  teachers: { nombre: string }[] | null;
};

/** The newest reviews (up to 500), with the subject and teachers of their course. */
export async function getModerationReviews(): Promise<ModerationReview[]> {
  const supabase = await createClient();
  const reviews = await supabase
    .from("reviews")
    .select("id, course_id, term_id, stars, comment, pinned, hidden_at, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (reviews.error) throw new Error(`reviews: ${reviews.error.message}`);

  const courseIds = [...new Set(reviews.data.map((r) => r.course_id as number))];
  const offerings = courseIds.length
    ? await supabase
        .from("offerings")
        .select("course_id, term_id, siu_subject_name, label, teachers")
        .in("course_id", courseIds)
        .order("term_id", { ascending: false })
    : { data: [] as OfferingRow[], error: null };
  if (offerings.error) throw new Error(`offerings: ${offerings.error.message}`);

  // The most recent offering of each course names it.
  const courseOf = new Map<number, OfferingRow>();
  for (const o of offerings.data as OfferingRow[]) if (!courseOf.has(o.course_id)) courseOf.set(o.course_id, o);

  return reviews.data.map((r) => {
    const o = courseOf.get(r.course_id as number);
    return {
      id: r.id as number,
      stars: r.stars as number,
      comment: (r.comment as string | null) ?? null,
      pinned: r.pinned === true,
      hidden: r.hidden_at !== null,
      term: termLabel(r.term_id as string),
      createdAt: r.created_at as string,
      subject: o ? titleCase(o.siu_subject_name) : "Curso sin oferta",
      course: o ? o.label.split(" · ")[0] : "",
      teachers: o ? shortTeacherList((o.teachers ?? []).map((t) => surname(t.nombre, []))) : "",
    };
  });
}
