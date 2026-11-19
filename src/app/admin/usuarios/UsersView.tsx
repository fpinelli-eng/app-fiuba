import type { ReactNode } from "react";
import { ago } from "@/lib/admin/health";
import {
  buenosAiresDay,
  dayLabel,
  deploymentState,
  formatBytes,
  formatPercent,
  latencyLevel,
  percent,
  storageLevel,
  timeLabel,
  SITE_URL,
  type AdminUser,
  type DeploymentsResult,
  type Level,
  type SiteCheck,
  type Usage,
} from "@/lib/admin/usage";

// Vercel's links that open the logged-in user's team and project ("[team]" and "[project]" are picked there).
const VERCEL_USAGE = "https://vercel.com/d?to=%2F%5Bteam%5D%2F~%2Fusage&title=Uso";
const VERCEL_ANALYTICS = "https://vercel.com/d?to=%2F%5Bteam%5D%2F%5Bproject%5D%2Fanalytics&title=Analytics";

const DAY = 24 * 60 * 60 * 1000;

// Administración → Usuarios, with the data already read (page.tsx). Separate so it can be previewed with sample data.
export function UsersView({
  usage,
  users,
  reviewAuthors,
  dbMs,
  site,
  deployments,
  now,
}: {
  usage: Usage | null;
  users: AdminUser[];
  reviewAuthors: number | null;
  dbMs: number;
  site: SiteCheck;
  deployments: DeploymentsResult;
  now: number;
}) {
  const count = (keep: (u: AdminUser) => boolean) => users.filter(keep).length;
  const date = (iso: string) => buenosAiresDay(iso).split("-").reverse().join("/");
  const dash = "—";

  const stats: (readonly [string, number | string])[] = [
    ["En total", users.length],
    ["Activos 24 h", usage ? usage.active24h : dash],
    ["Activos 7 días", usage ? usage.active7d : dash],
    ["Activos 30 días", usage ? usage.active30d : dash],
    ["Nuevos 7 días", count((u) => now - Date.parse(u.createdAt) < 7 * DAY)],
    ["Sin carrera", count((u) => !u.planId)],
    ["Con aprobadas", count((u) => u.subjects > 0)],
    ["Armaron el Plan", count((u) => u.planCourses > 0)],
    ["Dejaron reseñas", reviewAuthors ?? dash],
    ["Entraron por QR", count((u) => u.signupSource === "qr")],
  ];

  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-[18px] px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-14">
      <div>
        <h1 className="text-[30px] font-semibold">Usuarios</h1>
        <p className="text-muted">
          Quiénes usan la app y cómo anda el servidor, al momento de abrir esta página. Las reseñas son anónimas: no se ve quién
          escribió cuál ni cuántas.
        </p>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {stats.map(([label, n]) => (
          <li key={label} className="rounded-2xl border border-line bg-surface p-3">
            <div className="text-[13px] text-muted">{label}</div>
            <div className="text-[26px] font-semibold tabular-nums">{typeof n === "number" ? n.toLocaleString("es-AR") : n}</div>
          </li>
        ))}
      </ul>
      <p className="-mt-2 text-[13px] text-muted">
        “Activos” cuenta alumnos distintos que abrieron la app en ese lapso (se anota como mucho una vez por hora).
      </p>

      <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-2">
        <Card title="Por carrera" id="por-carrera">
          {usage ? (
            <CareerBars rows={usage.byCareer} total={usage.users} />
          ) : (
            <p className="text-sm text-muted">Disponible cuando se aplique la migración de la base.</p>
          )}
        </Card>

        <div className="flex min-w-0 flex-col gap-[18px]">
          {usage && (
            <Card title="Espacio en Supabase" id="espacio">
              <Storage bytes={usage.dbBytes} limit={usage.dbLimitBytes} />
            </Card>
          )}

          <Card title="Servidor" id="servidor">
            <ul className="-mx-6 flex flex-col">
              <CheckRow label="Base de datos" detail={`${dbMs.toLocaleString("es-AR")} ms en responder`} level={latencyLevel(dbMs)} />
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

          <Card title="Vercel" id="vercel">
            <Deployments result={deployments} now={now} />
            <p className="text-sm text-muted">
              Tráfico y visitas en el panel de Vercel:{" "}
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
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-[13px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-semibold">Nombre</th>
              <th className="px-4 py-2.5 font-semibold">Mail</th>
              <th className="px-4 py-2.5 font-semibold">Carrera</th>
              <th className="px-4 py-2.5 font-semibold">Alta</th>
              <th className="px-4 py-2.5 font-semibold">Origen</th>
              <th className="px-4 py-2.5 text-right font-semibold">Aprobadas</th>
              <th className="px-4 py-2.5 text-right font-semibold">Plan</th>
              <th className="px-4 py-2.5 font-semibold">Historias</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{u.fullName || dash}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{u.email}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{u.planId ? (u.plan ?? u.planId) : "Sin elegir"}</td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{u.createdAt ? date(u.createdAt) : dash}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{u.signupSource === "qr" ? "QR" : dash}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.subjects}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.planCourses}</td>
                <td className="px-4 py-2.5">{u.introSeen ? "Vistas" : dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function CareerBars({ rows, total }: { rows: { name: string; users: number; noPlan: boolean }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.users));
  if (rows.length === 0) return <p className="text-sm text-muted">Todavía no hay usuarios.</p>;
  return (
    <ul className="flex flex-col gap-3 md:gap-2">
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 lg:grid-cols-[10rem_minmax(0,1fr)_5.5rem]">
          <span className={`text-sm ${r.noPlan ? "text-muted" : ""}`}>{r.name}</span>
          <div aria-hidden="true" className="order-last col-span-2 h-2.5 overflow-hidden rounded-full bg-line lg:order-none lg:col-span-1">
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

function Storage({ bytes, limit }: { bytes: number; limit: number }) {
  const p = percent(bytes, limit);
  const level = storageLevel(p);
  return (
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
  );
}

function Deployments({ result, now }: { result: DeploymentsResult; now: number }) {
  if (result.kind === "missing") {
    return (
      <p className="text-sm text-ink-2">
        Para ver los últimos despliegues, agregá <code className="font-mono text-[13px]">VERCEL_TOKEN</code> en las
        variables de entorno de Vercel.
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
