"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME, NAV } from "@/lib/app";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Avatar } from "@/components/Avatar";
import type { Profile } from "@/lib/auth";

export function Header({ profile }: { profile: Profile }) {
  const pathname = usePathname();
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
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-[10px] bg-lavender px-4 py-2 font-semibold text-lavender-ink"
                  : "rounded-[10px] px-4 py-2 text-muted hover:text-ink"
              }
            >
              {item.label}
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
