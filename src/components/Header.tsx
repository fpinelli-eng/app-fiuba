"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME, NAV } from "@/lib/app";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import { NavIcon } from "@/components/icons";
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

// Barra superior. En la computadora tiene todo el menú; en el celular queda compacta (logo,
// Novedades como ícono y avatar) y las secciones principales pasan a la barra de pestañas de abajo.
export function Header({ profile, pendingReviews = 0 }: { profile: Profile; pendingReviews?: number }) {
  const pathname = usePathname();
  useFreshPrefetches();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const badge = (href: string) => (href === "/resenas" ? pendingReviews : 0);

  return (
    <>
      <header className="flex min-h-[56px] items-center justify-between gap-3 border-b border-line bg-header px-4 md:min-h-[68px] md:gap-6 md:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid size-[30px] place-items-center rounded-lg bg-lavender text-sm font-bold text-lavender-ink">
            F
          </span>
          <span className="font-bold tracking-[0.02em]">{APP_NAME}</span>
        </Link>

        <nav aria-label="Principal" className="hidden gap-1.5 md:flex">
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
                {badge(item.href) > 0 && (
                  <span className="ml-2 rounded-full bg-peach px-2 py-px text-xs font-semibold text-peach-ink" aria-label={`${pendingReviews} pendientes`}>
                    {pendingReviews}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2.5">
          {/* Celular: Novedades como ícono. El tema se cambia desde Perfil → Apariencia. */}
          {NAV.filter((item) => item.mobile === "top").map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`grid size-10 place-items-center rounded-full md:hidden ${
                  active ? "bg-lavender text-lavender-ink" : "border border-line bg-surface text-muted"
                }`}
              >
                <NavIcon name={item.icon} size={20} />
              </Link>
            );
          })}
          <div className="hidden md:contents">
            <ThemeToggle />
          </div>
          <Link href="/perfil" aria-label="Mi perfil" className="rounded-full">
            <Avatar profile={profile} size={40} />
          </Link>
        </div>
      </header>

      {/* Celular: pestañas fijas abajo, como en una app. El layout deja ese lugar libre al final de la página. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-header pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="mx-auto grid h-[60px] max-w-[520px] grid-cols-5">
          {NAV.filter((item) => item.mobile === "tab").map((item) => {
            const active = isActive(item.href);
            const count = badge(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] leading-tight ${
                  active ? "font-semibold text-ink" : "text-muted"
                }`}
              >
                <span className={`relative grid h-7 w-12 place-items-center rounded-full ${active ? "bg-lavender text-lavender-ink" : ""}`}>
                  <NavIcon name={item.icon} />
                  {count > 0 && (
                    <span
                      className="absolute -top-1 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-peach px-1 text-[11px] font-semibold text-peach-ink"
                      aria-label={`${count} pendientes`}
                    >
                      {count}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
