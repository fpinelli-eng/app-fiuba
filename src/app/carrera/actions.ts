"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/session";

export type ChoosePlanState = { error: string | null };

// Paso 2 del ingreso: guarda la carrera y el plan y lleva al mapa para cargar las materias.
// Cambiar de plan después es otra cosa (perfil, con equivalencias): acá solo se elige la primera vez.
export async function choosePlan(_prev: ChoosePlanState, formData: FormData): Promise<ChoosePlanState> {
  const account = await requireAccount();
  if (account.planId) redirect("/");

  const planId = formData.get("plan");
  if (typeof planId !== "string" || !planId) return { error: "Elegí tu carrera y tu plan." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ plan_id: planId })
    .eq("id", account.id)
    .select("plan_id");
  if (error || data?.length !== 1) return { error: "No pudimos guardar tu carrera. Probá de nuevo." };

  redirect("/mapa?carga=1");
}
