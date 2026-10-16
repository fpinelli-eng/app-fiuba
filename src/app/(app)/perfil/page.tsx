import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { APP_NAME } from "@/lib/app";
import { getMyReviews } from "@/lib/reviews/mine";
import { countPendingReviews } from "@/lib/reviews/pending";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/session";
import { DeleteAccount } from "./DeleteAccount";
import { MyReviewRow } from "./MyReviewRow";
import { ThemeChooser } from "./ThemeChooser";

export const metadata: Metadata = { title: `Tu perfil · ${APP_NAME}` };

// Perfil y configuración (prototipo 12-perfil). Falta: subir una foto propia (necesita
// almacenamiento de archivos) y cambiar de carrera o plan (se hace al final, sin equivalencias).
export default async function PerfilPage() {
  const account = await requireProfile();
  const supabase = await createClient();
  const [plan, reviews, pending] = await Promise.all([
    supabase.from("plans").select("year, careers(short_name)").eq("id", account.planId!).single(),
    getMyReviews(),
    countPendingReviews(account.id),
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
        <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-[22px] pb-3.5">
          <div>
            <h2 className="text-[19px] font-semibold">Mis reseñas</h2>
            <div className="mt-0.5 text-sm text-muted">Se publican sin tu nombre.</div>
          </div>
          {pending > 0 && (
            <Link href="/resenas/pendientes" className="rounded-full bg-peach px-3 py-1 text-[13px] font-semibold text-peach-ink">
              {pending} {pending === 1 ? "pendiente" : "pendientes"} →
            </Link>
          )}
        </div>
        {reviews.length === 0 ? (
          <div className="border-t border-line px-6 py-4 text-sm text-muted">Todavía no escribiste reseñas.</div>
        ) : (
          reviews.map((r) => <MyReviewRow key={r.id} review={r} />)
        )}
      </section>

      {account.isAdmin && (
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[19px] font-semibold">Administración</h2>
            <div className="mt-0.5 text-sm text-muted">Oferta del cuatrimestre por plan</div>
          </div>
          <Link href="/admin" className="inline-flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent">
            Abrir
          </Link>
        </Card>
      )}

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

      <footer className="pt-2 text-center text-[13px] text-muted">
        Hecho por estudiantes. No es un sitio oficial de la universidad. ·{" "}
        <Link href="/privacidad" className="underline">
          Privacidad
        </Link>
      </footer>
    </main>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[18px] border border-line bg-surface px-6 py-[22px] ${className}`}>{children}</section>;
}
