import type { ReactNode } from "react";
import { ago } from "@/lib/admin/health";
import {
  barHeights,
  buenosAiresDay,
  dayLabel,
  deploymentState,
  formatBytes,
  formatPercent,
  hourLabel,
  latencyLevel,
  peakWhen,
  percent,
  storageLevel,
  students,
  timeLabel,
  type Level,
  type Peak,
} from "@/lib/admin/usage";
import { SITE_URL, type DeploymentsResult, type SiteCheck, type Usage } from "@/lib/admin/usage";

// Vercel's links that open the logged-in user's team and project ("[team]" and "[project]" are picked there).
const VERCEL_USAGE = "https://vercel.com/d?to=%2F%5Bteam%5D%2F~%2Fusage&title=Uso";
const VERCEL_ANALYTICS = "https://vercel.com/d?to=%2F%5Bteam%5D%2F%5Bproject%5D%2Fanalytics&title=Analytics";

// Administración → Uso, with the data already read (page.tsx). Separate so it can be previewed with sample data.
export function UsageView({
  usage,
  dbMs,
  site,
  deployments,
  now,
}: {
  usage: Usage | null;
  dbMs: number;
  site: SiteCheck;
  deployments: DeploymentsResult;
  now: number;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-14">
      <div>
        <h1 className="text-[30px] font-semibold">Uso</h1>
        <p className="text-muted">Cuántos usan la app y cómo anda el servidor, al momento de abrir esta página.</p>
      </div>

      {!usage ? (
        <p className="rounded-[14px] bg-butter px-4 py-3 text-sm text-butter-ink">
          Disponible cuando se integre este cambio: falta aplicar la migración de la base.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
            {(
              [
                ["En línea ahora", usage.onlineNow],
                ["Últimas 24 h", usage.active24h],
                ["Últimos 7 días", usage.active7d],
                ["Últimos 30 días", usage.active30d],
                ["En total", usage.users],
              ] as const
            ).map(([label, n], i) => (
              <li key={label} className={`rounded-2xl border border-line bg-surface p-3 ${i === 0 ? "col-span-2 md:col-span-1" : ""}`}>
                <div className="text-[13px] text-muted">{label}</div>
                <div className="text-[26px] font-semibold tabular-nums">{n.toLocaleString("es-AR")}</div>
              </li>
            ))}
          </ul>
          <p className="-mt-2 text-[13px] text-muted">
            “En línea” es quien abrió alguna pantalla en los últimos 5 a 10 minutos. El resto cuenta alumnos distintos.
          </p>

          <Card title="Al mismo tiempo" id="concurrencia">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <PeakFigure label="Pico de hoy" peak={usage.peakToday} now={usage.checkedAt} />
              <PeakFigure label="Pico de los últimos 7 días" peak={usage.peak7d} now={usage.checkedAt} />
            </div>
            <Columns
              caption="Por hora, últimas 24 h: el máximo de alumnos a la vez en cada hora."
              items={usage.hourly.map((h, i) => ({
                key: h.at,
                name: hourLabel(h.at),
                value: h.users,
                tick: i % 6 === 0 || i === usage.hourly.length - 1 ? hourLabel(h.at) : "",
              }))}
            />
          </Card>

          <Card title="Activos por día" id="por-dia">
            <Columns
              caption="Últimos 14 días: alumnos distintos que usaron la app cada día."
              showValues
              items={usage.daily.map((d) => ({
                key: d.day,
                name: dayLabel(d.day),
                value: d.users,
                tick: String(Number(d.day.slice(8))),
              }))}
            />
          </Card>

          <Card title="Por carrera" id="por-carrera">
            <CareerBars rows={usage.byCareer} total={usage.users} />
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
        {usage && (
          <Card title="Espacio" id="espacio">
            <Storage bytes={usage.dbBytes} limit={usage.dbLimitBytes} tables={usage.tables} />
          </Card>
        )}

        <Card title="Servidor" id="servidor">
          <ul className="-mx-6 flex flex-col">
            <CheckRow
              label="Base de datos"
              detail={`${dbMs.toLocaleString("es-AR")} ms en responder`}
              level={latencyLevel(dbMs)}
            />
            <CheckRow
              label={`Sitio (${SITE_URL.replace("https://", "")})`}
              detail={
                site.status === null
                  ? "No respondió en 3 s"
                  : `Respondió ${site.status} en ${(site.ms ?? 0).toLocaleString("es-AR")} ms`
              }
              level={latencyLevel(site.ms, site.ok)}
            />
          </ul>
        </Card>
      </div>

      <Card title="Vercel" id="vercel">
        <Deployments result={deployments} now={now} />
        <p className="text-sm text-muted">
          El tráfico, el ancho de banda y las visitas se ven en el panel de Vercel:{" "}
          <a href={VERCEL_USAGE} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-accent">
            Uso
          </a>{" "}
          y{" "}
          <a href={VERCEL_ANALYTICS} target="_blank" rel="noopener noreferrer" className="text-ink underline underline-offset-2 hover:text-accent">
            Analytics
          </a>
          .
        </p>
      </Card>
    </main>
  );
}

function Card({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-4 rounded-[18px] border border-line bg-surface px-6 pt-[18px] pb-5">
      <h2 id={`${id}-title`} className="text-[19px] font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

const LEVEL: Record<Level, { label: string; className: string }> = {
  ok: { label: "Bien", className: "bg-mint text-mint-ink" },
  warn: { label: "Lento", className: "bg-butter text-butter-ink" },
  bad: { label: "Falla", className: "bg-danger-soft text-danger-ink" },
};

function Pill({ level, label }: { level: Level; label?: string }) {
  return (
    <span className={`inline-block flex-none rounded-full px-2.5 py-[3px] text-xs font-semibold ${LEVEL[level].className}`}>
      {label ?? LEVEL[level].label}
    </span>
  );
}

function CheckRow({ label, detail, level }: { label: string; detail: string; level: Level }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-line px-6 py-3 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="font-semibold">{label}</div>
        <div className="text-sm text-muted tabular-nums">{detail}</div>
      </div>
      <Pill level={level} />
    </li>
  );
}

function PeakFigure({ label, peak, now }: { label: string; peak: Peak | null; now: string }) {
  return (
    <div className="rounded-2xl bg-lavender-panel px-4 py-3">
      <div className="text-[13px] text-muted">{label}</div>
      {peak ? (
        <div>
          <span className="text-[22px] font-semibold tabular-nums">{students(peak.users)}</span>{" "}
          <span className="text-sm text-ink-2">{peakWhen(peak, now)}</span>
        </div>
      ) : (
        <div className="text-sm text-ink-2">Todavía sin datos.</div>
      )}
    </div>
  );
}

/** Small vertical bar chart: one column per hour or day. */
function Columns({
  caption,
  items,
  showValues = false,
}: {
  caption: string;
  items: { key: string; name: string; value: number; tick: string }[];
  showValues?: boolean;
}) {
  const { max, heights } = barHeights(items.map((i) => i.value));
  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption className="text-sm text-muted">{caption}</figcaption>
        {!showValues && <span className="flex-none text-xs text-muted tabular-nums">máx. {max}</span>}
      </div>
      <ol className={`flex h-36 items-end gap-[3px] border-b border-line-strong ${showValues ? "pt-5" : "pt-1"}`}>
        {items.map((it, i) => (
          <li key={it.key} className="relative h-full flex-1" title={`${it.name}: ${it.value}`}>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-accent"
              style={{ height: `${heights[i]}%` }}
            />
            {showValues && it.value > 0 && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 text-center text-[11px] leading-4 text-ink-2 tabular-nums"
                style={{ bottom: `calc(${heights[i]}% + 2px)` }}
              >
                {it.value}
              </span>
            )}
            <span className="sr-only">
              {it.name}: {it.value}
            </span>
          </li>
        ))}
      </ol>
      <div aria-hidden="true" className="flex gap-[3px] text-[11px] text-muted tabular-nums">
        {items.map((it) => (
          <span key={it.key} className="flex-1 overflow-visible text-center whitespace-nowrap">
            {it.tick}
          </span>
        ))}
      </div>
    </figure>
  );
}

function CareerBars({ rows, total }: { rows: { name: string; users: number; noPlan: boolean }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.users));
  if (rows.length === 0) return <p className="text-sm text-muted">Todavía no hay usuarios.</p>;
  return (
    <ul className="flex flex-col gap-3 md:gap-2">
      {rows.map((r) => (
        <li
          key={r.name}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[12rem_minmax(0,1fr)_5.5rem]"
        >
          <span className={`text-sm ${r.noPlan ? "text-muted" : ""}`}>{r.name}</span>
          <div aria-hidden="true" className="order-last col-span-2 h-2.5 overflow-hidden rounded-full bg-line md:order-none md:col-span-1">
            <div
              className={`h-full rounded-full ${r.noPlan ? "bg-line-strong" : "bg-accent"}`}
              style={{ width: `${percent(r.users, max)}%` }}
            />
          </div>
          <span className="text-right text-sm tabular-nums">
            <span className={r.users === 0 ? "text-muted" : "font-semibold"}>{r.users}</span>
            <span className="text-muted"> · {Math.round(percent(r.users, total))} %</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const BAR_LEVEL: Record<Level, string> = { ok: "bg-accent", warn: "bg-progress-cbc", bad: "bg-danger" };

function Storage({ bytes, limit, tables }: { bytes: number; limit: number; tables: { name: string; bytes: number }[] }) {
  const p = percent(bytes, limit);
  const level = storageLevel(p);
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span>
            <span className="text-[22px] font-semibold tabular-nums">{formatBytes(bytes)}</span>{" "}
            <span className="text-sm text-muted">de {formatBytes(limit)} del plan gratis</span>
          </span>
          <span className={`text-sm font-semibold tabular-nums ${level === "ok" ? "text-ink-2" : level === "warn" ? "text-butter-ink" : "text-danger"}`}>
            {formatPercent(p)}
          </span>
        </div>
        <div
          role="meter"
          aria-label="Espacio usado de la base"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(p)}
          aria-valuetext={`${formatBytes(bytes)} de ${formatBytes(limit)} (${formatPercent(p)})`}
          className="h-3 overflow-hidden rounded-full bg-line"
        >
          {/* At least a sliver, so a tiny database still shows it is counted. */}
          <div className={`h-full rounded-full ${BAR_LEVEL[level]}`} style={{ width: `max(${p}%, 4px)` }} />
        </div>
      </div>
      {tables.length > 0 && (
        <div>
          <div className="mb-1 text-[13px] text-muted">Las tablas más grandes</div>
          <ul className="text-sm">
            {tables.map((t) => (
              <li key={t.name} className="flex justify-between gap-3 border-t border-line py-1.5 first:border-t-0">
                <span className="min-w-0 truncate font-mono text-[13px]">{t.name}</span>
                <span className="flex-none tabular-nums text-ink-2">{formatBytes(t.bytes)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Deployments({ result, now }: { result: DeploymentsResult; now: number }) {
  if (result.kind === "missing") {
    return (
      <p className="text-sm text-ink-2">
        Para ver los últimos despliegues, agregá <code className="font-mono text-[13px]">VERCEL_TOKEN</code> y{" "}
        <code className="font-mono text-[13px]">VERCEL_PROJECT_ID</code> en las variables de entorno de Vercel (y{" "}
        <code className="font-mono text-[13px]">VERCEL_TEAM_ID</code> si el proyecto es de un equipo).
      </p>
    );
  }
  if (result.kind === "error") return <p className="text-sm text-danger">{result.message}</p>;
  if (result.deployments.length === 0) return <p className="text-sm text-muted">No hay despliegues.</p>;
  return (
    <ul className="-mx-6 flex flex-col">
      {result.deployments.map((d) => {
        const state = deploymentState(d.state);
        const iso = new Date(d.createdAt).toISOString();
        return (
          <li key={d.id} className="flex items-center justify-between gap-3 border-t border-line px-6 py-2.5 first:border-t-0 first:pt-0">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {d.production ? "Producción" : "Vista previa"}
                {d.branch && <span className="font-normal text-muted"> · {d.branch}</span>}
              </div>
              <div className="text-[13px] text-muted tabular-nums">
                {dayLabel(buenosAiresDay(iso))} {timeLabel(iso)} · {ago(iso, now)}
              </div>
            </div>
            <Pill level={state.level} label={state.label} />
          </li>
        );
      })}
    </ul>
  );
}
