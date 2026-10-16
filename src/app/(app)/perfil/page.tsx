import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { APP_NAME } from "@/lib/app";
import { getMyReviews } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { DeleteAccount } from "./DeleteAccount";
import { ThemeChooser } from "./ThemeChooser";

export const metadata: Metadata = { title: `Tu perfil · ${APP_NAME}` };

// Perfil y configuración (prototipo 12-perfil). Falta: subir una foto propia (necesita
// almacenamiento de archivos) y cambiar de carrera o plan (depende de las equivalencias).
export default async function PerfilPage() {
  const account = await requireProfile();
  const supabase = await createClient();
  const [plan, reviews] = await Promise.all([
    supabase.from("plans").select("year, careers(short_name)").eq("id", account.planId!).single(),
    getMyReviews(),
  ]);
  const career = plan.data?.careers as unknown as { short_name: string } | { short_name: string }[] | null;
  const careerName = (Array.isArray(career) ? career[0]?.short_name : career?.short_name) ?? "";

  return (
    <main className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-6 pt-9 pb-12">
      <section className="flex items-center gap-[18px] pt-1 pb-2">
        <Avatar profile={account} size={84} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[30px] leading-tight font-semibold">{account.fullName}</h1>
          <div className="text-muted">{account.email}</div>
        </div>
        <form action="/auth/salir" method="post">
          <button type="submit" className="h-10 rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold">
            Cerrar sesión
          </button>
        </form>
      </section>

      <Card>
        <h2 className="text-[19px] font-semibold">Carrera</h2>
        <div className="mt-0.5 text-muted">
          {careerName} · Plan {plan.data?.year}
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[19px] font-semibold">Apariencia</h2>
        <ThemeChooser />
      </Card>

      <section aria-label="Mis reseñas" className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="px-6 pt-[22px] pb-3.5">
          <h2 className="text-[19px] font-semibold">Mis reseñas</h2>
          <div className="mt-0.5 text-sm text-muted">Se publican sin tu nombre.</div>
        </div>
        {reviews.length === 0 ? (
          <div className="border-t border-line px-6 py-4 text-sm text-muted">Todavía no escribiste reseñas.</div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 border-t border-line px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{r.subjectName}</div>
                  <div className="text-[13px] text-muted">
                    {r.detail}
                    {r.hidden && " · Oculta por moderación"}
                  </div>
                </div>
                <Stars value={r.stars} />
              </div>
              {r.comment && <div className="text-sm text-ink-2">{r.comment}</div>}
            </div>
          ))
        )}
      </section>

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[19px] font-semibold">Tus datos</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="/perfil/datos"
            className="inline-flex h-10 items-center rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold whitespace-nowrap"
          >
            Descargar mis datos
          </a>
          <DeleteAccount />
        </div>
      </Card>

      <footer className="pt-2 text-center text-[13px] text-muted">Hecho por estudiantes. No es un sitio oficial de la universidad.</footer>
    </main>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[18px] border border-line bg-surface px-6 py-[22px] ${className}`}>{children}</section>;
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} de 5`} className="flex flex-none gap-px">
      {[1, 2, 3, 4, 5].map((k) => (
        <svg
          key={k}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          strokeWidth="1.8"
          strokeLinejoin="round"
          aria-hidden="true"
          className={k <= value ? "fill-star stroke-star" : "fill-none stroke-line-strong"}
        >
          <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}
