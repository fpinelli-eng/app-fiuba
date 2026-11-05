import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { countPendingReviews } from "@/lib/reviews/pending";
import { requireProfile } from "@/lib/session";

// Todas las secciones de la app exigen una sesión @fi.uba.ar válida.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  const pendingReviews = await countPendingReviews(profile.id);
  return (
    <>
      <Header profile={profile} pendingReviews={pendingReviews} />
      {children}
      {/* Celular: lugar para la barra de pestañas fija de abajo (60 px + borde + zona segura del iPhone). */}
      <div aria-hidden="true" className="h-[calc(61px+env(safe-area-inset-bottom))] md:hidden" />
    </>
  );
}
