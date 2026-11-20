"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Pantalla de la lámina del plan (/plan/imprimir y su vista previa): la hoja centrada, achicada si no
// entra a lo ancho, con una barra "Volver al plan" / "Descargar PDF" que no se imprime. "Descargar PDF"
// abre el diálogo de impresión del navegador, donde se elige "Guardar como PDF". Con autoPrint lo abre
// solo al llegar (el botón del Plan), cuando ya cargaron las tipografías.

const PRINT_CSS = `
@page { size: A4 landscape; margin: 0; }
.pp-sheet, .pp-sheet * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media print {
  html, body { background: none !important; margin: 0 !important; }
  .pp-screen { display: none !important; }
  .pp-stage { display: block !important; padding: 0 !important; min-height: 0 !important; background: none !important; }
  .pp-fit { width: auto !important; height: auto !important; box-shadow: none !important; }
  .pp-scale { transform: none !important; }
}
`;

export function PosterScreen({ children, backHref, autoPrint = false }: { children: ReactNode; backHref: string; autoPrint?: boolean }) {
  const stage = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // La hoja mide 297 mm: en una pantalla angosta se achica entera, como una vista previa.
  useEffect(() => {
    const fit = () => {
      const available = (stage.current?.clientWidth ?? 0) - 32;
      const width = sheet.current?.offsetWidth ?? 0;
      if (available > 0 && width > 0) setScale(Math.min(1, available / width));
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!autoPrint) return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      // Sin el parámetro, recargar la página no vuelve a abrir el diálogo.
      const url = new URL(window.location.href);
      url.searchParams.delete("imprimir");
      window.history.replaceState(window.history.state, "", url);
      window.print();
    });
    return () => {
      cancelled = true;
    };
  }, [autoPrint]);

  return (
    <div ref={stage} className="pp-stage flex min-h-dvh flex-col items-center gap-4 bg-bg px-4 pt-4 pb-10 md:pt-6">
      <style>{PRINT_CSS}</style>
      <div className="pp-screen flex w-full max-w-[297mm] flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line bg-surface px-3.5 text-[13.5px] text-ink-2 hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Volver al plan
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-[13px] text-muted sm:block">En el destino, elegí “Guardar como PDF”.</p>
          <button
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-1.5 rounded-[10px] bg-accent px-4 text-[13.5px] font-semibold text-on-accent"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
            </svg>
            Descargar PDF
          </button>
        </div>
      </div>
      <div
        className="pp-fit flex-none overflow-hidden rounded-[6px] shadow-[0_10px_36px_-12px_var(--pop-shadow)]"
        style={{ width: `calc(297mm * ${scale})`, height: `calc(210mm * ${scale})` }}
      >
        <div ref={sheet} className="pp-scale w-[297mm] origin-top-left" style={{ transform: scale < 1 ? `scale(${scale})` : undefined }}>
          {children}
        </div>
      </div>
    </div>
  );
}
