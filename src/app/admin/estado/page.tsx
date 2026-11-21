import type { Metadata } from "next";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app";
import { ago, healthItems, toHealth, type Health } from "@/lib/admin/health";
import {
  KIND_LABEL,
  LATENCY_HOURS,
  SLOW_MS,
  chartTop,
  dateTimeLabel,
  incidentDuration,
  latencySlots,
  latencySummary,
  secondsLabel,
  toMonitorHistory,
  type Incident,
  type MonitorHistory,
} from "@/lib/admin/incidents";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: `Estado · Administración · ${APP_NAME}` };

// Undefined function: the migration (20261115130000_salud for admin_salud, 20261121120000_incidentes
// for admin_monitor) is not applied yet (Vercel previews use the production database, which only
// gets it when the branch is merged).
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

async function getHistory(): Promise<MonitorHistory | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_monitor");
  if (error) {
    if (NOT_YET.has(error.code)) return null;
    throw new Error(`admin_monitor: ${error.message}`);
  }
  return data && typeof data === "object" ? toMonitorHistory(data as Record<string, unknown>) : null;
}

// Estado: si los trabajos de fondo de la app andan (lo mismo que revisa cada hora el monitor de la
// planilla de avisosfiubi@gmail.com, que avisa por mail: tools/reminders/README.md, "Monitor"), cuánto
// tardó la base en cada corrida y las caídas de los últimos 30 días que anotó el monitor.
// El layout de /admin ya exige ser administrador y las funciones de la base lo vuelven a controlar.
export default async function AdminHealthPage() {
  const [health, history] = await Promise.all([getHealth(), getHistory()]);
  // The database clock (checked_at), the same one the timestamps come from.
  const now = health ? Date.parse(health.checkedAt) : history ? Date.parse(history.checkedAt) : 0;

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

          {history ? (
            <>
              <LatencyChart history={history} now={now} />
              <IncidentList incidents={history.incidents} now={now} />
            </>
          ) : (
            <p className="rounded-[14px] bg-butter px-4 py-3 text-sm text-butter-ink">
              La latencia y el historial de caídas aparecen cuando se aplique la migración de incidentes.
            </p>
          )}

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
            El monitor corre una vez por hora: una caída más corta que eso, entre dos corridas, no queda anotada. Tampoco ve
            errores en las pantallas con sesión ni problemas que pasan solo en el navegador de un alumno.
          </p>
        </>
      )}
    </main>
  );
}

