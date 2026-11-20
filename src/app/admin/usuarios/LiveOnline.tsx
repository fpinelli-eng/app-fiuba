"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { presenceTopic, summarizeOnline, type OnlineSummary } from "@/lib/presence";

export interface PresencePlan {
  id: string;
  careerId: string;
  careerName: string;
}

type Status = "connecting" | "live" | "error";

/**
 * "En línea ahora" of Administración → Usuarios: listens to the presence channel of every plan
 * (src/lib/presence.ts) without tracking itself, and updates with each change. Nothing is read from
 * the database. The peak is kept only in memory, since the page was opened.
 */
export function LiveOnline({ plans }: { plans: PresencePlan[] }) {
  const [status, setStatus] = useState<Status>("connecting");
  const [summary, setSummary] = useState<OnlineSummary>({ total: 0, byCareer: [] });
  const [peak, setPeak] = useState(0);

  useEffect(() => {
    const careerOfPlan = new Map(plans.map((p) => [p.id, { id: p.careerId, name: p.careerName }]));
    const keysByPlan: Record<string, string[]> = {};
    const channels: RealtimeChannel[] = [];
    let supabase: SupabaseClient | null = null;
    let stopped = false;

    const update = () => {
      const next = summarizeOnline(keysByPlan, careerOfPlan);
      setSummary(next);
      setPeak((p) => Math.max(p, next.total));
    };

    (async () => {
      try {
        supabase = (await import("@/lib/supabase/client")).createClient();
      } catch {
        setStatus("error");
        return;
      }
      if (stopped) return;
      for (const plan of plans) {
        const ch = supabase.channel(presenceTopic(plan.id));
        ch.on("presence", { event: "sync" }, () => {
          keysByPlan[plan.id] = Object.keys(ch.presenceState());
          update();
        });
        ch.subscribe((s) => {
          if (stopped) return;
          if (s === "SUBSCRIBED") {
            keysByPlan[plan.id] ??= [];
            setStatus("live");
            update();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            setStatus((prev) => (prev === "live" ? prev : "error"));
          }
        });
        channels.push(ch);
      }
    })();

    return () => {
      stopped = true;
      for (const ch of channels) supabase?.removeChannel(ch).catch(() => {});
    };
  }, [plans]);

  if (status === "error") {
    return <p className="text-sm text-muted">No se pudo conectar con el tiempo real de Supabase. Probá recargar la página.</p>;
  }

  const n = (v: number) => v.toLocaleString("es-AR");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`inline-block size-2.5 rounded-full ${status === "live" ? "bg-accent motion-safe:animate-pulse" : "bg-line-strong"}`}
          />
          <span className="text-[34px] leading-none font-semibold tabular-nums" aria-live="polite" aria-atomic="true">
            {status === "live" ? n(summary.total) : "…"}
            <span className="sr-only"> {summary.total === 1 ? "persona en línea" : "personas en línea"}</span>
          </span>
        </span>
        {status === "live" && (
          <span className="text-sm text-muted tabular-nums">Máximo desde que abriste la página: {n(peak)}</span>
        )}
        {status === "connecting" && <span className="text-sm text-muted">Conectando…</span>}
      </div>

      {status === "live" && summary.byCareer.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {summary.byCareer.map((c) => (
            <li key={c.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{c.name}</span>
              <span className="font-semibold tabular-nums">{n(c.count)}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-[13px] text-muted">
        Cuenta a quienes tienen la app abierta y a la vista ahora (cada navegador una vez; una pestaña escondida deja de contar a los 30 s). Se
        actualiza solo y no usa la base de datos.
      </p>
    </div>
  );
}
