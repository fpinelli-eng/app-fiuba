"use client";

import { useState, useTransition } from "react";
import { COMMENT_MAX, STAR_LABELS, commentProblem } from "@/lib/reviews/filter";
import type { SubmitResult } from "./actions";

const STAR = "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z";

// Estrellas, comentario opcional con el filtro en vivo y "Enviar reseña". Lo usan las reseñas
// pendientes y la ficha del curso.
export function ReviewForm({
  id,
  initialStars,
  initialComment,
  send,
  onSent,
}: {
  /** Unique per page, for the comment field. */
  id: string;
  initialStars: number | null;
  initialComment: string | null;
  send: (stars: number, comment: string) => Promise<SubmitResult>;
  onSent: (stars: number, comment: string) => void;
}) {
  const [stars, setStars] = useState(initialStars ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(initialComment ?? "");
  const [withComment, setWithComment] = useState(!!initialComment);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const problem = withComment && comment ? commentProblem(comment) : null;
  const shown = hover || stars;
  const canSend = stars > 0 && !problem && !pending;

  function submit() {
    if (!canSend) return;
    setError(null);
    const text = withComment ? comment : "";
    startTransition(async () => {
      const result = await send(stars, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSent(stars, text.trim());
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
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
          <label htmlFor={`c-${id}`} className="text-[13px] font-semibold text-muted">
            Comentario (opcional)
          </label>
          <textarea
            id={`c-${id}`}
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
          onClick={submit}
          aria-disabled={!canSend}
          className={`h-[42px] rounded-[10px] px-5 text-sm font-semibold ${canSend ? "bg-accent text-on-accent" : "cursor-not-allowed bg-disabled text-disabled-ink"}`}
        >
          {pending ? "Enviando…" : "Enviar reseña"}
        </button>
      </div>
    </div>
  );
}
