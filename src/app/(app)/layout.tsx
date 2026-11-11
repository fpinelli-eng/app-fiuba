import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { WelcomeStories } from "@/components/WelcomeStories";
import { getIntroSeen, touchLastSeen } from "@/lib/intro/data";
import { countPendingReviews } from "@/lib/reviews/pending";
import { requireProfile } from "@/lib/session";

// Todas las secciones de la app exigen una sesión @fi.uba.ar válida.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  const [pendingReviews, introSeen] = await Promise.all([countPendingReviews(profile.id), getIntroSeen(profile.id), touchLastSeen()]);
  return (
    <>
      <Header profile={profile} pendingReviews={pendingReviews} isAdmin={profile.isAdmin} />
      {/* La primera vez se abren solas; después, desde Perfil → "Ver la bienvenida" o con ?bienvenida en la dirección. */}
      <WelcomeStories firstName={profile.firstName} open={!introSeen} />
      {children}
      {/* Celular: lugar para la barra de pestañas fija de abajo (60 px + borde + zona segura del iPhone). */}
      <div aria-hidden="true" className="h-[calc(61px+env(safe-area-inset-bottom))] md:hidden" />
    </>
  );
}
