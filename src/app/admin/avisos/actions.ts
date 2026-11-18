"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/data";
import { buildPushPayload, NOT_YET, validateAnnouncement, validatePush } from "@/lib/broadcast/model";
import { sendPush, vapidConfigured, type PushTarget } from "@/lib/broadcast/push";
import { createClient } from "@/lib/supabase/server";

// Administración → Notificaciones. Every action checks that the caller is an admin, and the
// database checks it again (RLS and the admin_* functions).

export type AnnouncementState = { error: string | null; published: number };
export type PushSendState = { error: string | null; message: string | null };

async function careerIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("careers").select("id");
  if (error) throw new Error(`careers: ${error.message}`);
  return data.map((c) => c.id as string);
}

function refresh() {
  revalidatePath("/admin/avisos");
  revalidatePath("/");
}

export async function publishAnnouncement(prev: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  await requireAdmin();
  const checked = validateAnnouncement(
    {
      title: formData.get("title"),
      body: formData.get("body"),
      url: formData.get("url"),
      careerId: formData.get("careerId"),
      endsOn: formData.get("endsOn"),
    },
    await careerIds(),
    new Date(),
  );
  if (checked.error !== undefined) return { error: checked.error, published: prev.published };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert(checked.draft);
  if (error) {
    if (NOT_YET.has(error.code)) return { error: "Todavía no se puede: falta aplicar la migración de avisos.", published: prev.published };
    return { error: "No pudimos publicar el aviso.", published: prev.published };
  }
  refresh();
  return { error: null, published: prev.published + 1 };
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await requireAdmin();
  if (!Number.isInteger(id) || id <= 0) return;
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error && !NOT_YET.has(error.code)) throw new Error(`announcements: ${error.message}`);
  refresh();
}

const devices = (n: number) => `${n} ${n === 1 ? "dispositivo" : "dispositivos"}`;

export async function sendNotification(_prev: PushSendState, formData: FormData): Promise<PushSendState> {
  await requireAdmin();
  if (!vapidConfigured()) return { error: "Faltan las claves VAPID en Vercel: no se mandó nada.", message: null };
  const checked = validatePush(
    { title: formData.get("title"), body: formData.get("body"), url: formData.get("url"), careerId: formData.get("careerId") },
    await careerIds(),
  );
  if (checked.error !== undefined) return { error: checked.error, message: null };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_push_targets", { p_career: checked.draft.careerId });
  if (error) {
    if (NOT_YET.has(error.code)) return { error: "Todavía no se puede: falta aplicar la migración de notificaciones.", message: null };
    return { error: "No pudimos leer los dispositivos.", message: null };
  }
  const targets = data as PushTarget[];
  if (targets.length === 0) return { error: "Nadie activó las notificaciones todavía.", message: null };

  const result = await sendPush(targets, buildPushPayload(checked.draft));
  let removed = 0;
  if (result.gone.length) {
    const cleaned = await supabase.rpc("admin_remove_push_subscriptions", { p_endpoints: result.gone });
    if (cleaned.error) console.error("admin_remove_push_subscriptions", cleaned.error.code);
    else removed = Number(cleaned.data) || 0;
  }
  revalidatePath("/admin/avisos");

  const parts = [`Llegó a ${devices(result.sent)}.`];
  if (removed) parts.push(`Se borraron ${devices(removed)} que ya no existen.`);
  if (result.failed) parts.push(`Falló en ${devices(result.failed)}.`);
  return { error: result.sent === 0 && result.failed > 0 ? "No se pudo mandar a ningún dispositivo." : null, message: parts.join(" ") };
}
