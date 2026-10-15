import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getMapData } from "@/lib/map/data";
import { requireProfile } from "@/lib/session";
import { CareerMapView } from "./CareerMapView";

export const metadata: Metadata = { title: `Mapa · ${APP_NAME}` };

// Mapa de la carrera. Con ?carga=1 (al terminar de elegir la carrera) es la primera carga de materias.
export default async function MapaPage({ searchParams }: PageProps<"/mapa">) {
  const account = await requireProfile();
  const params = await searchParams;
  const data = await getMapData(account.id, account.planId!);
  return <CareerMapView userId={account.id} data={data} firstLoad={params.carga === "1"} />;
}