function Card({ id, title, subtitle, children }: { id: string; title: string; subtitle: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-4 rounded-[18px] border border-line bg-surface px-6 pt-[18px] pb-5">
      <div>
        <h2 id={`${id}-title`} className="text-[19px] font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

/** "3 s", "13 s": the axis labels, whole seconds. */
const axis = (ms: number) => `${Math.round(ms / 1000)} s`;

/** One bar per hour of the last 72: how long the slowest database call of that monitor run took. */
function LatencyChart({ history, now }: { history: MonitorHistory; now: number }) {
  const slots = latencySlots(history.latency, now);
  const top = chartTop(slots);
  const sum = latencySummary(slots);
  const limitPct = (SLOW_MS / top) * 100;
  const label =
    sum.median === null
      ? `Sin muestras de latencia en las últimas ${LATENCY_HOURS} horas.`
      : `Latencia de la base, últimas ${LATENCY_HOURS} horas: mediana ${secondsLabel(sum.median)}, máxima ${secondsLabel(sum.max ?? 0)}; ` +
        `${sum.slow} ${sum.slow === 1 ? "hora" : "horas"} arriba de ${secondsLabel(SLOW_MS)} y ${sum.missing} sin dato.`;

  return (
    <Card
      id="latencia"
      title="Latencia de la base"
      subtitle={`Lo que tardó la consulta más lenta de cada corrida del monitor, últimas ${LATENCY_HOURS} horas.`}
    >
      {sum.median === null ? (
        <p className="text-sm text-muted">Todavía no hay muestras: aparecen desde la próxima corrida del monitor.</p>
      ) : (
        <>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <li>
              <span className="text-muted">Mediana </span>
              <b className="font-semibold tabular-nums">{secondsLabel(sum.median)}</b>
            </li>
            <li>
              <span className="text-muted">Máxima </span>
              <b className={`font-semibold tabular-nums ${(sum.max ?? 0) > SLOW_MS ? "text-danger" : ""}`}>{secondsLabel(sum.max ?? 0)}</b>
            </li>
            <li>
              <span className="text-muted">Horas arriba de {axis(SLOW_MS)} </span>
              <b className={`font-semibold tabular-nums ${sum.slow ? "text-danger" : ""}`}>{sum.slow}</b>
            </li>
            <li>
              <span className="text-muted">Horas sin dato </span>
              <b className="font-semibold tabular-nums">{sum.missing}</b>
            </li>
          </ul>
          <div>
            <div className="flex gap-2">
              <div aria-hidden="true" className="relative h-36 w-8 flex-none text-right text-[11px] text-muted tabular-nums">
                <span className="absolute top-0 right-0 -translate-y-1/2">{axis(top)}</span>
                <span className="absolute right-0 translate-y-1/2 font-semibold text-danger" style={{ bottom: `${limitPct}%` }}>
                  {axis(SLOW_MS)}
                </span>
                <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
              </div>
              <div role="img" aria-label={label} className="relative h-36 min-w-0 flex-1 border-b border-line-strong">
                <div aria-hidden="true" className="absolute inset-0 flex items-end gap-px">
                  {slots.map((s) => {
                    const when = dateTimeLabel(new Date(s.start).toISOString());
                    return s.ms === null ? (
                      <div key={s.start} title={`${when}: sin dato`} className="h-[3px] flex-1 rounded-full bg-line" />
                    ) : (
                      <div
                        key={s.start}
                        title={`${when}: ${secondsLabel(s.ms)}`}
                        className={`flex-1 rounded-t-[2px] ${s.ms > SLOW_MS ? "bg-danger" : "bg-accent"}`}
                        style={{ height: `max(${Math.min(100, (s.ms / top) * 100)}%, 3px)` }}
                      />
                    );
                  })}
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 border-t border-dashed border-danger"
                  style={{ bottom: `${limitPct}%` }}
                />
              </div>
            </div>
            <div aria-hidden="true" className="mt-1.5 flex justify-between pl-10 text-[11px] text-muted">
              <span>hace {LATENCY_HOURS} h</span>
              <span>hace 48 h</span>
              <span>hace 24 h</span>
              <span>ahora</span>
            </div>
          </div>
          <p className="text-[13px] text-muted">
            La línea roja es el límite de {axis(SLOW_MS)}: arriba de eso el monitor avisa “La base está lenta”. Lo normal es menos de 1
            s. Una hora sin dato es que el monitor no corrió o la base no respondió.
          </p>
        </>
      )}
    </Card>
  );
}

function IncidentList({ incidents, now }: { incidents: Incident[]; now: number }) {
  return (
    <Card id="caidas" title="Historial de caídas" subtitle="Lo que anotó el monitor en los últimos 30 días, lo más nuevo primero.">
      {incidents.length === 0 ? (
        <p className="text-sm text-muted">Nada anotado en los últimos 30 días.</p>
      ) : (
        <ul className="-mx-6 flex flex-col">
          {incidents.map((i) => {
            const ongoing = i.endedAt === null;
            return (
              <li
                key={i.id}
                className={`flex flex-col gap-1.5 border-t px-6 py-3 first:border-t-0 sm:flex-row sm:items-start sm:gap-4 ${
                  ongoing ? "border-danger-line bg-danger-soft" : "border-line"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-semibold ${ongoing ? "text-danger-ink" : ""}`}>{i.title}</span>
                    <span
                      className={`rounded-full px-2.5 py-[3px] text-xs font-semibold ${
                        ongoing ? "bg-danger text-on-accent" : i.kind === "other" ? "bg-line text-ink-2" : "bg-butter text-butter-ink"
                      }`}
                    >
                      {ongoing ? "Sigue" : KIND_LABEL[i.kind]}
                    </span>
                  </div>
                  {i.detail && <div className={`text-sm ${ongoing ? "text-danger-ink" : "text-muted"}`}>{i.detail}</div>}
                </div>
                <dl className="grid flex-none grid-cols-[auto_auto] justify-start gap-x-3 text-sm tabular-nums sm:justify-end">
                  <dt className="text-muted">Desde</dt>
                  <dd>{dateTimeLabel(i.startedAt)}</dd>
                  <dt className="text-muted">{ongoing ? "Lleva" : "Duró"}</dt>
                  <dd className="font-semibold">{incidentDuration(i, now)}</dd>
                  {i.maxMs !== null && (
                    <>
                      <dt className="text-muted">Máx.</dt>
                      <dd>{secondsLabel(i.maxMs)}</dd>
                    </>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[13px] text-muted">
        La hora de inicio es la de la corrida que lo vio primero, así que pudo empezar hasta una hora antes. Si la base no respondía, el
        monitor lo anota cuando vuelve a responder.
      </p>
    </Card>
  );
}
