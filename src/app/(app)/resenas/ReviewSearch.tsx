"use client";

import Link from "next/link";
import { useState } from "react";
import { StarIcon } from "@/components/Stars";
import { normalizeText } from "@/lib/map/model";
import { formatScore, type SubjectReviews } from "@/lib/reviews/types";

type Sort = "score" | "count";

interface Props {
  subjects: SubjectReviews[];
  /** "Ingeniería Industrial (plan 2023)" */
  planLabel: string;
  pending: { count: number; termLabel: string } | null;
}

export function ReviewSearch({ subjects, planLabel, pending }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("score");
  const q = normalizeText(query);

  const shown = subjects
    .map((s) => {
      const subjectMatches = !q || normalizeText(s.name).includes(q);
      const courses = (subjectMatches ? s.courses : s.courses.filter((c) => normalizeText(c.teachers).includes(q))).toSorted((a, b) => {
        const key = (c: (typeof a)) => (c.score ? (sort === "score" ? c.score.average : c.score.count) : -1);
        return key(b) - key(a);
      });
      return subjectMatches || courses.length ? { ...s, courses } : null;
    })
    .filter((s): s is SubjectReviews => s !== null)
    .toSorted((a, b) => normalizeText(a.name).localeCompare(normalizeText(b.name)));
  const courseCount = shown.reduce((n, s) => n + s.courses.length, 0);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

  return (
    <main className="mx-auto flex w-full max-w-[980px] flex-col gap-[18px] px-6 pt-8 pb-14">
      <h1 className="text-[32px] font-semibold tracking-[-0.01em]">Reseñas de cursos</h1>

      {pending && (
        <Link href="/resenas/pendientes" className="flex items-center gap-3.5 rounded-[14px] bg-peach px-[18px] py-3.5 text-peach-ink">
          <span className="text-2xl leading-none font-semibold">{pending.count}</span>
          <span className="flex-auto">
            <b>Reseñas pendientes de tu cursada {pending.termLabel}.</b> Completalas para desbloquear el plan.
          </span>
          <span className="font-semibold whitespace-nowrap">Reseñar →</span>
        </Link>
      )}

      <div className="flex flex-col gap-3">
        <div className="relative">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="absolute top-[15px] left-4 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <label htmlFor="q" className="sr-only">
            Buscar por materia o docente
          </label>
          <input
            id="q"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá por materia o docente"
            className="h-[50px] w-full rounded-xl border border-line-strong bg-surface pr-4 pl-[46px] text-base text-ink"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[13px] text-muted">
            {q
              ? `${plural(shown.length, "materia", "materias")} · ${plural(courseCount, "curso", "cursos")}`
              : `Las ${shown.length} materias de ${planLabel} · ${plural(courseCount, "curso", "cursos")}`}
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-muted">Ordenar cursos por</span>
            <div role="group" aria-label="Ordenar" className="flex rounded-[10px] border border-line bg-surface p-[3px]">
              {(
                [
                  ["score", "Mejor puntaje"],
                  ["count", "Más reseñas"],
                ] as [Sort, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={sort === value}
                  onClick={() => setSort(value)}
                  className={`h-[30px] rounded-[7px] px-3 text-[13px] ${sort === value ? "bg-lavender font-semibold text-lavender-ink" : "text-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {shown.length === 0 && (
        <div className="rounded-2xl border border-line bg-surface px-6 py-10 text-center text-muted">
          No encontramos materias ni docentes con esa búsqueda.
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {shown.map((s) => (
          <section key={s.subjectId} aria-label={s.name} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="flex items-baseline justify-between gap-4 bg-lavender px-[22px] py-3.5">
              <h2 className="text-[19px] leading-snug font-semibold text-lavender-ink">{s.name}</h2>
              <span className="text-[13px] whitespace-nowrap text-lavender-ink/80">
                {s.kindLabel} · {s.credits} C ·{" "}
                {s.courses.length === 0 ? "sin cursos este cuatrimestre" : plural(s.courses.length, "curso", "cursos")}
              </span>
            </div>
            {s.courses.length === 0 && <div className="px-[22px] py-3.5 text-[13px] text-muted">No se dicta este cuatrimestre.</div>}
            {s.courses.length > 0 && (
              <div className="py-1">
                {s.courses.map((c) => (
                  <Link
                    key={c.courseId}
                    href={`/resenas/curso/${c.courseId}`}
                    className="flex items-center gap-4 px-[22px] py-2.5 hover:bg-bg"
                  >
                    <div className="min-w-0 flex-auto">
                      <div className="text-sm font-semibold text-ink-2">{c.label}</div>
                      <div className="text-[13px] text-muted">{c.teachers}</div>
                    </div>
                    {c.score ? (
                      <>
                        <div className="h-1.5 w-[140px] flex-none overflow-hidden rounded-md bg-disabled" aria-hidden="true">
                          <div className="h-1.5 bg-star" style={{ width: `${Math.round((c.score.average / 5) * 100)}%` }} />
                        </div>
                        <span className="flex w-[92px] flex-none items-center justify-end gap-1 text-sm font-semibold">
                          <StarIcon />
                          {formatScore(c.score.average)} <span className="text-[12.5px] font-normal text-muted">({c.score.count})</span>
                        </span>
                      </>
                    ) : (
                      <span className="w-[240px] flex-none text-right text-[13px] text-muted">Sin reseñas todavía</span>
                    )}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-enabled-line">
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
