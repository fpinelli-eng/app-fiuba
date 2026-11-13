import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME } from "@/lib/app";
import { formatHour } from "@/lib/plan/format";
import {
  getAdminOverview,
  getOfferSubjects,
  getPlanSubjectOptions,
  getPlanImport,
  getPendingSubmissions,
  getPublishedOffer,
  termLabel,
  type ImportStatus,
  type OfferSubject,
  type PendingSubmission,
  type PlanRow,
  type PublishedCourse,
} from "@/lib/admin/data";
import { decisionFor, type ImportPreview } from "@/lib/admin/offer-import";
import { shortDate } from "@/lib/offer/submission";
import {
  AddSubjectForm,
  ChangeChoice,
  DiscardButton,
  LinkSubjectForm,
  ProcessForm,
  PublishButton,
  RemoveOfferSubjectButton,
  ReplacePanel,
  ReviewsDateForm,
  SubmissionActions,
  TermForm,
  VisibilityButton,
} from "./forms";

export const metadata: Metadata = { title: `Administración · ${APP_NAME}` };

const STATUS_LABEL: Record<ImportStatus, string> = {
  empty: "Sin cargar",
  processed: "Procesado",
  published: "Publicado",
};

const STATUS_DOT: Record<ImportStatus, string> = {
  empty: "border-[1.5px] border-line-strong",
  processed: "bg-butter-ink",
  published: "bg-mint-ink",
};

const DAY = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const FORMAT_LABEL = { detail: "SIU con docentes", "public-table": "tabla pública del SIU" } as const;

const planName = (p: PlanRow) => `${p.career} · Plan ${p.year}`;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan: planParam } = await searchParams;
  const [{ term, plans }, submissions] = await Promise.all([getAdminOverview(), getPendingSubmissions()]);
  const now = new Date();

  if (!term) {
    return (
      <Shell>
        <h1 className="text-[30px] font-semibold">Oferta del cuatrimestre</h1>
        <section className="flex max-w-[640px] flex-col gap-3 rounded-[18px] border border-line bg-surface px-6 py-[22px]">
          <h2 className="text-[19px] font-semibold">¿Qué cuatrimestre vas a cargar?</h2>
          <TermForm year={now.getFullYear()} half={now.getMonth() < 6 ? 1 : 2} cta="Empezar" />
        </section>
      </Shell>
    );
  }

  const selected = plans.find((p) => p.id === planParam) ?? plans.find((p) => p.status === "processed") ?? plans[0];
  const published = plans.filter((p) => p.status === "published").length;
  const planImport = selected && selected.status !== "empty" ? await getPlanImport(term.id, selected.id) : null;
  const offerSubjects = selected && planImport ? await getOfferSubjects(selected.id) : null;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold">Oferta del {termLabel(term)}</h1>
          <div className="text-muted">
            {published} de {plans.length} planes publicados
          </div>
        </div>
        <ReviewsDateForm date={term.reviewsOpenOn} />
      </div>

      {submissions.length > 0 && <Submissions submissions={submissions} plans={plans} />}

      <div className="grid grid-cols-1 items-start gap-[18px] md:grid-cols-[300px_minmax(0,1fr)]">
        <aside aria-label="Planes" className="flex flex-col gap-0.5 rounded-[18px] border border-line bg-surface p-2.5">
          {plans.map((p) => {
            const on = p.id === selected?.id;
            return (
              <Link
                key={p.id}
                href={`/admin?plan=${p.id}`}
                aria-current={on ? "page" : undefined}
                className={`flex items-center justify-between gap-2 rounded-[10px] px-3 py-[9px] text-sm ${
                  on ? "bg-lavender font-semibold text-lavender-ink" : "hover:bg-bg"
                }`}
              >
                <span className="min-w-0">
                  {p.career} <span className={on ? "font-normal" : "text-muted"}>{p.year}</span>
                </span>
                <span title={STATUS_LABEL[p.status]} className={`size-2.5 flex-none rounded-full ${STATUS_DOT[p.status]}`}>
                  <span className="sr-only">{STATUS_LABEL[p.status]}</span>
                </span>
              </Link>
            );
          })}
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          {selected && !planImport && <ProcessForm key={selected.id} planId={selected.id} title={planName(selected)} />}
          {selected && planImport?.status === "processed" && (
            <Processed
              planId={selected.id}
              title={planName(selected)}
              preview={planImport.preview}
              options={pairableSubjects(await getPlanSubjectOptions(selected.id), planImport.preview)}
              credits={offerSubjects?.defaultCredits ?? 4}
              added={offerSubjects?.added ?? []}
            />
          )}
          {selected && planImport?.status === "published" && (
            <Published termId={term.id} plan={selected} preview={planImport.preview} credits={offerSubjects?.defaultCredits ?? 4} added={offerSubjects?.added ?? []} />
          )}
          <details className="rounded-[18px] border border-line bg-surface px-6 py-4 text-sm">
            <summary className="cursor-pointer font-semibold">Cambiar el cuatrimestre actual</summary>
            <div className="mt-3">
              <TermForm year={term.year} half={term.half} cta="Cambiar" />
            </div>
          </details>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-[18px] px-4 pt-6 pb-10 md:px-6 md:pt-8 md:pb-14">{children}</main>;
}

