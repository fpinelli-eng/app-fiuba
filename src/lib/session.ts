import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail, profileFromUser, type Profile } from "@/lib/auth";

// Verificación definitiva de la sesión, del lado del servidor.
// Sin sesión → /ingresar. Con una cuenta que no es @fi.uba.ar → se cierra la sesión y se muestra el rechazo.
// `cache` evita repetir la consulta si el layout y la página la piden en el mismo pedido.
export const requireProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect("/ingresar");
  if (!isAllowedEmail(user.email)) {
    redirect(`/auth/salir?error=dominio&email=${encodeURIComponent(user.email ?? "")}`);
  }
  return profileFromUser(user);
});
