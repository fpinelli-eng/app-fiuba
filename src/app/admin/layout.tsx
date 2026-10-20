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
      <header className="flex min-h-[68px] items-center justify-between gap-6 border-b border-line bg-header px-8">
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