/** Offers sent by students from the Plan screen: the admin publishes them with the same import, or rejects them. */
function Submissions({ submissions, plans }: { submissions: PendingSubmission[]; plans: PlanRow[] }) {
  const byId = new Map(plans.map((p) => [p.id, p]));
  return (
    <Card
      flush
      title={
        <>
          <h2 className="text-[19px] font-semibold">Ofertas enviadas por alumnos</h2>
          <p className="text-sm text-muted">
            «Procesar y publicar» las procesa y publica como si las pegaras vos. Si ya tiene oferta, no se puede: usá «Reemplazar con otro texto».
          </p>
        </>
      }
    >
      {submissions.map((s) => {
        const plan = byId.get(s.planId);
        return (
          <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-3.5">
            <div className="min-w-0">
              <div className="font-semibold">
                {plan ? <Link href={`/admin?plan=${plan.id}`}>{planName(plan)}</Link> : s.planId}
                {plan?.status === "published" && <span className="ml-2 text-[13px] font-normal text-muted">Ya publicada</span>}
              </div>
              <div className="text-[13px] text-muted">
                {s.subjects} materias · {s.courses} cursos · {s.blocks} horarios · {s.sentBy || "Cuenta borrada"}, {shortDate(s.createdAt)}
              </div>
            </div>
            <SubmissionActions submissionId={s.id} />
          </div>
        );
      })}
    </Card>
  );
}

function Card({ title, children, flush = false }: { title?: ReactNode; children: ReactNode; flush?: boolean }) {
  return (
    <section className={`overflow-hidden rounded-[18px] border border-line bg-surface ${flush ? "" : "px-6 py-[22px]"}`}>
      {title && <div className={flush ? "px-6 pt-[22px] pb-3" : "mb-3"}>{title}</div>}
      {children}
    </section>
  );
}

