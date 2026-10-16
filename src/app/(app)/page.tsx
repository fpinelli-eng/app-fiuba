import Link from "next/link";
import type { ReactNode } from "react";
import { StateIcon } from "./mapa/icons";
import { getMapData } from "@/lib/map/data";
import { getReviewRound } from "@/lib/reviews/pending";
import { CareerMap, formatAverage, totalCredits, type Progress } from "@/lib/map/model";
import { requireProfile } from "@/lib/session";

// Inicio (prototipos 04-inicio y 05-inicio-oscuro): avance, promedio, materias, cursada y finales pendientes.
// El calendario de la cursada llega con la oferta y el plan guardado.

export default async function InicioPage() {
  const account = await requireProfile();
  const [data, round] = await Promise.all([getMapData(account.id, account.planId!), getReviewRound(account.id, null)]);
  const pendingReviews = round ? round.tasks.filter((t) => t.sentStars === null).length : 0;
  const map = new CareerMap(data.subjects, data.requirements);
  const progress: Progress = {
    subjects: new Map(data.progress.subjects.map((s) => [s.subjectId, { status: s.status, grade: s.grade }])),
    requirements: new Set(data.progress.requirements),
  };

  const total = totalCredits(data.creditRules) ?? map.subjects.reduce((a, s) => a + s.credits, 0);
  const credits = map.approvedCredits(progress);
  const pct = total ? Math.min(100, Math.round((credits / total) * 100)) : 0;
  const cat = map.creditsByCategory(progress, data.creditRules);
  const average = map.average(progress);

  const withStatus = (status: string) => map.subjects.filter((s) => progress.subjects.get(s.id)?.status === status);
  const approved = withStatus("approved");
  const graded = approved.filter((s) => progress.subjects.get(s.id)?.grade !== null).length;
  const approvedBy = (kinds: string[]) => approved.filter((s) => kinds.includes(s.kind)).length;
  const inProgress = withStatus("in_progress");
  const finals = withStatus("final_pending");
  const english = data.requirements[0] ?? null;
  const nothingLoaded = progress.subjects.size === 0 && progress.requirements.size === 0;

  const approvedDetail = (
    [
      [approvedBy(["required", "final_project", "final_option"]), "obligatoria", "obligatorias"],
      [approvedBy(["elective", "orientation"]), "electiva", "electivas"],
      [approvedBy(["cbc_subject"]), "del CBC", "del CBC"],
    ] as [number, string, string][]
  )
    .filter(([n]) => n)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
    .join(" · ");

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-col gap-[22px] px-10 pt-9 pb-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Label>
            {data.careerName} · Plan {data.year}
          </Label>
          <h1 className="mt-1.5 text-4xl font-semibold tracking-[-0.01em]">Hola, {account.firstName}</h1>
        </div>
        {data.lastChange && (
          <div className="text-[13px] text-muted">
            Último cambio: {shortDate(data.lastChange)}
          </div>
        )}
      </div>

      {round && pendingReviews > 0 && (
        <section aria-label="Reseñas pendientes" className="flex flex-wrap items-center gap-5 rounded-[14px] bg-peach px-5 py-4 text-peach-ink">
          <div className="text-[30px] leading-none font-semibold">{pendingReviews}</div>
          <div className="flex-[1_1_360px]">
            <div className="font-semibold">Reseñas pendientes de la cursada {round.termLabel}</div>
            <div>Completalas para desbloquear el plan del {round.nextTermLabel}. Solo estrellas: menos de un minuto.</div>
          </div>
          <Link href="/resenas/pendientes" className="rounded-[10px] bg-accent px-5 py-3 font-semibold text-on-accent">
            Reseñar ahora
          </Link>
        </section>
      )}

      {nothingLoaded && (
        <section className="flex flex-wrap items-center gap-5 rounded-[14px] bg-lavender px-5 py-4 text-lavender-ink">
          <div className="flex-[1_1_360px] font-semibold">Todavía no cargaste tus materias</div>
          <Link href="/mapa?carga=1" className="rounded-[10px] bg-accent px-5 py-3 font-semibold text-on-accent">
            Cargar materias
          </Link>
        </section>
      )}

      <div className="flex flex-wrap gap-[22px]">
        <section aria-label="Avance de carrera" className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 rounded-2xl border border-line bg-surface p-7">
          <Label>AVANCE DE CARRERA</Label>
          <div className="flex flex-wrap items-baseline gap-5">
            <div className="text-[104px] leading-[0.9] font-semibold tracking-[-0.04em]">
              {pct}
              <span className="text-5xl text-muted">%</span>
            </div>
            <div className="text-muted">
              {credits} de {total} créditos
              <br />
              faltan {Math.max(0, total - credits)}
            </div>
          </div>
          <div className="flex h-3 overflow-hidden rounded-xl bg-disabled" aria-hidden="true">
            <div className="bg-progress-cbc" style={{ width: `${total ? (cat.cbc.done / total) * 100 : 0}%` }} />
            <div className="bg-accent" style={{ width: `${total ? ((credits - cat.cbc.done) / total) * 100 : 0}%` }} />
          </div>
          <div className="grid grid-cols-4 gap-4 border-t border-disabled pt-[18px]">
            <Category dot="bg-progress-cbc" name="CBC" done={cat.cbc.done} total={cat.cbc.total} />
            <Category dot="bg-accent" name="Obligatorias" done={cat.required.done} total={cat.required.total} />
            <Category name="Electivas" done={cat.electives.done} total={cat.electives.total} />
            <Category name="Trabajo final" done={cat.final.done} total={cat.final.total} />
          </div>
        </section>

        <div className="flex flex-[1_1_300px] flex-col gap-[22px]">
          <section aria-label="Promedio" className="flex flex-col gap-2 rounded-2xl bg-lavender p-7 text-lavender-ink">
            <div className="text-xs font-semibold tracking-[0.08em] opacity-80">PROMEDIO</div>
            <div className="text-[64px] leading-none font-semibold">{formatAverage(average)}</div>
            <div className="opacity-80">
              {graded ? `Sin aplazos · ${graded} ${graded === 1 ? "materia" : "materias"} con nota (incluye CBC)` : "Sin notas todavía"}
            </div>
          </section>
          <section aria-label="Materias" className="flex flex-auto flex-col justify-center gap-4 rounded-2xl border border-line bg-surface px-7 py-6">
            <Label>MATERIAS</Label>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[17px] font-medium">Materias aprobadas</div>
                {approvedDetail && <div className="text-[13px] text-muted">{approvedDetail}</div>}
              </div>
              <span className="text-4xl leading-none font-semibold">{approved.length}</span>
            </div>
            {english && (
              <>
                <div className="border-t border-disabled" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[17px] font-medium">{english.name.replace("Prueba de nivel de idioma inglés", "Prueba de inglés")}</span>
                  {progress.requirements.has(english.id) ? (
                    <span className="rounded-full bg-mint px-3 py-1 text-sm font-semibold text-mint-ink">Aprobada</span>
                  ) : (
                    <span className="rounded-full bg-peach px-3 py-1 text-sm font-semibold text-peach-ink">Pendiente</span>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-[22px]">
        <section aria-label="Cursando" className="flex min-w-0 flex-[999_1_560px] flex-col gap-4 rounded-2xl border border-line bg-surface p-7">
          <Label>
            CURSANDO{inProgress.length > 0 && ` · ${inProgress.reduce((a, s) => a + s.credits, 0)} CRÉDITOS`}
          </Label>
          {inProgress.length === 0 ? (
            <div className="text-muted">No tenés materias marcadas como cursando.</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
              {inProgress.map((s) => (
                <div key={s.id} className="flex items-start gap-3 rounded-xl border border-sky-line bg-sky px-4 py-3.5 text-sky-ink">
                  <StateIcon state="in_progress" size={18} />
                  <div className="flex-auto font-semibold">{s.name}</div>
                  <span className="text-xs font-medium whitespace-nowrap opacity-80">{s.credits} C</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-label="Finales pendientes" className="flex flex-[1_1_300px] flex-col gap-3 self-start rounded-2xl border border-line bg-surface p-7">
          <div className="flex items-baseline justify-between gap-2">
            <Label>FINALES PENDIENTES</Label>
            {finals.length > 0 && (
              <span className="text-[13px] whitespace-nowrap text-muted">
                {finals.length} · {finals.reduce((a, s) => a + s.credits, 0)} C en juego
              </span>
            )}
          </div>
          {finals.length === 0 && <div className="text-muted">No tenés finales pendientes.</div>}
          {finals.map((s) => (
            <Link
              key={s.id}
              href="/mapa"
              className="flex items-start gap-3 rounded-xl border border-butter-line bg-butter px-4 py-3.5 text-butter-ink"
            >
              <StateIcon state="final_pending" size={20} />
              <div className="flex-auto">
                <div className="text-[15px] font-semibold">{s.name}</div>
                <div className="text-[13px]">{map.unlockSummary(progress, s.id)}</div>
              </div>
              <span className="text-xs font-medium whitespace-nowrap opacity-80">{s.credits} C</span>
            </Link>
          ))}
          <Link href="/mapa" className="mt-1 font-semibold text-accent">
            Ver en el mapa →
          </Link>
        </section>
      </div>
    </main>
  );
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2 dic 2026", en hora de Buenos Aires. */
function shortDate(iso: string): string {
  const [y, m, d] = new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function Label({ children }: { children: ReactNode }) {
  return <div className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{children}</div>;
}

function Category({ dot, name, done, total }: { dot?: string; name: string; done: number; total: number | null }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[13px] text-muted">
        {dot && <span className={`size-2 rounded-full ${dot}`} />}
        {name}
      </div>
      <div className="text-xl font-semibold">
        {done}
        {total !== null && <span className="font-normal text-muted">/{total}</span>}
      </div>
    </div>
  );
}
