import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/app";
import { getAdminOverview } from "@/lib/admin/data";
import type { ExamStats } from "@/lib/admin/exams";
import { createClient } from "@/lib/supabase/server";
import { ExamForm } from "./ExamForm";

export const metadata: Metadata = { title: `Fechas de examen · Administración · ${APP_NAME}` };

const day = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });

// Fechas de examen por plan: se pega el enlace de la búsqueda en "Fechas de examen" del SIU
// (o el texto de la página) y se publica.
// El layout de /admin ya exige ser administrador.
export default async function AdminExamsPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planParam } = await searchParams;
  const { plans } = await getAdminOverview();
  const supabase = await createClient();
  const { data, error } = await supabase.from("exam_imports").select("plan_id, stats, published_at");
  if (error) throw new Error(`exam_imports: ${error.message}`);
  const loaded = new Map(data.map((i) => [i.plan_id as string, { stats: i.stats as ExamStats, at: i.published_at as string }]));
  const selected = plans.find((p) => p.id === planParam) ?? plans[0];
  const current = selected ? loaded.get(selected.id) : undefined;

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-[18px] px-6 pt-8 pb-14">
      <div>
        <h1 className="text-[30px] font-semibold">Fechas de examen</h1>
        <div className="text-muted">
          {loaded.size} de {plans.length} planes cargados · se cargan con el enlace de la búsqueda en guaraniautogestion.fi.uba.ar/g3w/fecha_examen
        </div>
      </div>

      <div className="grid grid-cols-[300px_minmax(0,1fr)] items-start gap-[18px]">
        <aside aria-label="Planes" className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-2.5">
          {plans.map((p) => {
            const on = p.id === selected?.id;
            const info = loaded.get(p.id);
            return (
              <Link
                key={p.id}
                href={`/admin/examenes?plan=${p.id}`}
                aria-current={on ? "page" : undefined}
                className={`flex items-center justify-between gap-2 rounded-[10px] px-3 py-[9px] text-sm ${
                  on ? "bg-lavender font-semibold text-lavender-ink" : "hover:bg-bg"
                }`}
              >
                <span className="min-w-0">
                  {p.career} <span className={on ? "font-normal" : "text-muted"}>{p.year}</span>
                </span>
                <span className="flex-none text-xs text-muted">{info ? day(info.at) : ""}</span>
              </Link>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {selected && current && (
            <p className="rounded-[14px] bg-mint px-4 py-3 text-sm text-mint-ink">
              Cargadas el {day(current.at)}: {current.stats.tables} mesas de {current.stats.subjects} materias. Publicar otro texto las reemplaza.
            </p>
          )}
          {selected && <ExamForm key={selected.id} planId={selected.id} title={`${selected.career} · Plan ${selected.year}`} />}
        </div>
      </div>
    </main>
  );
}
