"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Stars } from "@/components/Stars";
import type { MyReview } from "@/lib/reviews/mine";
import { reviewCourse } from "../resenas/actions";
import { ReviewForm } from "../resenas/ReviewForm";

// Una reseña propia en el perfil, con "Editar" en el lugar (prototipo 12-perfil).
export function MyReviewRow({ review }: { review: MyReview }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 border-t border-line px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold">{review.subjectName}</div>
          <div className="text-[13px] text-muted">
            {review.detail}
            {review.hidden && " · Oculta por moderación"}
          </div>
        </div>
        {!open && (
          <div className="flex flex-none items-center gap-3">
            <Stars value={review.stars} />
            {!review.hidden && (
              <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-semibold text-accent">
                Editar
              </button>
            )}
          </div>
        )}
      </div>
      {open ? (
        <ReviewForm
          id={`mine-${review.id}`}
          initialStars={review.stars}
          initialComment={review.comment}
          send={(stars, comment) => reviewCourse(review.courseId, stars, comment)}
          onSent={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      ) : (
        review.comment && <div className="text-sm text-ink-2">{review.comment}</div>
      )}
    </div>
  );
}
