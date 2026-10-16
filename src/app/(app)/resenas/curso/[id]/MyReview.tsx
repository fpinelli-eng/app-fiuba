"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stars } from "@/components/Stars";
import { reviewCourse } from "../../actions";
import { ReviewForm } from "../../ReviewForm";

// "Tu reseña" en la ficha del curso: cualquiera puede reseñar cualquier curso, una vez (después se edita).
export function MyReview({
  courseId,
  mine,
}: {
  courseId: number;
  mine: { stars: number; comment: string | null; hidden: boolean } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Tu reseña" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold tracking-[0.08em] text-muted">TU RESEÑA</div>
        {mine && !open && (
          <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold text-accent">
            Editar
          </button>
        )}
      </div>

      {open ? (
        <ReviewForm
          id={`course-${courseId}`}
          initialStars={mine?.stars ?? null}
          initialComment={mine?.comment ?? null}
          send={(stars, comment) => reviewCourse(courseId, stars, comment)}
          onSent={() => {
            setOpen(false);
            router.refresh(); // puntaje, distribución y comentarios
          }}
        />
      ) : mine ? (
        <div className="flex flex-col gap-1.5">
          <Stars value={mine.stars} size={18} label={`${mine.stars} de 5 estrellas`} />
          {mine.comment && <p className="text-[15px]">{mine.comment}</p>}
          <div className="text-[13px] text-muted">{mine.hidden ? "La quitó un administrador." : "Se publica sin tu nombre."}</div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="h-[42px] self-start rounded-[10px] bg-accent px-5 text-sm font-semibold text-on-accent">
          Reseñar este curso
        </button>
      )}
    </section>
  );
}
