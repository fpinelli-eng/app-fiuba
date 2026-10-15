import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail, profileFromUser, type Profile } from "@/lib/auth";

export type Account = Profile & {
  id: string;
  /** null until the student picks a career and plan (/carrera). */
  planId: string | null;
  isAdmin: boolean;
};

// Verificación definitiva de la sesión, del lado del servidor.
// Sin sesión → /ingresar. Con una cuenta que no es @fi.uba.ar → se cierra la sesión y se muestra el rechazo.
// La primera vez crea la fila del alumno en `profiles`.
// `cache` evita repetir las consultas si el layout y la página las piden en el mismo pedido.
export const requireAccount = cache(async (): Promise<Account> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/ingresar");
  if (!isAllowedEmail(user.email)) {
    redirect(`/auth/salir?error=dominio&email=${encodeURIComponent(user.email ?? "")}`);
  }

  const { data: row, error } = await supabase
    .from("profiles")
    .select("plan_id, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);

  if (!row) {
    const { error: createError } = await supabase.rpc("ensure_profile");
    if (createError) throw new Error(`ensure_profile: ${createError.message}`);
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
