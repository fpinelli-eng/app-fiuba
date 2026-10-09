import type { User } from "@supabase/supabase-js";

// Solo cuentas institucionales de FIUBA. Esta verificación corre siempre en el servidor.
export const ALLOWED_DOMAIN = "fi.uba.ar";

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

export type Profile = {
  email: string;
  fullName: string;
  firstName: string;
  initials: string;
  avatarUrl: string | null;
};

// Nombre y foto vienen de la cuenta de Google.
export function profileFromUser(user: User): Profile {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const fullName: string = (meta.full_name || meta.name || email.split("@")[0]).trim();
  const firstName: string = (meta.given_name || fullName.split(" ")[0] || "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const initials = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
  return {
    email,
    fullName,
    firstName,
    initials: initials || email.slice(0, 2).toUpperCase(),
    avatarUrl: meta.avatar_url || meta.picture || null,
  };
}
