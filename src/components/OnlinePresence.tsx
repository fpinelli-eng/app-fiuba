"use client";

import { useEffect } from "react";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { browserPresenceKey, presenceTopic, type PresencePayload } from "@/lib/presence";

// After a tab is hidden, it stays "en línea" this long before leaving: switching apps for a moment
// doesn't cost a leave and a join (each one is a Realtime message for everyone in the channel).
const HIDDEN_GRACE_MS = 30_000;

function randomKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2, 14);
}

function localStore(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Counts this browser as "en línea" in Administración → Usuarios while the app is open in the
 * foreground (Supabase Realtime Presence, see src/lib/presence.ts): no database reads or writes.
 * Renders nothing. Realtime is loaded after the page, and any failure is ignored.
 */
export function OnlinePresence({ planId }: { planId: string }) {
  useEffect(() => {
    const key = browserPresenceKey(localStore(), randomKey);
    const payload: PresencePayload = { since: Math.floor(Date.now() / 60_000) * 60_000 };
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let joining = false;
    let stopped = false;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    async function join() {
      if (stopped || channel || joining || document.visibilityState !== "visible") return;
      joining = true;
      try {
        if (!supabase) supabase = (await import("@/lib/supabase/client")).createClient();
        if (stopped || channel || document.visibilityState !== "visible") return;
        const ch = supabase.channel(presenceTopic(planId), { config: { presence: { key } } });
        channel = ch;
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED" && channel === ch) ch.track(payload).catch(() => {});
        });
      } catch {
        // Without Realtime the app works the same; this browser just isn't counted.
      } finally {
        joining = false;
      }
    }

    function leave() {
      const ch = channel;
      channel = null;
      if (ch && supabase) supabase.removeChannel(ch).catch(() => {});
    }

    function onVisibility() {
      clearTimeout(hideTimer);
      if (document.visibilityState === "visible") void join();
      else hideTimer = setTimeout(leave, HIDDEN_GRACE_MS);
    }

    // Off the critical path: after the browser is idle (or 2 s).
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => void join(), { timeout: 4000 })
      : window.setTimeout(() => void join(), 2000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      stopped = true;
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      clearTimeout(hideTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [planId]);

  return null;
}
