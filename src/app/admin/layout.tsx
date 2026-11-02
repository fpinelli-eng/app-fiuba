import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { APP_NAME } from "@/lib/app";
import { requireAdmin } from "@/lib/admin/data";
import { AdminNav } from "./AdminNav";

// Administración (prototipo 13-administracion): barra propia, solo para administradores.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <>
      {/* Administración se usa en la computadora; en el celular solo se acomoda para no desbordar. */}
      <header className="flex min-h-[68px] flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line bg-header px-4 py-3 md:flex-nowrap md:gap-6 md:px-8 md:py-0">
        <div className="flex items-center gap-3">
          <span className="grid size-[30px] place-items-center rounded-lg bg-lavender text-sm font-bold text-lavender-ink">
            F
          </span>
          <span className="font-bold tracking-[0.02em]">{APP_NAME}</span>
          <span className="rounded-full bg-ink px-2.5 py-[3px] text-xs font-semibold text-bg">Administración</span>
        </div>
        <AdminNav />
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/" className="text-sm text-muted hover:text-ink">
            Volver a la app
          </Link>
        </div>
      </header>
      {children}
    </>
  );
}
