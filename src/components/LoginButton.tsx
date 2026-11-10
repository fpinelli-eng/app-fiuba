"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ALLOWED_DOMAIN } from "@/lib/auth";

export function LoginButton({
  label,
  className = "mt-8 h-[52px] w-full max-w-[360px] md:mt-11",
}: {
  label: string;
  /** Size and margin; the colors and the rest stay the same. */
  className?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function login() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // hd sugiere a Google mostrar solo cuentas @fi.uba.ar; el control real está en el servidor.
        queryParams: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
      },
    });
    if (error) setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={login}
      disabled={loading}
      className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[15px] font-semibold text-on-accent disabled:cursor-wait disabled:opacity-80 md:gap-2.5 md:px-6 md:text-base ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
      {loading ? "Abriendo Google…" : label}
    </button>
  );
}
