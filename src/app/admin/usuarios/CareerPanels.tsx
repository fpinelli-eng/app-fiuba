"use client";

import { useId, useMemo, useState } from "react";
import { buenosAiresDay, dateTimeLabel, type AdminUser } from "@/lib/admin/usage";
import { filterGroups, isNewToday, type CareerGroup } from "@/lib/admin/by-career";

const secondary =
  "h-10 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-line/40 disabled:cursor-not-allowed disabled:text-disabled-ink";
const dash = "—";

/**
 * The students in one collapsible panel per career (grouped in src/lib/admin/by-career.ts). All
 * start closed; the search filters across panels and opens the ones with matches. Students who signed
 * up today (Buenos Aires day; now: the database clock) get a "Nuevo" badge and count in "+N hoy".
 */
export function CareerPanels({ groups, now }: { groups: CareerGroup[]; now: number }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const searchId = useId();
  const shown = useMemo(() => filterGroups(groups, query), [groups, query]);
  const searching = query.trim() !== "";
  const allOpen = shown.length > 0 && shown.every((g) => open.has(g.group.key));
  const found = shown.reduce((n, g) => n + g.matches.length, 0);

  function search(value: string) {
    setQuery(value);
    setOpen(new Set(value.trim() ? filterGroups(groups, value).map((g) => g.group.key) : []));
  }

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section aria-labelledby="alumnos-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="alumnos-title" className="text-[19px] font-semibold">
          Alumnos por carrera
        </h2>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor={searchId} className="sr-only">
            Buscar por nombre, mail o carrera
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Buscar por nombre, mail o carrera"
            autoComplete="off"
            className="h-[42px] w-full rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-ink sm:w-72"
          />
          <button
            type="button"
            className={secondary}
            disabled={shown.length === 0}
            onClick={() => setOpen(new Set(allOpen ? [] : shown.map((g) => g.group.key)))}
          >
            {allOpen ? "Cerrar todas" : "Abrir todas"}
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {searching ? `${found} ${found === 1 ? "alumno coincide" : "alumnos coinciden"}` : ""}
      </p>

      {groups.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">Todavía no hay usuarios.</p>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">Nadie coincide con “{query.trim()}”.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map(({ group, matches }) => (
            <Panel
              key={group.key}
              group={group}
              matches={matches}
              searching={searching}
              now={now}
              open={open.has(group.key)}
              onToggle={() => toggle(group.key)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Panel({
  group,
  matches,
  searching,
  now,
  open,
  onToggle,
}: {
  group: CareerGroup;
  matches: AdminUser[];
  searching: boolean;
  now: number;
  open: boolean;
  onToggle: () => void;
}) {
  const bodyId = useId();
  const total = group.users.length;
  const n = (v: number) => v.toLocaleString("es-AR");
  const today = group.users.filter((u) => isNewToday(u, now)).length;
  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={onToggle}
          className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-line/30 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className={`size-4 flex-none text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
          >
            <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="mr-auto flex flex-wrap items-center gap-2">
            <span className={`font-semibold ${group.noPlan ? "text-muted" : ""}`}>{group.name}</span>
            {today > 0 && (
              <span className="rounded-full bg-mint px-2 py-[2px] text-xs font-semibold text-mint-ink tabular-nums">+{n(today)} hoy</span>
            )}
          </span>
          <span className="text-sm text-muted tabular-nums">
            {searching && (
              <>
                <b className="font-semibold text-ink">{n(matches.length)}</b> de{" "}
              </>
            )}
            {n(total)} {total === 1 ? "usuario" : "usuarios"}
            {group.active7d !== null && <> · {n(group.active7d)} activos en 7 días</>}
          </span>
        </button>
      </h3>
      <div id={bodyId} hidden={!open} className="overflow-x-auto border-t border-line">
        {open && <UsersTable users={matches} now={now} />}
      </div>
    </li>
  );
}

function UsersTable({ users, now }: { users: AdminUser[]; now: number }) {
  const date = (iso: string) => buenosAiresDay(iso).split("-").reverse().join("/");
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-[13px] text-muted">
        <tr className="border-b border-line">
          <th className="px-4 py-2.5 font-semibold">Nombre</th>
          <th className="px-4 py-2.5 font-semibold">Mail</th>
          <th className="px-4 py-2.5 font-semibold">Carrera</th>
          <th className="px-4 py-2.5 font-semibold">Alta</th>
          <th className="px-4 py-2.5 font-semibold">Último uso</th>
          <th className="px-4 py-2.5 font-semibold">Origen</th>
          <th className="px-4 py-2.5 text-right font-semibold">Aprobadas</th>
          <th className="px-4 py-2.5 text-right font-semibold">Plan</th>
          <th className="px-4 py-2.5 font-semibold">Historias</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.email} className="border-b border-line last:border-b-0">
            <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
              {u.fullName || dash}
              {isNewToday(u, now) && (
                <span className="ml-2 rounded-full bg-mint px-2 py-[2px] align-[1px] text-xs font-semibold text-mint-ink">Nuevo</span>
              )}
            </td>
            <td className="px-4 py-2.5 whitespace-nowrap">{u.email}</td>
            <td className="px-4 py-2.5 whitespace-nowrap">{u.planId ? (u.plan ?? u.planId) : "Sin elegir"}</td>
            <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{u.createdAt ? date(u.createdAt) : dash}</td>
            <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
              {u.lastSeen ? <time dateTime={u.lastSeen}>{dateTimeLabel(u.lastSeen)}</time> : dash}
            </td>
            <td className="px-4 py-2.5 whitespace-nowrap">{u.signupSource === "qr" ? "QR" : dash}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{u.subjects}</td>
            <td className="px-4 py-2.5 text-right tabular-nums">{u.planCourses}</td>
            <td className="px-4 py-2.5">{u.introSeen ? "Vistas" : dash}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
