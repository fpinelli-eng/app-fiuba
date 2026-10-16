"use server";

import { commentProblem } from "@/lib/reviews/filter";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";

export type SubmitResult = { ok: true } | { ok: false; error: string };

// Envía (o edita) la reseña de un curso cursado. El filtro de comentarios se vuelve a correr acá:
// en el navegador se puede saltear, en el servidor no.
export async function submitReview(offeringId: number, stars: number, comment: string): Promise<SubmitResult> {
  await requireProfile();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return { ok: false, error: "Elegí de 1 a 5 estrellas." };
  const text = comment.trim();
  const problem = text ? commentProblem(text) : null;
  if (problem) return { ok: false, error: problem };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_review", { p_offering_id: offeringId, p_stars: stars, p_comment: text || null });
  if (error) return { ok: false, error: "No pudimos guardar tu reseña. Probá de nuevo." };
  return { ok: true };
}
