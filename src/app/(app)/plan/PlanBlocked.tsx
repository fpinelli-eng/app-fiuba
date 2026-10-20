import Link from "next/link";
import type { ReviewRound } from "@/lib/reviews/pending";

// Plan bloqueado (prototipo 08-plan-bloqueado): con reseñas pendientes no se arma el plan,
// como la encuesta del SIU antes de inscribirse (PRODUCTO.md, 5.3 y 13).

const DOTS = [
  "bg-lavender border-lavender-ink/25",
  "bg-mint border-mint-ink/25",
  "bg-butter border-butter-ink/25",
  "bg-sky border-sky-ink/25",
  "bg-peach border-peach-ink/25",
  "bg-pink border-pink-ink/25",
  "bg-teal border-teal-ink/25",
];

export function PlanBlocked({ round }: { round: ReviewRound }) {
  const missing = round.tasks.filter((t) => t.sentStars === null).length;
  return (
    <main className="mx-auto w-full max-w-[600px] px-6 py-[72px]">
      <section className="flex flex-col items-center gap-[18px] rounded-[20px] border border-line bg-surface px-9 pt-9 pb-7 text-center">
        <div className="grid size-14 place-items-center rounded-full bg-peach text-peach-ink">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </div>
        <div>
          <h1 className="text-[26px] leading-tight font-semibold text-balance">
            Reseñá tu cursada para armar el plan del {round.nextTermLabel}
          </h1>
          <p className="mt-1.5 text-muted">
            Te {missing === 1 ? "falta 1 reseña" : `faltan ${missing} reseñas`} del {round.termLabel}.
          </p>
        </div>
        <ul className="w-full">
          {round.tasks.map((t, i) => (
            <li key={t.courseId} className="flex items-center justify-between gap-4 border-t border-line py-3.5 text-left">
              <div className="flex items-start gap-3">
                <span className={`mt-[5px] size-3 flex-none rounded-full border-2 ${DOTS[i % DOTS.length]}`} />
                <div>
                  <div className="font-semibold">{t.subjectName}</div>
                  <div className="text-[13px] text-muted">{t.course}</div>
                </div>
              </div>
              {t.sentStars === null ? (
                <span className="flex-none rounded-full bg-peach px-2.5 py-0.5 text-[12.5px] font-semibold text-peach-ink">Pendiente</span>
              ) : (
                <span className="flex-none rounded-full bg-mint px-2.5 py-0.5 text-[12.5px] font-semibold text-mint-ink">Hecha</span>
              )}
            </li>
          ))}
        </ul>
        <Link
          href="/resenas/pendientes"
          className="inline-flex h-[46px] items-center rounded-[11px] bg-accent px-6 font-semibold text-on-accent"
        >
          Completar reseñas
        </Link>
      </section>
    </main>
  );
}
