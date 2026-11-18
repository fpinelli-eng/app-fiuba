import type { Announcement } from "@/lib/broadcast/model";

// "Avisos publicados": el que se ve ahora, los que terminaron y "Quitar". Sin "use client": lo usan
// la página de Administración (onDelete es una acción del servidor) y la vista previa pública.

const secondary = "h-9 whitespace-nowrap rounded-[10px] border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-danger";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "numeric" });

export function AnnouncementList({
  announcements,
  careers,
  onDelete,
}: {
  /** null: la migración todavía no está en la base. */
  announcements: (Announcement & { active: boolean })[] | null;
  careers: { id: string; name: string }[];
  onDelete: (id: number) => Promise<void>;
}) {
  const careerName = new Map(careers.map((c) => [c.id, c.name]));
  return (
    <section aria-labelledby="avisos-list-title" className="overflow-hidden rounded-[18px] border border-line bg-surface">
      <h2 id="avisos-list-title" className="px-4 pt-[18px] pb-2 text-[19px] font-semibold md:px-6">
        Avisos publicados
      </h2>
      {announcements === null ? (
        <p className="px-4 pb-5 text-sm text-muted md:px-6">La base todavía no tiene la tabla de avisos: se crea al integrar la rama.</p>
      ) : announcements.length === 0 ? (
        <p className="px-4 pb-5 text-sm text-muted md:px-6">Todavía no hay avisos.</p>
      ) : (
        <ul className="flex flex-col pb-2">
          {announcements.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-t border-line px-4 py-3.5 first:border-t-0 md:flex-nowrap md:px-6">
              <div className="min-w-0 flex-auto basis-60">
                <div className="font-semibold">
                  <span
                    className={`mr-2 inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${a.active ? "bg-mint text-mint-ink" : "bg-bg text-muted"}`}
                  >
                    {a.active ? "Se ve" : "Terminó"}
                  </span>
                  {a.title}
                </div>
                <div className="text-[13px] text-muted">
                  {a.careerId ? (careerName.get(a.careerId) ?? a.careerId) : "Todas las carreras"}
                  {" · "}
                  {a.endsAt ? `${a.active ? "hasta" : "terminó"} el ${day(a.endsAt)}` : "sin fecha de fin"}
                  {a.url && <> · {a.url}</>}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-ink-2">{a.body}</p>
              </div>
              <form action={onDelete.bind(null, a.id)} className="flex-none">
                <button type="submit" aria-label={`Quitar el aviso ${a.title}`} className={secondary}>
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
