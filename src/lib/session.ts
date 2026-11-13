import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail, profileFromUser, type Profile } from "@/lib/auth";
import { parseRef, REFERRAL_COOKIE } from "@/lib/referral";

export type Account = Profile & {
  id: string;
  /** null until the student picks a career and plan (/carrera). */
  planId: string | null;
  isAdmin: boolean;
};

// Función todavía no creada: la migración 20261115120000_signup_source no está aplicada (las vistas
// previas de Vercel usan la base de producción hasta que se integra la rama).
const MISSING_FUNCTION = new Set(["42883", "PGRST202"]);

// Si llegó por el QR (cookie del proxy), lo anota en el perfil recién creado. La base solo lo acepta una
// vez, en las primeras 24 h de la cuenta y con valores de la lista. La cookie queda (en un Server
// Component no se puede borrar) y vence sola: la base no deja reescribir el valor.
async function saveSignupSource(supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  const source = parseRef((await cookies()).get(REFERRAL_COOKIE)?.value);
  if (!source) return;
  const { error } = await supabase.rpc("set_my_signup_source", { p_source: source });
  if (error && !MISSING_FUNCTION.has(error.code)) throw new Error(`set_my_signup_source: ${error.message}`);
}

// Verificación definitiva de la sesión, del lado del servidor.
// Sin sesión → /ingresar. Con una cuenta que no es @fi.uba.ar → se cierra la sesión y se muestra el rechazo.
// La primera vez crea la fila del alumno en `profiles`.
// `cache` evita repetir las consultas si el layout y la página las piden en el mismo pedido.
export const requireAccount = cache(async (): Promise<Account> => {
  const supabase = await createClient();
  // Verifica la firma del token (la base hace lo mismo con cada consulta). Más rápido que getUser,
  // que siempre va a Supabase; el token dura una hora y el proxy lo renueva.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/ingresar");
  const user = { id: claims.sub, email: claims.email, user_metadata: claims.user_metadata ?? {} };
  if (!isAllowedEmail(user.email)) {
    redirect("/auth/salir?error=dominio");
  }

  const { data: row, error } = await supabase
    .from("profiles")
    .select("plan_id, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);

  if (!row) {
    const { error: createError } = await supabase.rpc("ensure_profile");
    // Sesión de una cuenta que ya se borró (por ejemplo, abierta en otro dispositivo): el usuario no
    // existe más y el perfil no se puede crear (foreign key). Se cierra la sesión y vuelve al ingreso.
    if (createError?.code === "23503") redirect("/auth/salir");
    if (createError) throw new Error(`ensure_profile: ${createError.message}`);
    await saveSignupSource(supabase);
  }

  return {
    ...profileFromUser(user),
    id: user.id,
    planId: (row?.plan_id as string | null | undefined) ?? null,
    isAdmin: row?.is_admin === true,
  };
});

// Para las secciones de la app: además exige haber elegido carrera y plan.
export const requireProfile = cache(async (): Promise<Account> => {
  const account = await requireAccount();
  if (!account.planId) redirect("/carrera");
  return account;
});
