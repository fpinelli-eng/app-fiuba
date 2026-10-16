"use server";

import { commentProblem } from "@/lib/reviews/filter";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";

export type SubmitResult = { ok: true } | { ok: false; error: string };

// Una reseña por alumno y curso: las dos acciones la crean o la editan. El filtro de comentarios
// se vuelve a correr acá: en el navegador se puede saltear, en el servidor no.

function check(stars: number, comment: string): { text: string } | { ok: false; error: string } {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "Elegí de 1 a 5 estrellas." };
  const text = comment.trim();
  const problem = text ? commentProblem(text) : null;
  return problem ? { ok: false, error: problem } : { text };
}

/** Reseña pendiente de un curso cursado. */
export async function submitReview(offeringId: number, stars: number, comment: string): Promise<SubmitResult> {
  await requireProfile();
  const c = check(stars, comment);
  if (!("text" in c)) return c;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", { p_offering_id: offeringId, p_stars: stars, p_comment: c.text || null });
  if (error) return { ok: false, error: "No pudimos guardar tu reseña. Probá de nuevo." };
  return { ok: true };
}

/** Reseña libre desde la ficha del curso: cualquier curso, se haya cursado o no. */
export async function reviewCourse(courseId: number, stars: number, comment: string): Promise<SubmitResult> {
  await requireProfile();
  const c = check(stars, comment);
  if (!("text" in c)) return c;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_course", { p_course_id: courseId, p_stars: stars, p_comment: c.text || null });
  if (error) return { ok: false, error: "No pudimos guardar tu reseña. Probá de nuevo." };
  return { ok: true };
}
