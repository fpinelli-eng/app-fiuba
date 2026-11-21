"use client";

import { useId, useState } from "react";
import { timeLabel, type AdminUser } from "@/lib/admin/usage";

const dash = "—";

/**
 * The summary tiles of Administración → Usuarios. The first one, "Nuevos hoy" (Buenos Aires day,
 * newToday() in src/lib/admin/by-career.ts), opens the short list of those students below the tiles.
 */
export function SummaryTiles({ stats, newUsers }: { stats: (readonly [string, number | string])[]; newUsers: AdminUser[] }) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const n = newUsers.length;
  const value = (v: number | string) => (typeof v === "number" ? v.toLocaleString("es-AR") : v);

  return (
    <div className="flex flex-col gap-2.5">
      <ul className="grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-6">
        <li className={`rounded-2xl border ${n > 0 ? "border-mint-line bg-mint" : "border-line bg-surface"}`}>
          {n > 0 ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => setOpen((o) => !o)}
              className="flex h-full w-full flex-col items-start rounded-2xl p-3 text-left hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className="text-[13px] text-mint-ink">Nuevos hoy</span>
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className="text-[26px] font-semibold text-mint-ink tabular-nums">{value(n)}</span>
                <span className="text-[13px] font-semibold text-mint-ink">{open ? "Ocultar" : "Ver"}</span>
              </span>
            </button>
          ) : (
            <div className="p-3">
              <div className="text-[13px] text-muted">Nuevos hoy</div>
              <div className="text-[26px] font-semibold tabular-nums">0</div>
            </div>
          )}
        </li>
        {stats.map(([label, v]) => (
          <li key={label} className="rounded-2xl border border-line bg-surface p-3">
            <div className="text-[13px] text-muted">{label}</div>
            <div className="text-[26px] font-semibold tabular-nums">{value(v)}</div>
          </li>
        ))}
      </ul>

      {n > 0 && (
        <section id={listId} hidden={!open} aria-label="Nuevos hoy" className="overflow-x-auto rounded-2xl border border-line bg-surface">
          {open && (
            <table className="w-full text-left text-sm">
              <thead className="text-[13px] text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-semibold">Nombre</th>
                  <th className="px-4 py-2.5 font-semibold">Mail</th>
                  <th className="px-4 py-2.5 font-semibold">Carrera</th>
                  <th className="px-4 py-2.5 font-semibold">Se registró</th>
                  <th className="px-4 py-2.5 font-semibold">Origen</th>
                </tr>
              </thead>
              <tbody>
                {newUsers.map((u) => (
                  <tr key={u.email} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{u.fullName || dash}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{u.planId ? (u.plan ?? u.planId) : "Sin elegir"}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{timeLabel(u.createdAt)}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{u.signupSource === "qr" ? "QR" : dash}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
