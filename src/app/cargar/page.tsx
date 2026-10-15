import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getMapData } from "@/lib/map/data";
import { requireProfile } from "@/lib/session";
import { QuickLoad } from "./QuickLoad";

export const metadata: Metadata = { title: `Cargá tus materias · ${APP_NAME}` };

// Carga rápida de materias. Se llega solo después de elegir la carrera, o desde "Carga rápida" en el mapa.
export default async function CargarPage() {
  const account = await requireProfile();
  const data = await getMapData(account.id, account.planId!);
  return (
    <>
      <header className="flex min-h-[68px] items-center justify-between gap-6 border-b border-line bg-header px-8">
        <div className="flex items-center gap-3">
          <span className="grid size-[30px] place-items-center rounded-lg bg-lavender text-sm font-bold text-lavender-ink">F</span>
          <span className="font-bold tracking-[0.02em]">{APP_NAME}</span>
        </div>
        <span className="text-[13px] text-muted">{account.email}</span>
      </header>
      <QuickLoad userId={account.id} data={data} />
    </>
  );
}
