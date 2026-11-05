"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAccount, requireProfile } from "@/lib/session";

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

export type ChangePlanState = { error: string | null };

// "Cambiar" carrera o plan: sin equivalencias. La base borra las materias, los requisitos y el
// plan del cuatrimestre (change_my_plan) y el alumno vuelve a cargar sus materias en el mapa.
export async function changePlan(_prev: ChangePlanState, formData: FormData): Promise<ChangePlanState> {
  const account = await requireProfile();
  const planId = formData.get("plan");
  if (typeof planId !== "string" || !planId) return { error: "Elegí tu carrera y tu plan." };
  if (planId === account.planId) redirect("/perfil");

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_my_plan", { new_plan_id: planId });
  if (error) return { error: "No pudimos cambiar tu carrera. Probá de nuevo." };

  // Todas las secciones precargadas muestran el plan viejo: se descartan.
  revalidatePath("/", "layout");
  redirect("/mapa?carga=1");
}
