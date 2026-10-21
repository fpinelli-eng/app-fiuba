"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME, NAV } from "@/lib/app";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/auth";

// Las secciones del menú quedan precargadas (prefetch de los links). Para que nunca venzan
// mientras se usa la web, se renuevan cada 4 minutos con la pestaña a la vista, y al volver
// a la pestaña (por si algo cambió desde otro dispositivo). Vencen a los 10 (next.config.ts).
const RENEW_MS = 4 * 60 * 1000;

function useFreshPrefetches() {
  const router = useRouter();
  useEffect(() => {
    let last = Date.now();
    const renew = () => {
      if (document.visibilityState !== "visible") return;
      last = Date.now();
      router.refresh();
    };
    const timer = setInterval(() => {
      if (Date.now() - last >= RENEW_MS) renew();
    }, 30 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 60 * 1000) renew();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);
}

export function Header({ profile, pendingReviews = 0 }: { profile: Profile; pendingReviews?: number }) {
  const pathname = usePathname();
  useFreshPrefetches();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="flex min-h-[68px] items-center justify-between gap-6 border-b border-line bg-header px-8">
      <Link href="/" className="flex items-center gap-3">
        <span className="grid size-[30px] place-items-center rounded-lg bg-lavender text-sm font-bold text-lavender-ink">
          F
        </span>
        <span className="font-bold tracking-[0.02em]">{APP_NAME}</span>
      </Link>

      <nav aria-label="Principal" className="flex gap-1.5">
        {NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              // Precarga la sección entera (con sus datos), así el clic la muestra al instante.
              // Lo que se guarda en el mapa, el plan o las reseñas refresca estas precargas.
              prefetch
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-[10px] bg-lavender px-4 py-2 font-semibold text-lavender-ink"
                  : "rounded-[10px] px-4 py-2 text-muted hover:text-ink"
              }
            >
              {item.label}
              {item.href === "/resenas" && pendingReviews > 0 && (
                <span className="ml-2 rounded-full bg-peach px-2 py-px text-xs font-semibold text-peach-ink" aria-label={`${pendingReviews} pendientes`}>
                  {pendingReviews}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5">
        <ThemeToggle />
        <Link href="/perfil" aria-label="Mi perfil" className="rounded-full">
          <Avatar profile={profile} size={40} />
        </Link>
      </div>
    </header>
  );
}
