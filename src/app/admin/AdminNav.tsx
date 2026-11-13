"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Oferta del cuatrimestre" },
  { href: "/admin/examenes", label: "Fechas de examen" },
  { href: "/admin/resenas", label: "Reseñas" },
  { href: "/admin/novedades", label: "Novedades" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/estado", label: "Estado" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 whitespace-nowrap md:order-none md:mx-0 md:w-auto md:overflow-visible md:px-0 md:whitespace-normal">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-[10px] bg-lavender px-4 py-2 font-semibold text-lavender-ink"
                : "rounded-[10px] px-4 py-2 text-muted hover:text-ink"
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
