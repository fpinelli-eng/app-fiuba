"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NavIcon } from "@/components/icons";
import { addDismissed, cleanUrl, DISMISSED_COOKIE, type Announcement } from "@/lib/broadcast/model";

// El aviso de FIUBI en el Inicio: amarillo (el único pastel que el Inicio no usa), con la campanita de
// Novedades. Se cierra una vez: queda en una cookie y el Inicio no lo vuelve a mostrar en este navegador.
// `preview` lo dibuja sin cerrar (vista previa de Administración); con `remember={false}` se cierra sin
// guardarlo (vista previa pública).

const YEAR = 60 * 60 * 24 * 365;

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export function AnnouncementCard({
  announcement,
  preview = false,
  remember = true,
}: {
  announcement: Pick<Announcement, "id" | "title" | "body" | "url">;
  preview?: boolean;
  remember?: boolean;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  function close() {
    if (remember) {
      const value = addDismissed(readCookie(DISMISSED_COOKIE), announcement.id);
      document.cookie = `${DISMISSED_COOKIE}=${value}; path=/; max-age=${YEAR}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    }
    setClosing(true);
    // Sin animación (movimiento reducido) no hay transitionend: el temporizador lo cierra igual.
    window.setTimeout(() => {
      setClosed(true);
      if (remember) router.refresh();
    }, 320);
  }

  // Solo enlaces a una sección de FIUBI o https (la vista previa de Administración pasa lo que se escribe).
  const link = cleanUrl(announcement.url);
  const url = "url" in link ? link.url : null;
  const external = url !== null && !url.startsWith("/");
  const linkClass = "inline-block py-2 font-bold underline underline-offset-[3px] hover:no-underline md:-my-2 md:flex-none";
  const titleId = `aviso-${announcement.id}${preview ? "-preview" : ""}`;

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${closing ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
    >
      <section aria-labelledby={titleId} className="min-h-0 overflow-hidden rounded-[24px] bg-butter text-butter-ink md:rounded-[28px]">
        <div className="flex items-start gap-3 py-3.5 pr-1.5 pl-4 md:items-center md:gap-4 md:py-[18px] md:pr-3 md:pl-[22px]">
          <span aria-hidden className="mt-0.5 grid size-9 flex-none place-items-center rounded-full bg-surface text-butter-ink md:mt-0 md:size-10">
            <NavIcon name="bell" size={19} />
          </span>
          <div className="min-w-0 flex-1 md:flex md:items-center md:justify-between md:gap-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-[15px] font-bold text-ink md:text-base">
                {announcement.title}
              </h2>
              <p className="text-sm text-pretty md:text-[15px]">{announcement.body}</p>
            </div>
            {/* En la vista previa de Administración el enlace se muestra pero no se sigue (es lo que se está escribiendo). */}
            {url &&
              (preview ? (
                <span className={linkClass}>Ver más</span>
              ) : external ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  Ver más<span className="sr-only"> (se abre en otra pestaña)</span>
                </a>
              ) : (
                <Link href={url} className={linkClass}>
                  Ver más
                </Link>
              ))}
          </div>
          {!preview && (
            <button
              type="button"
              onClick={close}
              disabled={closing}
              aria-label="Cerrar el aviso"
              className="grid size-11 flex-none place-items-center rounded-full hover:bg-surface/60 md:-my-1"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
