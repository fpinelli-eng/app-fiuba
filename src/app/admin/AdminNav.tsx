"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Oferta del cuatrimestre" },
  { href: "/admin/resenas", label: "Reseñas" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="flex gap-1.5">
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
