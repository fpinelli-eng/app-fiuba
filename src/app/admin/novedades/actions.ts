"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/data";
import { getDatesToConfirm } from "@/lib/news/data";
import { validateConfirmation, validateNews } from "@/lib/news/model";
import { createClient } from "@/lib/supabase/server";

// Avisos of Novedades: publish, pin / unpin and delete. Every action checks that the caller
// is an admin, and the database checks it again (RLS): only admins write news.

export type NewsState = { error: string | null; published: number };

function refresh() {
  revalidatePath("/admin/novedades");
  revalidatePath("/novedades");
}

export async function publishNews(prev: NewsState, formData: FormData): Promise<NewsState> {
  await requireAdmin();
  const checked = validateNews({ title: formData.get("title"), body: formData.get("body"), url: formData.get("url") });
  if (checked.error !== undefined) return { error: checked.error, published: prev.published };
  const supabase = await createClient();
  const { error } = await supabase.from("news").insert(checked.draft);
  if (error) return { error: "No pudimos publicar el aviso.", published: prev.published };
  refresh();
  return { error: null, published: prev.published + 1 };
}

const validId = (id: number) => Number.isInteger(id) && id > 0;

export async function setNewsPinned(id: number, pinned: boolean): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("news").update({ pinned }).eq("id", id);
  if (error) throw new Error(`news: ${error.message}`);
  refresh();
}

export async function deleteNews(id: number): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("news").delete().eq("id", id);
  if (error) throw new Error(`news: ${error.message}`);
  refresh();
}

// Fechas importantes: confirm the real date of a calendar row (or a new one) and delete it. The
// calendar is always the latest one, read again here (the form only sends the row).

export type ConfirmState = { error: string | null; saved: number };

export async function confirmDate(prev: ConfirmState, formData: FormData): Promise<ConfirmState> {
  await requireAdmin();
  const checked = validateConfirmation({
    title: formData.get("title"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    note: formData.get("note"),
    replaces: formData.get("replaces"),
  });
  if (checked.error !== undefined) return { error: checked.error, saved: prev.saved };
  const { calendar } = await getDatesToConfirm();
  if (!calendar) return { error: "No hay un calendario cargado.", saved: prev.saved };
  const { title, startsOn, endsOn, note, replaces } = checked.draft;
  const supabase = await createClient();
  const { error } = await supabase
    .from("academic_date_confirmations")
    .insert({ calendar, title, starts_on: startsOn, ends_on: endsOn, note, replaces });
  if (error?.code === "23505") return { error: "Esa fecha ya está confirmada: eliminá la confirmación anterior primero.", saved: prev.saved };
  if (error?.code === "23503") return { error: "Esa fecha del calendario ya no existe. Recargá la página.", saved: prev.saved };
  if (error) return { error: "No pudimos guardar la fecha.", saved: prev.saved };
  refresh();
  return { error: null, saved: prev.saved + 1 };
}

export async function deleteConfirmation(id: number): Promise<void> {
  await requireAdmin();
  if (!validId(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("academic_date_confirmations").delete().eq("id", id);
  if (error) throw new Error(`academic_date_confirmations: ${error.message}`);
  refresh();
}
