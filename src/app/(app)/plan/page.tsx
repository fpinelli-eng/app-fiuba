import { getPlanData } from "@/lib/plan/data";
import { getReviewRound } from "@/lib/reviews/pending";
import { requireProfile } from "@/lib/session";
import { PlanBlocked } from "./PlanBlocked";
import { PlanBuilder } from "./PlanBuilder";

export default async function PlanPage() {
  const account = await requireProfile();
  // Con reseñas pendientes, el plan se bloquea hasta completarlas.
  const round = await getReviewRound(account.id, account.planId);
  if (round?.tasks.some((t) => t.sentStars === null)) return <PlanBlocked round={round} />;
  return <PlanBuilder data={await getPlanData(account.id, account.planId!)} />;
}
