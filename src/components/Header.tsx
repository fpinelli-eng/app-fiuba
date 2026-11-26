"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { NAV } from "@/lib/app";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import { NavIcon } from "@/components/icons";
import type { Profile } from "@/lib/auth";

// Las secciones del menú NO se precargan al abrir la página: cada precarga es una función de Vercel
// que arma la sección entera, y con todas las secciones precargadas en cada visita (y otra vez después
// de cada cambio guardado) el plan gratis se quedaba sin horas de CPU (noviembre de 2026: 3 h 52 min de
// 4 h en 30 días). Ahora se precarga solo la sección que el alumno está por tocar: al pasar el mouse,
// al apoyar el dedo o al llegar con el teclado (`intent` abajo), y mientras tanto se ve el esqueleto
// de loading.tsx. Al volver a la pestaña después de un rato se refresca la sección abierta, por si
// algo cambió desde otro dispositivo.
const RENEW_AFTER_AWAY_MS = 10 * 60 * 1000;

function useFreshPrefetches() {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt > RENEW_AFTER_AWAY_MS) router.refresh();
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [router]);
}

// Barra superior. En la computadora tiene todo el menú; en el celular queda compacta (logo,
// Novedades como ícono y avatar) y las secciones principales pasan a la barra de pestañas de abajo.
export function Header({ profile, pendingReviews = 0, isAdmin = false }: { profile: Profile; pendingReviews?: number; isAdmin?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  useFreshPrefetches();
  // Precarga la sección solo cuando el alumno muestra intención de ir (ver el comentario de arriba).
  const intent = (href: string) => {
    const go = () => router.prefetch(href);
    return { prefetch: false, onPointerEnter: go, onTouchStart: go, onFocus: go } as const;
  };
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const badge = (href: string) => (href === "/resenas" ? pendingReviews : 0);

  return (
    <>
      <header className="flex min-h-[56px] print:hidden items-center justify-between gap-3 bg-header px-4 md:min-h-[72px] md:gap-6 md:px-8">
        <Link href="/" {...intent("/")} className="-my-1.5 py-1.5">
          <Logo className="h-[15px] md:h-[16px]" />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...intent(item.href)}
                aria-current={active ? "page" : undefined}
                className={`relative py-2 ${active ? "font-semibold text-ink" : "text-muted hover:text-ink"}`}
              >
                {item.label}
                {badge(item.href) > 0 && (
                  <span className="ml-1.5 font-bold text-peach-ink">
                    {pendingReviews}
                    <span className="sr-only"> pendientes</span>
                  </span>
                )}
                {active && (
                  <span aria-hidden="true" className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
          {/* Solo para administradores: entrada directa a Administración. */}
          {isAdmin && (
            <Link href="/admin/usuarios" className="relative py-2 text-muted hover:text-ink">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2.5">
          {isAdmin && (
            <Link
              href="/admin/usuarios"
              className="flex h-10 items-center rounded-full border border-line bg-surface px-3 text-[13px] font-semibold text-muted md:hidden"
            >
              Admin
            </Link>
          )}
          {/* Celular: Novedades como ícono. El tema se cambia desde Perfil → Apariencia. */}
          {NAV.filter((item) => item.mobile === "top").map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...intent(item.href)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={`flex h-10 min-w-10 items-center justify-center rounded-full px-2.5 md:hidden ${
                  active ? "bg-lavender text-lavender-ink" : "border border-line bg-surface text-muted"
                }`}
              >
                <NavIcon name={item.icon} size={20} />
                {/* Al entrar, el nombre se despliega un momento al lado del ícono y se vuelve a cerrar. */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="max-w-0 overflow-hidden text-[14px] font-semibold whitespace-nowrap opacity-0 motion-safe:animate-[peek-label_2.4s_ease-in-out]"
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="hidden md:contents">
            <ThemeToggle />
          </div>
          <Link href="/perfil" {...intent("/perfil")} aria-label="Mi perfil" className="rounded-full">
            <Avatar profile={profile} size={40} />
          </Link>
        </div>
      </header>

      {/* Celular: pestañas fijas abajo, como en una app. El layout deja ese lugar libre al final de la página. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
      >
        <div className="mx-auto grid h-[60px] max-w-[520px] grid-cols-5">
          {NAV.filter((item) => item.mobile === "tab").map((item) => {
            const active = isActive(item.href);
            const count = badge(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                {...intent(item.href)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] leading-tight ${
                  active ? "font-semibold text-ink" : "text-muted"
                }`}
              >
                <span className={`relative grid h-7 w-12 place-items-center rounded-full ${active ? "bg-lavender text-lavender-ink" : ""}`}>
                  <NavIcon name={item.icon} />
                  {count > 0 && (
                    <span className="absolute -top-1 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-peach px-1 text-[11px] font-semibold text-peach-ink">
                      {count}
                      <span className="sr-only"> pendientes</span>
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
