"use client";

import { useState } from "react";
import type { ModerationReview } from "@/lib/admin/reviews";
import { setReviewHidden, setReviewPinned } from "./actions";

// Pestaña Reseñas de Administración (prototipo 13): buscar, fijar ("Destacada") y eliminar
// con deshacer. Los cambios se ven al instante y vuelven atrás si la base no los acepta.

type Filter = "todas" | "fijadas" | "eliminadas";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "todas", label: "Todas" },
  { key: "fijadas", label: "Fijadas" },
  { key: "eliminadas", label: "Eliminadas" },
];

const plain = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function ReviewModeration({ reviews: initial }: { reviews: ModerationReview[] }) {
  const [reviews, setReviews] = useState(initial);
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");
  // Hidden in this visit: shown as "Reseña eliminada · Deshacer" until the page reloads.
  const [justHidden, setJustHidden] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const patch = (id: number, change: Partial<ModerationReview>) =>
    setReviews((list) => list.map((r) => (r.id === id ? { ...r, ...change } : r)));

  async function pin(r: ModerationReview) {
    patch(r.id, { pinned: !r.pinned });
    const res = await setReviewPinned(r.id, !r.pinned);
    if (res.error) {
      patch(r.id, { pinned: r.pinned });
      setError(res.error);
    }
  }

  async function hide(r: ModerationReview, hidden: boolean) {
    patch(r.id, { hidden });
    setJustHidden((s) => {
      const next = new Set(s);
      if (hidden) next.add(r.id);
      else next.delete(r.id);
      return next;
    });
    const res = await setReviewHidden(r.id, hidden);
    if (res.error) {
      patch(r.id, { hidden: !hidden });
      setError(res.error);
    }
  }

  const q = plain(query.trim());
  const visible = reviews.filter((r) => {
    if (filter === "fijadas" && !(r.pinned && !r.hidden)) return false;
    if (filter === "eliminadas" && !r.hidden) return false;
    if (filter === "todas" && r.hidden && !justHidden.has(r.id)) return false;
    return !q || plain(`${r.subject} ${r.teachers} ${r.comment ?? ""}`).includes(q);
  });
  const total = reviews.filter((r) => !r.hidden).length;

  return (
    <main className="mx-auto flex w-full max-w-[1000px] flex-col gap-4 px-6 pt-8 pb-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold">Reseñas</h1>
          <div className="text-muted">
            {total} {total === 1 ? "reseña publicada" : "reseñas publicadas"}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-[10px] border border-line bg-surface p-[3px]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`h-[34px] rounded-lg px-3.5 text-sm ${
                  filter === f.key ? "bg-lavender font-semibold text-lavender-ink" : "text-muted hover:text-ink"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label htmlFor="buscar-resena" className="sr-only">
            Buscar materia, docente o texto
          </label>
          <input
            id="buscar-resena"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar materia, docente o texto"
            className="h-[42px] w-[280px] rounded-[10px] border border-line-strong bg-surface px-3.5 text-sm text-ink"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-[10px] bg-peach px-3 py-2 text-[13px] text-peach-ink">
          {error}
        </p>
      )}

      <section className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {visible.map((r) =>
          r.hidden && filter === "todas" ? (
            <div key={r.id} className="flex items-center justify-between gap-4 border-t border-line bg-bg px-6 py-3 first:border-t-0">
              <span className="text-sm text-muted">
                Reseña eliminada · {r.subject} · {r.course}
              </span>
              <button type="button" onClick={() => hide(r, false)} className="text-sm text-muted underline">
                Deshacer
              </button>
            </div>
          ) : (
            <article
              key={r.id}
              className={`flex flex-col gap-2 border-t border-line px-6 py-4 first:border-t-0 ${r.pinned && !r.hidden ? "bg-accent-soft" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">
                    {r.subject}
                    {r.course && ` · ${r.course}`}
                    {r.pinned && !r.hidden && (
                      <span className="ml-2 rounded-full bg-lavender px-2 py-px text-[11.5px] font-semibold text-lavender-ink">Destacada</span>
                    )}
                  </div>
                  <div className="text-[13px] text-muted">
                    <span className="tracking-[1px] text-star" aria-label={`${r.stars} de 5 estrellas`}>
                      {"★".repeat(r.stars)}
                    </span>
                    <span className="tracking-[1px] text-line-strong" aria-hidden="true">
                      {"★".repeat(5 - r.stars)}
                    </span>
                    {r.teachers && ` · ${r.teachers}`} · {r.term}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-4">
                  {r.hidden ? (
                    <button type="button" onClick={() => hide(r, false)} className="text-sm font-semibold text-accent">
                      Restaurar
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-pressed={r.pinned}
                        onClick={() => pin(r)}
                        className={`text-sm font-semibold ${r.pinned ? "text-accent" : "text-muted hover:text-ink"}`}
                      >
                        {r.pinned ? "Desfijar" : "Fijar"}
                      </button>
                      <button type="button" onClick={() => hide(r, true)} className="text-sm font-semibold text-danger">
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </div>
              {r.comment ? (
                <p className="text-[14.5px] text-ink-2">{r.comment}</p>
              ) : (
                <p className="text-[13px] text-muted">Sin comentario</p>
              )}
            </article>
          ),
        )}
        {visible.length === 0 && <div className="px-6 py-5 text-muted">No hay reseñas con ese filtro.</div>}
      </section>
    </main>
  );
}
