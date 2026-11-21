import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { ago, healthItems, toHealth, type Health } from "@/lib/admin/health";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Estado · Administración · ${APP_NAME}` };

// Undefined function: the migration 20261115130000_salud is not applied yet (Vercel previews use
// the production database, which only gets it when the branch is merged).
const NOT_YET = new Set(["42883", "PGRST202"]);

async function getHealth(): Promise<Health | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_salud");
  if (error) {
    if (NOT_YET.has(error.code)) return null;
    throw new Error(`admin_salud: ${error.message}`);
  }
  const row = (data as Record<string, unknown>[])[0];
  return row ? toHealth(row) : null;
}

// Estado: si los trabajos de fondo de la app andan (lo mismo que revisa cada hora el monitor de la
// planilla de avisosfiubi@gmail.com, que avisa por mail: tools/reminders/README.md, "Monitor").
// El layout de /admin ya exige ser administrador y la función de la base lo vuelve a controlar.
export default async function AdminHealthPage() {
  const health = await getHealth();
  // The database clock (checked_at), the same one the timestamps come from.
  const now = health ? Date.parse(health.checkedAt) : 0;

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-14">
      <div>
        <h1 className="text-[30px] font-semibold">Estado</h1>
        <div className="text-muted">Lo que revisa el monitor cada hora. Si algo falla, avisa por mail.</div>
      </div>

      {!health ? (
        <p className="rounded-[14px] bg-butter px-4 py-3 text-sm text-butter-ink">
          Todavía no se puede leer el estado: falta aplicar la migración de la base.
        </p>
      ) : (
        <>
          <section aria-labelledby="checks-title" className="overflow-hidden rounded-[18px] border border-line bg-surface">
            <h2 id="checks-title" className="px-6 pt-[18px] pb-2 text-[19px] font-semibold">
              Chequeos
            </h2>
            <ul className="flex flex-col pb-2">
              {healthItems(health, now).map((c) => (
                <li key={c.key} className="flex items-start gap-3 border-t border-line px-6 py-3.5 first:border-t-0">
                  <span aria-hidden="true" className="flex-none">
                    {c.ok ? "✅" : "⚠️"}
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold">
                      {c.label}
                      <span className="sr-only">{c.ok ? ": anda bien" : ": revisar"}</span>
                    </div>
                    <div className={`text-sm ${c.ok ? "text-muted" : "text-danger"}`}>{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            {(
              [
                ["Usuarios", String(health.users)],
                ["Reseñas", String(health.reviews)],
                ["Ofertas por revisar", String(health.offersPending)],
                ["Último uso de la app", ago(health.lastSeenAt, now)],
              ] as const
            ).map(([label, value]) => (
              <li key={label} className="rounded-2xl border border-line bg-surface p-3">
                <div className="text-[13px] text-muted">{label}</div>
                <div className="text-[22px] font-semibold tabular-nums">{value}</div>
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted">
            El monitor no ve errores en las pantallas con sesión ni problemas que pasan solo en el navegador de un alumno.
          </p>
        </>
      )}
    </main>
  );
}
