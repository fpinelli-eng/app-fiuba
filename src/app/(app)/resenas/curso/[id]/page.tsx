import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { StarIcon, Stars } from "@/components/Stars";
import { APP_NAME } from "@/lib/app";
import { getCourse } from "@/lib/reviews/catalog";
import { formatScore } from "@/lib/reviews/types";
import { requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: `Curso · ${APP_NAME}` };

// Ficha de un curso (prototipo 10-resenas-ficha-curso): puntaje, distribución, otros cursos y comentarios.
export default async function CursoPage({ params }: PageProps<"/resenas/curso/[id]">) {
  const account = await requireProfile();
  const { id } = await params;
  const courseId = Number(id);
  if (!Number.isInteger(courseId)) notFound();
  const course = await getCourse(courseId, account.planId!);
  if (!course) notFound();

  const total = course.score?.count ?? 0;
  const withComment = course.comments.length;

  return (
    <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-6 pt-7 pb-14">
      <div>
        <div className="text-sm text-muted">
          <Link href="/resenas" className="underline">
            Reseñas de cursos
          </Link>{" "}
          › {course.subject?.name}
          {course.subject?.credits ? ` · ${course.subject.credits} C` : ""}
        </div>
        <h1 className="mt-1 text-[34px] font-semibold tracking-[-0.01em]">{course.label}</h1>
        <div className="text-base font-medium text-ink-2">{course.teachers}</div>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex flex-[1_1_320px] flex-col gap-5">
          <Card label="PUNTAJE DE LOS ALUMNOS">
            {course.score ? (
              <>
                <div className="flex items-center gap-4">
                  <div className="text-[56px] leading-none font-semibold">{formatScore(course.score.average)}</div>
                  <div className="flex flex-col gap-1">
                    <Stars value={course.score.average} size={20} label={`${formatScore(course.score.average)} de 5 estrellas`} />
                    <div className="text-[13px] text-muted">
                      {total} {total === 1 ? "reseña" : "reseñas"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {course.distribution.map((n, i) => (
                    <div key={i} className="grid grid-cols-[34px_minmax(0,1fr)_28px] items-center gap-2.5 text-[13px]">
                      <span>{5 - i} ★</span>
                      <div className="h-2 overflow-hidden rounded-lg bg-disabled">
                        <div className="h-2 rounded-lg bg-star" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
                      </div>
                      <span className="text-right text-muted">{n}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-muted">Sin reseñas todavía.</div>
            )}
          </Card>

          {course.otherCourses.length > 0 && (
            <Card label="OTROS CURSOS DE LA MATERIA">
              <div className="flex flex-col">
                {course.otherCourses.map((c) => (
                  <Link key={c.courseId} href={`/resenas/curso/${c.courseId}`} className="flex items-center justify-between gap-3 border-t border-disabled py-3 first:border-t-0 first:pt-0">
                    <div className="min-w-0">
                      <div className="font-semibold">{c.label}</div>
                      <div className="text-[13px] text-muted">{[c.teachers, c.schedule].filter(Boolean).join(" · ")}</div>
                    </div>
                    {c.score ? (
                      <span className="flex flex-none items-center gap-1 text-sm font-semibold">
                        <StarIcon />
                        {formatScore(c.score.average)} <span className="font-normal text-muted">({c.score.count})</span>
                      </span>
                    ) : (
                      <span className="flex-none text-[13px] text-muted">Sin reseñas</span>
                    )}
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>

        <section aria-label="Comentarios" className="flex min-w-0 flex-[999_1_520px] flex-col rounded-2xl border border-line bg-surface p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3">
            <div className="text-xs font-semibold tracking-[0.08em] text-muted">COMENTARIOS</div>
            {total > 0 && (
              <span className="text-[13px] text-muted">
                {withComment} de {total} {total === 1 ? "reseña tiene" : "reseñas tienen"} comentario · más recientes primero
              </span>
            )}
          </div>
          {withComment === 0 && <div className="border-t border-disabled py-4 text-muted">Todavía no hay comentarios.</div>}
          {course.comments.map((c) => (
            <article key={c.id} className="flex flex-col gap-1.5 border-t border-disabled py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold">
                  <Stars value={c.stars} size={14} />
                  {c.termLabel}
                </span>
                {c.pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-lavender px-2.5 py-0.5 text-xs font-semibold text-lavender-ink">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M15 3l6 6-3 1-4 4 1 5-2 1-4-5-5 5-1-1 5-5-5-4 1-2 5 1 4-4z" />
                    </svg>
                    Destacada
                  </span>
                )}
              </div>
              <p className="text-[15px]">{c.comment}</p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Card({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      <div className="text-xs font-semibold tracking-[0.08em] text-muted">{label}</div>
      {children}
    </section>
  );
}
