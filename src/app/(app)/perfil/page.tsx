import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/Avatar";
import { APP_NAME } from "@/lib/app";
import { getCareers } from "@/lib/careers";
import { getMyReviews } from "@/lib/reviews/mine";
import { countPendingReviews } from "@/lib/reviews/pending";
import { requireProfile } from "@/lib/session";
import { CareerChange } from "./CareerChange";
import { DeleteAccount } from "./DeleteAccount";
import { MyReviewRow } from "./MyReviewRow";
import { ThemeChooser } from "./ThemeChooser";

export const metadata: Metadata = { title: `Tu perfil · ${APP_NAME}` };

// Perfil y configuración (prototipo 12-perfil). Falta: subir una foto propia (necesita
// almacenamiento de archivos).
export default async function PerfilPage() {
  const account = await requireProfile();
  const [careers, reviews, pending] = await Promise.all([getCareers(), getMyReviews(), countPendingReviews(account.id)]);

  return (
    <main className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-4 pt-5 pb-8 md:px-6 md:pt-9 md:pb-12">
      <section className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-1 pb-2 md:flex-nowrap md:gap-[18px]">
        <Avatar profile={account} size={84} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] leading-tight font-semibold md:text-[30px]">{account.fullName}</h1>
          <div className="break-all text-muted md:break-normal">{account.email}</div>
        </div>
        <form action="/auth/salir" method="post" className="w-full md:w-auto">
          <button type="submit" className="h-10 w-full rounded-[10px] border border-line-strong bg-surface px-4 text-sm font-semibold md:w-auto">
            Cerrar sesión
          </button>
        </form>
      </section>

      <CareerChange careers={careers} planId={account.planId!} />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[19px] font-semibold">Apariencia</h2>
        <ThemeChooser />
      </Card>

      <section aria-label="Mis reseñas" className="overflow-hidden rounded-[18px] border border-line bg-surface">
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-[18px] pb-3.5 md:px-6 md:pt-[22px]">
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
          <div className="border-t border-line px-4 py-4 text-sm text-muted md:px-6">Todavía no escribiste reseñas.</div>
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
        <Link href="/privacidad" className="inline-block py-2 underline md:inline md:py-0">
          Privacidad
        </Link>
      </footer>
    </main>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[18px] border border-line bg-surface px-4 py-[18px] md:px-6 md:py-[22px] ${className}`}>{children}</section>;
}
