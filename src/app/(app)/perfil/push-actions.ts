"use server";

import { canUseBroadcasts, NOT_YET } from "@/lib/broadcast/model";
import { requireProfile } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

// "Activar notificaciones" (Perfil): guarda o borra este navegador. Mientras las prueban, solo los
// administradores; la base lo exige de nuevo en save_push_subscription().

export type PushSaveResult = { error: string | null };

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

export async function savePushSubscription(subscription: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }): Promise<PushSaveResult> {
  const account = await requireProfile();
  if (!canUseBroadcasts(account)) return { error: "Las notificaciones todavía no están disponibles." };
  const endpoint = str(subscription?.endpoint, 1000);
  const p256dh = str(subscription?.keys?.p256dh, 200);
  const auth = str(subscription?.keys?.auth, 100);
  if (!endpoint || !endpoint.startsWith("https://") || !p256dh || !auth) return { error: "El navegador no devolvió una suscripción válida." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth });
  if (error) {
    if (NOT_YET.has(error.code)) return { error: "Todavía no se puede: falta aplicar la migración de notificaciones." };
    return { error: "No pudimos activar las notificaciones. Probá de nuevo." };
  }
  return { error: null };
}

export async function deletePushSubscription(endpoint: unknown): Promise<PushSaveResult> {
  await requireProfile();
  const value = str(endpoint, 1000);
  if (!value) return { error: null };
  const supabase = await createClient();
  // RLS: solo borra filas propias.
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", value);
  if (error && !NOT_YET.has(error.code)) return { error: "No pudimos desactivarlas. Probá de nuevo." };
  return { error: null };
}
