"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { COMMENT_MAX, STAR_LABELS, commentProblem } from "@/lib/reviews/filter";
import type { ReviewRound, ReviewTask } from "@/lib/reviews/pending";
import { submitReview } from "../actions";

const DOTS = [
  "bg-lavender border-lavender-ink/30",
  "bg-mint border-mint-ink/30",
  "bg-butter border-butter-ink/30",
  "bg-sky border-sky-ink/30",
  "bg-peach border-peach-ink/30",
];
const STAR = "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z";

export function PendingReviews({ round }: { round: ReviewRound }) {
  const [sent, setSent] = useState<Record<number, number | null>>(() =>
    Object.fromEntries(round.tasks.map((t) => [t.offeringId, t.sentStars])),
  );
  const done = round.tasks.filter((t) => sent[t.offeringId] != null).length;
  const total = round.tasks.length;
  const allDone = done === total;

  return (
    <main className="mx-auto flex w-full max-w-[860px] flex-col gap-[18px] px-6 pt-9 pb-14">
      <div>
        <h1 className="text-[32px] font-semibold tracking-[-0.01em]">Reseñas de tu cursada {round.termLabel}</h1>
        <div className="mt-1 text-muted">
          Puntuá cada curso que hiciste. Las estrellas son obligatorias; el comentario, opcional. Tu reseña es anónima.
        </div>
      </div>

      {allDone ? (
        <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-mint-line bg-mint px-[22px] py-5 text-mint-ink">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <div className="flex-[1_1_260px]">
            <div className="text-[17px] font-semibold">¡Listo! Desbloqueaste el plan del {round.nextTermLabel}</div>
            <div className="text-sm">Gracias por sumar tus reseñas.</div>
          </div>
          <Link href="/plan" className="rounded-[10px] bg-accent px-5 py-3 font-semibold text-on-accent">
            Ir al plan
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-surface px-5 py-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-muted">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          <div className="flex-[1_1_260px] text-sm">
            El plan del {round.nextTermLabel} se desbloquea cuando completes {total === 1 ? "tu reseña" : total === 2 ? "las dos" : total === 3 ? "las tres" : `las ${total}`}.
          </div>
          <div className="flex flex-[0_1_240px] items-center gap-2.5">
            <div className="h-2 flex-auto overflow-hidden rounded-lg bg-disabled" aria-hidden="true">
              <div className="h-2 bg-accent" style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">
              {done} de {total}
            </span>
          </div>
        </div>
      )}

      {round.tasks.map((t, i) => (
        <ReviewCard key={t.offeringId} task={t} dot={DOTS[i % DOTS.length]} onSent={(stars) => setSent((s) => ({ ...s, [t.offeringId]: stars }))} />
      ))}
    </main>
  );
}

function ReviewCard({ task, dot, onSent }: { task: ReviewTask; dot: string; onSent: (stars: number) => void }) {
  const router = useRouter();
  const [stars, setStars] = useState(task.sentStars ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(task.sentComment ?? "");
  const [withComment, setWithComment] = useState(!!task.sentComment);
  const [open, setOpen] = useState(task.sentStars === null);
  const [sentStars, setSentStars] = useState(task.sentStars);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const problem = withComment && comment ? commentProblem(comment) : null;
  const shown = hover || stars;
  const canSend = stars > 0 && !problem && !pending;

  function send() {
    if (!canSend) return;
    setError(null);
    startTransition(async () => {
      const result = await submitReview(task.offeringId, stars, withComment ? comment : "");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSentStars(stars);
      setOpen(false);
      onSent(stars);
      router.refresh(); // actualiza el contador del menú
    });
  }

  return (
    <section aria-label={task.subjectName} className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface px-6 py-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className={`mt-[5px] size-3.5 flex-none rounded-full border-2 ${dot}`} />
          <div>
            <div className="text-lg leading-snug font-semibold">{task.subjectName}</div>
            <div className="text-sm text-muted">{task.course}</div>
          </div>
        </div>
        {sentStars !== null && !open && (
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-[13px] font-semibold text-mint-ink">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              Enviada · {sentStars} de 5
            </span>
            <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold text-accent">
              Editar
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-3.5 pl-[26px]">
          <div className="flex flex-wrap items-center gap-3.5">
            <div role="radiogroup" aria-label="Puntaje de 1 a 5 estrellas" className="flex gap-0.5" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={stars === n}
                  aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
                  onClick={() => setStars(n)}
                  onMouseEnter={() => setHover(n)}
                  className="grid size-9 place-items-center rounded-md"
                >
                  <svg width="30" height="30" viewBox="0 0 24 24" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true" className={n <= shown ? "fill-star stroke-star" : "fill-none stroke-line-strong"}>
                    <path d={STAR} />
                  </svg>
                </button>
              ))}
            </div>
            <span className={`text-[15px] font-semibold ${shown ? "text-ink" : "text-muted"}`}>{shown ? STAR_LABELS[shown] : "Elegí de 1 a 5 estrellas"}</span>
          </div>

          {withComment && (
            <div className="flex flex-col gap-1">
              <label htmlFor={`c-${task.offeringId}`} className="text-[13px] font-semibold text-muted">
                Comentario (opcional)
              </label>
              <textarea
                id={`c-${task.offeringId}`}
                maxLength={COMMENT_MAX}
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Qué le dirías a alguien que está por elegir este curso?"
                className={`resize-y rounded-[10px] border bg-surface px-3 py-2.5 text-sm leading-snug text-ink ${problem ? "border-peach-ink/50" : "border-line-strong"}`}
              />
              <div className="flex items-start justify-between gap-3">
                {problem ? (
                  <span role="alert" className="text-[13px] font-semibold text-peach-ink">
                    {problem}
                  </span>
                ) : (
                  <span />
                )}
                <span className="flex-none text-xs text-muted">
                  {comment.length} / {COMMENT_MAX}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-peach px-4 py-2.5 text-sm text-peach-ink">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            {withComment ? (
              <span />
            ) : (
              <button type="button" onClick={() => setWithComment(true)} className="text-sm font-semibold text-accent">
                + Agregar un comentario
              </button>
            )}
            <button
              type="button"
              onClick={send}
              aria-disabled={!canSend}
              className={`h-[42px] rounded-[10px] px-5 text-sm font-semibold ${canSend ? "bg-accent text-on-accent" : "cursor-not-allowed bg-disabled text-disabled-ink"}`}
            >
              {pending ? "Enviando…" : "Enviar reseña"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
