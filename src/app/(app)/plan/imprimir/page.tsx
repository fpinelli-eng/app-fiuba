import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlanPoster } from "@/components/PlanPoster";
import { PosterScreen } from "@/components/PosterScreen";
import { APP_NAME } from "@/lib/app";
import { getPlanData } from "@/lib/plan/data";
import { posterFromPlan } from "@/lib/plan/poster";
import { getReviewRound } from "@/lib/reviews/pending";
import { requireProfile } from "@/lib/session";

// Lámina del plan para imprimir o guardar como PDF (Plan → "Descargar PDF"). ?opcion=A|B elige la
// opción que se estaba viendo; ?imprimir=1 abre solo el diálogo de impresión.

// El título es el nombre que propone el navegador para el PDF.
export const metadata: Metadata = { title: `Mi cuatrimestre · ${APP_NAME}` };

export default async function PrintPlanPage({ searchParams }: PageProps<"/plan/imprimir">) {
  const account = await requireProfile();
  // Con reseñas pendientes el plan está bloqueado: la lámina también.
  const round = await getReviewRound(account.id, account.planId);
  if (round?.tasks.some((t) => t.sentStars === null)) redirect("/plan");
  const data = await getPlanData(account.id, account.planId!);
  if (!data.term || data.subjects.length === 0) redirect("/plan");

  const { opcion, imprimir } = await searchParams;
  const poster = posterFromPlan(data, opcion === "B" ? "B" : "A");
  const date = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date());

  return (
    <PosterScreen backHref="/plan" autoPrint={imprimir === "1"}>
      <PlanPoster poster={poster} date={date} />
    </PosterScreen>
  );
}
