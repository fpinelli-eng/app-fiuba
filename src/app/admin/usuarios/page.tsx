import type { Metadata } from "next";
import { APP_NAME } from "@/lib/app";
import { getAdminUsers } from "@/lib/admin/users";
import { getCareers } from "@/lib/careers";
import { buenosAiresDate } from "@/lib/news/model";

export const metadata: Metadata = { title: `Usuarios · Administración · ${APP_NAME}` };

const DAY = 24 * 60 * 60 * 1000;

/** "hoy", "ayer", "hace 3 días", "hace 2 semanas" (the database records it at most once per hour). */
function ago(ms: number): string {
  const days = Math.floor(ms / DAY);
  if (days < 1) return "hoy";
  if (days === 1) return "ayer";
  if (days < 14) return `hace ${days} días`;
  return `hace ${Math.round(days / 7)} semanas`;
}

// Usuarios: quiénes usan la app y qué usaron. El layout de /admin ya exige ser administrador y la
// función de la base lo vuelve a controlar. De las reseñas se muestra solo cuántas dejó cada uno,
// nunca cuáles: siguen siendo anónimas.
// Markup simple con los estilos que ya hay en Administración.
export default async function AdminUsersPage() {
  const [{ users, readAt: now }, careers] = await Promise.all([getAdminUsers(), getCareers()]);
  const planName = new Map(careers.flatMap((c) => c.plans.map((p) => [p.id, `${c.shortName} ${p.year}`] as const)));
  const since = (ms: number) => users.filter((u) => now - new Date(u.createdAt).getTime() < ms).length;
  const date = (iso: string) => buenosAiresDate(new Date(iso)).split("-").reverse().join("/");

  const stats = [
    ["En total", users.length],
    ["Últimas 24 h", since(DAY)],
    ["Últimos 7 días", since(7 * DAY)],
    ["Sin carrera", users.filter((u) => !u.planId).length],
    ["Con aprobadas", users.filter((u) => u.subjects > 0).length],
    ["Armaron el Plan", users.filter((u) => u.planCourses > 0).length],
    ["Dejaron reseñas", users.filter((u) => u.reviews > 0).length],
  ] as const;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[26px] font-semibold md:text-[32px]">Usuarios</h1>
        <p className="text-muted">Quiénes usan la app. De las reseñas se ve solo cuántas dejó cada uno, nunca cuáles: siguen siendo anónimas.</p>
      </div>

      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-7">
        {stats.map(([label, n]) => (
          <li key={label} className="rounded-2xl border border-line bg-surface p-3">
            <div className="text-[13px] text-muted">{label}</div>
            <div className="text-[26px] font-semibold tabular-nums">{n}</div>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="text-[13px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-2.5 font-semibold">Nombre</th>
              <th className="px-4 py-2.5 font-semibold">Mail</th>
              <th className="px-4 py-2.5 font-semibold">Carrera</th>
              <th className="px-4 py-2.5 font-semibold">Alta</th>
              <th className="px-4 py-2.5 font-semibold">Último uso</th>
              <th className="px-4 py-2.5 text-right font-semibold">Aprobadas</th>
              <th className="px-4 py-2.5 text-right font-semibold">Reseñas</th>
              <th className="px-4 py-2.5 text-right font-semibold">Plan</th>
              <th className="px-4 py-2.5 font-semibold">Historias</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.email} className="border-b border-line last:border-b-0">
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{u.fullName || "—"}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{u.email}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{u.planId ? (planName.get(u.planId) ?? u.planId) : "Sin elegir"}</td>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{date(u.createdAt)}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{u.lastSeenAt ? ago(now - new Date(u.lastSeenAt).getTime()) : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.subjects}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.reviews}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{u.planCourses}</td>
                <td className="px-4 py-2.5">{u.introSeen ? "Vistas" : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
