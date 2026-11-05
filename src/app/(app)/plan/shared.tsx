import type { ReactNode } from "react";
import type { ClassBlock, WeekDay } from "@/lib/plan/options";
import type { Score, SubjectGroup } from "@/lib/plan/data";

// Piezas comunes del plan en escritorio (PlanBuilder) y en celular (PlanMobile).

export const GROUP_TITLE: Record<SubjectGroup, string> = {
  obligatorias: "OBLIGATORIAS",
  electivas: "ELECTIVAS",
  otras: "OTRAS MATERIAS DE LA OFERTA",
};

// Un color pastel por materia, en el orden en que entran al plan.
export const PALETTE = [
  { bg: "bg-lavender", ink: "text-lavender-ink", border: "border-lavender-ink/25", dot: "bg-lavender-ink" },
  { bg: "bg-mint", ink: "text-mint-ink", border: "border-mint-ink/25", dot: "bg-mint-ink" },
  { bg: "bg-butter", ink: "text-butter-ink", border: "border-butter-ink/25", dot: "bg-butter-ink" },
  { bg: "bg-sky", ink: "text-sky-ink", border: "border-sky-ink/25", dot: "bg-sky-ink" },
  { bg: "bg-peach", ink: "text-peach-ink", border: "border-peach-ink/25", dot: "bg-peach-ink" },
  { bg: "bg-pink", ink: "text-pink-ink", border: "border-pink-ink/25", dot: "bg-pink-ink" },
  { bg: "bg-teal", ink: "text-teal-ink", border: "border-teal-ink/25", dot: "bg-teal-ink" },
] as const;
export type Color = (typeof PALETTE)[number];

export const CAMPUS_SHORT: Record<string, string> = {
  "Paseo Colón": "PC",
  "Las Heras": "LH",
  "Ciudad Universitaria": "CU",
};

export const DAY_LONG: Record<WeekDay, string> = {
  Lunes: "lunes",
  Martes: "martes",
  Miércoles: "miércoles",
  Jueves: "jueves",
  Viernes: "viernes",
  Sábado: "sábado",
  Domingo: "domingo",
};

export const overlaps = (a: ClassBlock, b: ClassBlock) => a.day === b.day && a.start < b.end && b.start < a.end;

export function Warning({ tone, children }: { tone: "ok" | "overlap" | "transfer"; children: ReactNode }) {
  const style = {
    ok: "bg-mint text-mint-ink",
    overlap: "bg-peach text-peach-ink",
    transfer: "bg-butter text-butter-ink",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-[10px] px-3 py-2 text-[13px] leading-snug ${style}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-px flex-none">
        {tone === "ok" ? (
          <path d="M20 6L9 17l-5-5" />
        ) : (
          <path d="M12 9v4M12 17h.01M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        )}
      </svg>
      {children}
    </div>
  );
}

export function Rating({ score }: { score: Score | null }) {
  if (!score) return <span className="text-xs whitespace-nowrap text-muted">Sin reseñas</span>;
  return (
    <span className="flex items-center gap-[3px] text-[12.5px] font-semibold whitespace-nowrap">
      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" className="fill-star">
        <path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
      </svg>
      {score.average.toFixed(1).replace(".", ",")}
      <span className="font-normal text-muted">({score.count})</span>
    </span>
  );
}

export function Check({ size = 12, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
