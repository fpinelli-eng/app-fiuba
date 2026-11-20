import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getReviewCatalog } from "@/lib/reviews/catalog";
import { getReviewRound } from "@/lib/reviews/pending";
import { getSharedPlan } from "@/lib/cache/catalog";
import { requireProfile } from "@/lib/session";
import { ReviewSearch } from "./ReviewSearch";

export const metadata: Metadata = { title: `Reseñas · ${APP_NAME}` };

// Buscador de cursos (prototipo 09-resenas-buscador): todas las materias del plan, tengan reseñas o no.
export default async function ResenasPage() {
  const account = await requireProfile();
  const [catalog, round, plan] = await Promise.all([
    getReviewCatalog(account.planId!),
    getReviewRound(account.id, account.planId!),
    getSharedPlan(account.planId!),
  ]);
  const pending = round ? round.tasks.filter((t) => t.sentStars === null).length : 0;

  return (
    <ReviewSearch
      subjects={catalog.subjects}
      planLabel={`${plan.careerName} (plan ${plan.year})`}
      pending={pending && round ? { count: pending, termLabel: round.termLabel } : null}
    />
  );
}
