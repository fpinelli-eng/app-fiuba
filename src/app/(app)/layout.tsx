import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { requireProfile } from "@/lib/session";

// Todas las secciones de la app exigen una sesión @fi.uba.ar válida.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const profile = await requireProfile();
  return (
    <>
      <Header profile={profile} />
      {children}
    </>
  );
}
