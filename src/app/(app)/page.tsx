import Link from "next/link";
import type { ReactNode } from "react";
import { HomeCalendar } from "./HomeCalendar";
import { ProgressArc, type ArcCategoryTotals } from "./ProgressArc";
import { arcStations } from "@/lib/home/arc";
import { getHomeCourses } from "@/lib/home/courses";
import { getMapData } from "@/lib/map/data";
import { getReviewRound } from "@/lib/reviews/pending";
import { CareerMap, formatAverage, totalCredits, type Progress } from "@/lib/map/model";
import { requireProfile } from "@/lib/session";

// Inicio (rediseño del 5 de noviembre de 2026, contrato en .impeccable/surfaces/src-app-app-page-tsx.md):
// el saludo, el arco de avance, el promedio, las materias aprobadas, las reseñas pendientes,
// la semana y los finales pendientes. La semana sale de la inscripción del Plan; sin inscripción
// en el cuatrimestre actual, la lista de materias en "Cursando" del mapa.

const CARD = "rounded-[24px] bg-surface shadow-[0_16px_30px_-28px_var(--card-shadow)] md:rounded-[28px]";

export default async function InicioPage() {
  const account = await requireProfile();
  const [data, round] = await Promise.all([getMapData(account.id, account.planId!), getReviewRound(account.id, null)]);
  const pendingReviews = round ? round.tasks.filter((t) => t.sentStars === null).length : 0;
  const courses = await getHomeCourses(account.id, data.subjects);
  const map = new CareerMap(data.subjects, data.requirements);
  const progress: Progress = {
    subjects: new Map(data.progress.subjects.map((s) => [s.subjectId, { status: s.status, grade: s.grade }])),
    requirements: new Set(data.progress.requirements),
  };

  const total = totalCredits(data.creditRules) ?? map.subjects.reduce((a, s) => a + s.credits, 0);
  const credits = map.approvedCredits(progress);
  const cat = map.creditsByCategory(progress, data.creditRules);
  const lastLevel = Math.max(0, ...map.subjects.filter((s) => s.kind === "required").map((s) => s.level ?? 0));
  const categories: ArcCategoryTotals[] = [
    { category: "cbc", name: "CBC", done: cat.cbc.done, total: cat.cbc.total },
    { category: "required", name: "Obligatorias", done: cat.required.done, total: cat.required.total },
    { category: "elective", name: "Electivas", done: cat.electives.done, total: cat.electives.total },
    { category: "final", name: "Trabajo final", done: cat.final.done, total: cat.final.total || null },
  ];
  const average = map.average(progress);

  const withStatus = (status: string) => map.subjects.filter((s) => progress.subjects.get(s.id)?.status === status);
  const approved = withStatus("approved");
  const inProgress = withStatus("in_progress");
  const finals = withStatus("final_pending").map((s) => ({
    subject: s,
    unlocks: map.unlocks(s.id).filter((u) => !progress.subjects.has(u.id)).length,
  }));
  const nothingLoaded = progress.subjects.size === 0 && progress.requirements.size === 0;

  return (
    <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-3.5 px-4 pt-1.5 pb-8 md:gap-6 md:px-8 md:pt-2 md:pb-14">
      <div>
        <h1 className="text-[32px] leading-[38px] font-medium tracking-[-0.025em] md:text-[48px] md:leading-[56px]">Hola, {account.firstName}</h1>
        <p className="mt-1 text-[15px] text-muted md:mt-1.5 md:text-[17px]">
          {data.careerName}, plan {data.year}
        </p>
      </div>

      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] md:gap-6">
        <section aria-labelledby="avance" className={`${CARD} p-4 md:rounded-[32px] md:px-7 md:pt-6 md:pb-[22px]`}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="avance" className="text-base font-semibold md:text-lg">
              Avance de la carrera
            </h2>
            <MoreLink href="/mapa">Ver el mapa</MoreLink>
          </div>
          <ProgressArc credits={credits} total={total} categories={categories} stations={arcStations(total, cat.cbc.total, lastLevel)} />
        </section>

        <div className="grid grid-cols-2 gap-3 md:gap-6 lg:flex lg:flex-col">
          <section aria-labelledby="promedio" className="flex flex-col justify-center rounded-[24px] bg-mint px-[18px] py-4 md:rounded-[32px] lg:flex-1 md:px-[30px] md:py-6">
            <h2 id="promedio" className="text-sm font-semibold text-mint-ink md:text-lg">
              Promedio
            </h2>
            <div className="font-display text-[40px] leading-[48px] font-medium tracking-[-0.03em] tabular-nums md:text-[76px] md:leading-[88px]">
              {formatAverage(average)}
            </div>
            <p className="text-[13px] text-mint-ink md:text-base">{average === null ? "Sin notas todavía" : "Sin aplazos"}</p>
          </section>

          <section
            aria-labelledby="aprobadas"
            className="flex flex-col rounded-[24px] bg-lavender px-[18px] py-4 text-lavender-ink md:flex-row md:items-center md:justify-between md:gap-4 md:rounded-[28px] md:px-[26px] md:py-[18px]"
          >
            <h2 id="aprobadas" className="text-sm font-semibold md:text-lg">
              <span className="md:hidden">Aprobadas</span>
              <span className="hidden md:inline">Materias aprobadas</span>
            </h2>
            <div className="font-display text-[40px] leading-[48px] font-medium tracking-[-0.03em] text-ink tabular-nums md:text-[44px] md:leading-[52px]">
              {approved.length}
            </div>
            <p className="text-[13px] md:hidden">{approved.length === 1 ? "materia" : "materias"}</p>
          </section>

          {round && pendingReviews > 0 && (
            <Link
              href="/resenas/pendientes"
              className="col-span-2 flex min-h-11 items-center justify-between gap-3 rounded-[20px] bg-peach px-4 py-3.5 text-peach-ink md:rounded-[24px] md:px-[22px] md:py-[18px]"
            >
              <span>
                <strong className="font-bold">
                  Te {pendingReviews === 1 ? "falta 1 reseña" : `faltan ${pendingReviews} reseñas`}
                </strong>
                <span className="block text-sm md:text-[15px]">
                  del {round.termLabel}
                  <span className="hidden md:inline">, para armar tu próximo plan</span>
                </span>
              </span>
              <span className="flex-none font-bold">Reseñar</span>
            </Link>
          )}

          {nothingLoaded && (
            <Link
              href="/mapa?carga=1"
              className="col-span-2 flex min-h-11 items-center justify-between gap-3 rounded-[20px] bg-accent px-4 py-3.5 text-on-accent md:rounded-[24px] md:px-[22px] md:py-[18px]"
            >
              <strong className="font-bold">Todavía no cargaste tus materias</strong>
              <span className="flex-none font-bold">Cargar</span>
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3.5 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] lg:items-start md:gap-6">
        {courses ? (
          <HomeCalendar data={courses} action={<MoreLink href="/plan">Ver el plan</MoreLink>} />
        ) : (
          <section aria-labelledby="cursando" className={`${CARD} px-4 pt-4 pb-2 md:px-[26px] md:py-[22px]`}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 md:mb-2">
              <h2 id="cursando" className="text-base font-semibold md:text-lg">
                Cursando
              </h2>
              <MoreLink href="/plan">Ver el plan</MoreLink>
            </div>
            {inProgress.length === 0 ? (
              <p className="pb-3 text-muted md:pb-0">No tenés materias marcadas como cursando.</p>
            ) : (
              <ul>
                {inProgress.map((s) => (
                  <li key={s.id} className="flex justify-between gap-3 border-b border-line py-2.5 text-[15px] last:border-b-0 md:text-base">
                    <span>{s.name}</span>
                    <span className="flex-none text-muted tabular-nums">{s.credits} C</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-labelledby="finales" className={`${CARD} px-4 pt-4 pb-2 md:px-[26px] md:py-[22px]`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 md:mb-2">
            <h2 id="finales" className="text-base font-semibold md:text-lg">
              Finales pendientes
            </h2>
            <MoreLink href="/finales">Ver mesas</MoreLink>
          </div>
          {finals.length === 0 ? (
            <p className="pb-3 text-muted md:pb-0">No tenés finales pendientes.</p>
          ) : (
            <ul>
              {finals.map(({ subject, unlocks }) => (
                <li key={subject.id} className="flex justify-between gap-3 py-2.5 text-[15px] md:text-base">
                  <span>{subject.name}</span>
                  {unlocks > 0 && (
                    <span className="flex-none text-muted tabular-nums">
                      destraba {unlocks}
                      <span className="sr-only"> {unlocks === 1 ? "materia" : "materias"}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-my-1 flex-none py-1 text-sm text-accent underline underline-offset-[3px] hover:text-ink md:text-[15px]">
      {children}
    </Link>
  );
}
