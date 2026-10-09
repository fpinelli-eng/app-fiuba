import type { ReactNode } from "react";

// Contenedor común de las páginas: título y contenido.
export function PageShell({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-5 px-6 pt-8 pb-14">
      <h1 className="text-[30px] font-semibold tracking-[-0.01em]">{title}</h1>
      {children}
    </main>
  );
}

// Marcador para secciones que todavía no están construidas.
export function Pending({ issue }: { issue: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-line-strong bg-surface p-8 text-muted">
      En construcción · {issue}
    </div>
  );
}
