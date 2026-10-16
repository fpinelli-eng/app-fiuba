"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/session";

export type DeleteState = { error: string | null };

// "Borrar mi cuenta": la base borra el usuario y todo lo suyo; las reseñas quedan, sin autor.
export async function deleteAccount(): Promise<DeleteState> {
  await requireAccount();
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: "No pudimos borrar tu cuenta. Probá de nuevo." };
  await supabase.auth.signOut();
  redirect("/ingresar");
}
