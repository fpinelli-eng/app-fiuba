import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getReviewCatalog } from "@/lib/reviews/catalog";
import { getReviewRound } from "@/lib/reviews/pending";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { ReviewSearch } from "./ReviewSearch";

export const metadata: Metadata = { title: `Reseñas · ${APP_NAME}` };

// Buscador de cursos (prototipo 09-resenas-buscador): todas las materias del plan, tengan reseñas o no.
export default async function ResenasPage() {
  const account = await requireProfile();
  const supabase = await createClient();
  const [catalog, round, plan] = await Promise.all([
    getReviewCatalog(account.planId!),
    getReviewRound(account.id, account.planId!),
    supabase.from("plans").select("year, careers(name)").eq("id", account.planId!).single(),
  ]);
  const career = plan.data?.careers as unknown as { name: string } | { name: string }[] | null;
  const careerName = (Array.isArray(career) ? career[0]?.name : career?.name) ?? "";
  const pending = round ? round.tasks.filter((t) => t.sentStars === null).length : 0;

  return (
    <ReviewSearch
      subjects={catalog.subjects}
      planLabel={`${careerName} (plan ${plan.data?.year ?? ""})`}
      pending={pending && round ? { count: pending, termLabel: round.termLabel } : null}
    />
  );
}
