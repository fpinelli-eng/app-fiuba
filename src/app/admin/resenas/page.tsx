import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getModerationReviews } from "@/lib/admin/reviews";
import { ReviewModeration } from "./ReviewModeration";

export const metadata: Metadata = { title: `Reseñas · Administración · ${APP_NAME}` };

// El layout de /admin ya exige ser administrador.
export default async function AdminReviewsPage() {
  return <ReviewModeration reviews={await getModerationReviews()} />;
}
