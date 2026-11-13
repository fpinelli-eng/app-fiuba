import type { Metadata } from "next";
import { WelcomeStories } from "@/components/WelcomeStories";

export const metadata: Metadata = { title: "Prueba de las historias", robots: { index: false, follow: false } };

// TEMPORAL: para mirar las historias sin sesión. Se borra antes de integrar.
// Con ?oferta en la dirección se ve el modo "solo la historia de la oferta" (una vez por dispositivo:
// para repetirlo, borrar los datos del sitio o abrirlo en una ventana privada).
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const offerOnly = "oferta" in (await searchParams);
  return <WelcomeStories firstName="Tomás" open={!offerOnly} needsOffer term="2C 2026" />;
}
