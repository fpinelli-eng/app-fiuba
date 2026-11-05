"use client";

import { useState } from "react";
import type { PlacedBlock } from "@/lib/home/calendar";
import { formatHour } from "@/lib/plan/format";
import { CAMPUS_NAME, PALETTE } from "./home-palette";

// Calendario de la cursada en el celular: en lugar de la grilla semanal (no entra en 360 px),
// un día por vez con botones Lun–Sáb. Arranca en hoy, o en el próximo día con clases.

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export function HomeDayView({ days, today, initial }: { days: PlacedBlock[][]; today: number; initial: number }) {
  const [day, setDay] = useState(initial);
  const blocks = days[day] ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Día" className="grid grid-cols-6 gap-1">
        {DAYS.map((label, i) => {
          const on = i === day;
          const hasClasses = days[i]?.length > 0;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              aria-label={`${DAY_NAMES[i]}${i === today ? " (hoy)" : ""}${hasClasses ? "" : ", sin clases"}`}
              onClick={() => setDay(i)}
              className={`flex h-12 flex-col items-center justify-center gap-1 rounded-[10px] text-[13px] ${
                on ? "bg-lavender font-semibold text-lavender-ink" : i === today ? "border border-accent text-ink" : "bg-bg text-muted"
              }`}
            >
              {label}
              <span className={`size-1.5 rounded-full ${hasClasses ? (on ? "bg-lavender-ink" : "bg-accent") : "bg-transparent"}`} />
            </button>
          );
        })}
      </div>

      {blocks.length === 0 ? (
        <div className="rounded-xl bg-bg px-4 py-5 text-center text-sm text-muted">
          Sin clases el {DAY_NAMES[day]}.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {blocks.map((p) => {
            const where = p.block.campus ? CAMPUS_NAME[p.block.campus] : p.block.virtual ? "Virtual" : null;
            return (
              <li key={`${p.course.offeringId}-${p.block.start}`} className="flex items-stretch gap-3">
                <div className="w-12 flex-none pt-2.5 text-right text-[13px] leading-tight font-semibold text-ink-2 tabular-nums">
                  {formatHour(p.block.start)}
                  <div className="font-normal text-muted">{formatHour(p.block.end)}</div>
                </div>
                <div className={`min-w-0 flex-auto rounded-xl border px-3.5 py-2.5 ${PALETTE[p.color % PALETTE.length]}`}>
                  <div className="text-[15px] leading-snug font-semibold">{p.course.subject}</div>
                  <div className="text-[13px] opacity-90 tabular-nums">
                    {[p.course.code, where, `${formatHour(p.block.start)}–${formatHour(p.block.end)} hs`].filter(Boolean).join(" · ")}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
