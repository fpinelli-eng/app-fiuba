import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getReviewRound } from "@/lib/reviews/pending";
import { requireProfile } from "@/lib/session";
import { PendingReviews } from "./PendingReviews";

export const metadata: Metadata = { title: `Reseñas pendientes · ${APP_NAME}` };

// Reseñas pendientes (prototipo 11-resenas-pendientes): una tarjeta por curso de la última cursada con reseñas abiertas.
export default async function PendientesPage() {
  const account = await requireProfile();
  const round = await getReviewRound(account.id, account.planId!);

  if (!round) {
    return (
      <main className="mx-auto flex w-full max-w-[860px] flex-col gap-[18px] px-6 pt-9 pb-14">
        <h1 className="text-[32px] font-semibold tracking-[-0.01em]">Reseñas</h1>
        <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">No tenés reseñas pendientes.</div>
      </main>
    );
  }
  return <PendingReviews round={round} />;
}
