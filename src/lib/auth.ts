import type { User } from "@supabase/supabase-js";

// Solo cuentas institucionales de FIUBA. Esta verificación corre siempre en el servidor.
export const ALLOWED_DOMAIN = "fi.uba.ar";

export function isAllowedEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// Motivos por los que el ingreso vuelve con ?error=… La pantalla muestra un texto fijo para cada uno:
// nunca texto sacado de la dirección (cualquiera puede armar un enlace a la página principal).
export const LOGIN_ERRORS = ["dominio", "login"] as const;
export type LoginError = (typeof LOGIN_ERRORS)[number];

export function loginError(value: unknown): LoginError | null {
  return LOGIN_ERRORS.find((e) => e === value) ?? null;
}

export type Profile = {
  email: string;
  fullName: string;
  firstName: string;
  initials: string;
  avatarUrl: string | null;
};

const LOWERCASE_PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "da", "di", "van", "von"]);

// Las cuentas @fi.uba.ar traen el nombre en mayúsculas ("FRANCISCO PEREZ"): si viene todo en
// mayúsculas o todo en minúsculas se pasa a "Francisco Perez"; si ya trae mayúsculas y minúsculas
// se respeta tal cual ("McDonald").
export function properName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed !== trimmed.toUpperCase() && trimmed !== trimmed.toLowerCase()) return trimmed;
  return trimmed
    .toLocaleLowerCase("es")
    .split(" ")
    .map((word, i) =>
      i > 0 && LOWERCASE_PARTICLES.has(word)
        ? word
        : word.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toLocaleUpperCase("es")),
    )
    .join(" ");
}

// Nombre y foto vienen de la cuenta de Google.
export function profileFromUser(user: Pick<User, "email" | "user_metadata">): Profile {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? "";
  const fullName: string = properName(meta.full_name || meta.name || email.split("@")[0]);
  const firstName: string = properName(meta.given_name || fullName.split(" ")[0] || "");
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