function Stats({ preview }: { preview: ImportPreview }) {
  const items = [
    [preview.stats.subjects, "materias del plan"],
    [preview.stats.courses, "cursos"],
    [preview.stats.blocks, "horarios"],
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {items.map(([value, label]) => (
        <div key={label} className="rounded-xl bg-bg px-4 py-3.5">
          <div className="text-[28px] leading-tight font-semibold">{value}</div>
          <div className="text-[13px] text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}

/** Subjects already paired with a SIU subject of this text are not offered again. */
const pairableSubjects = (all: { id: number; name: string }[], preview: ImportPreview) => {
  const taken = new Set(preview.matched.map((m) => m.subjectId));
  return all.filter((s) => !taken.has(s.id));
};

function Processed({
  planId,
  title,
  preview,
  options,
  credits,
  added,
}: {
  planId: string;
  title: string;
  preview: ImportPreview;
  options: { id: number; name: string }[];
  credits: number;
  added: OfferSubject[];
}) {
  return (
    <>
      <Card>
        <div className="mb-3.5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold">{title}</h2>
            {preview.format && <div className="text-[13px] text-muted">Texto de la {FORMAT_LABEL[preview.format]}</div>}
          </div>
          <DiscardButton planId={planId} />
        </div>
        <Stats preview={preview} />
        {preview.replacing && (
          <p className="mt-3 rounded-[10px] bg-sky px-3 py-2 text-[13px] text-sky-ink">
            Es un reemplazo de la oferta publicada: los alumnos siguen viendo la anterior hasta que publiques. Los cursos que siguen se
            actualizan (sin perder planes, cursadas ni reseñas), los nuevos se agregan y los que ya no están se quitan.
          </p>
        )}
        {preview.format === "public-table" && (
          <p className="mt-3 rounded-[10px] bg-butter px-3 py-2 text-[13px] text-butter-ink">
            La tabla pública no trae docentes (solo el titular), ni promoción o regularidad, ni las prácticas por separado.
          </p>
        )}
        {preview.warnings.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-[13px] text-muted">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </Card>

      {preview.changes && preview.changes.length > 0 && (
        <Card
          flush
          title={
            <>
              <h2 className="text-[19px] font-semibold">Cursos con cambios</h2>
              <p className="text-sm text-muted">
                Elegí qué hacer con cada uno. Ya viene marcada la opción sugerida: si es el mismo curso, conserva sus reseñas.
              </p>
            </>
          }
        >
          {preview.changes.map((c) => (
            <ChangeChoice key={c.key} planId={planId} change={c} chosen={decisionFor(preview, c.key)} />
          ))}
        </Card>
      )}

      <OutOfPlan planId={planId} preview={preview} options={options} credits={credits} />
      {added.length > 0 && <AddedSubjects planId={planId} subjects={added} />}

      <div className="flex justify-end">
        <PublishButton planId={planId} label={preview.replacing ? "Publicar cambios" : "Publicar"} />
      </div>
    </>
  );
}

/**
 * SIU subjects of the offer that the plan does not have. Each one can be paired with a plan
 * subject that has another name (only before publishing: `options`) or added to the plan as an
 * elective (usually a new one); either way it is remembered for the next terms.
 */
function OutOfPlan({
  planId,
  preview,
  options,
  credits,
}: {
  planId: string;
  preview: ImportPreview;
  options?: { id: number; name: string }[];
  credits: number;
}) {
  if (preview.unmatched.length === 0) return null;
  return (
    <Card
      flush
      title={
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[19px] font-semibold">Materias que no están en el plan</h2>
            <p className="text-sm text-muted">
              {options
                ? "Si alguna es de este plan con otro nombre, elegí cuál es. Si es una electiva nueva, agregala al plan: sus cursos aparecen en el Plan del cuatrimestre y la materia, en el mapa. Queda guardado para los próximos cuatrimestres."
                : "Si alguna es una electiva nueva de este plan, agregala: sus cursos se suman a la oferta publicada y la materia aparece en el mapa. Queda guardado para los próximos cuatrimestres."}
            </p>
          </div>
          {preview.unmatched.length > 1 && <AddSubjectForm planId={planId} credits={credits} />}
        </div>
      }
    >
      {preview.unmatched.map((u) => (
        <div key={u.siuCode} className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-3.5">
          <div className="min-w-0">
            <div className="font-semibold">{u.siuName}</div>
            <div className="text-[13px] text-muted">
              {u.siuCode} · {u.courses} {u.courses === 1 ? "curso" : "cursos"}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {options && <LinkSubjectForm planId={planId} siuCode={u.siuCode} siuName={u.siuName} options={options} />}
            <AddSubjectForm planId={planId} siuCode={u.siuCode} siuName={u.siuName} credits={credits} />
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Electives an admin added from the offer: they can be taken out while no student marked them. */
function AddedSubjects({ planId, subjects }: { planId: string; subjects: OfferSubject[] }) {
  return (
    <Card
      flush
      title={
        <>
          <h2 className="text-[19px] font-semibold">Electivas agregadas desde la oferta</h2>
          <p className="text-sm text-muted">No están en el plan oficial. Se pueden quitar mientras ningún alumno las haya marcado en su mapa.</p>
        </>
      }
    >
      {subjects.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-3.5">
          <div className="min-w-0">
            <div className="font-semibold">{s.name}</div>
            <div className="text-[13px] text-muted">
              {s.siuCodes.join(", ")} · {s.credits} créditos
            </div>
          </div>
          <RemoveOfferSubjectButton planId={planId} subjectId={s.id} name={s.name} />
        </div>
      ))}
    </Card>
  );
}

const describeBlocks = (c: PublishedCourse) => {
  const inPerson = c.blocks.filter((b) => !b.isAsync);
  if (!inPerson.length) return "Sin horario en el SIU";
  return inPerson.map((b) => `${DAY[b.weekday]} ${formatHour(b.startsAt)}–${formatHour(b.endsAt)}${b.campus ? ` · ${b.campus}` : ""}`).join(" / ");
};

async function Published({
  termId,
  plan,
  preview,
  credits,
  added,
}: {
  termId: string;
  plan: PlanRow;
  preview: ImportPreview;
  credits: number;
  added: OfferSubject[];
}) {
  const subjects = await getPublishedOffer(termId, plan.id);
  const courses = subjects.reduce((n, s) => n + s.courses.length, 0);
  const hidden = subjects.reduce((n, s) => n + s.courses.filter((c) => !c.visible).length, 0);
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[19px] font-semibold">{planName(plan)}</h2>
              <span className="rounded-full bg-mint px-2.5 py-0.5 text-[12.5px] font-semibold text-mint-ink">Publicada</span>
            </div>
            <div className="text-sm text-muted">
              {subjects.length} materias · {courses} cursos{hidden ? ` (${hidden} quitados)` : ""}
              {preview.format ? ` · desde la ${FORMAT_LABEL[preview.format]}` : ""}
            </div>
          </div>
          <ReplacePanel key={plan.id} planId={plan.id} title={planName(plan)} />
        </div>
      </Card>
      <OutOfPlan planId={plan.id} preview={preview} credits={credits} />
      {added.length > 0 && <AddedSubjects planId={plan.id} subjects={added} />}
      <Card flush>
        {subjects.map((s) => (
          <div key={s.siuCode}>
            <div className="flex items-baseline justify-between gap-3 bg-lavender px-6 py-3 text-lavender-ink">
              <span className="font-semibold">{s.name}</span>
              <span className="text-[13px]">
                {s.siuCode} · {s.courses.length} {s.courses.length === 1 ? "curso" : "cursos"}
              </span>
            </div>
            {s.courses.map((c) => (
              <div
                key={c.id}
                className={`flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t md:grid md:grid-cols-[160px_minmax(0,1fr)_minmax(0,300px)_130px] md:gap-3.5 border-line px-6 py-2.5 ${
                  c.visible ? "" : "opacity-50"
                }`}
              >
                <span className="text-sm font-semibold">{c.label}</span>
                <span className="min-w-0 text-sm text-ink-2">{c.teachers.join(", ")}</span>
                <span className="text-[13px] text-muted">{describeBlocks(c)}</span>
                <VisibilityButton offeringId={c.id} visible={c.visible} />
              </div>
            ))}
          </div>
        ))}
      </Card>
    </>
  );
}
