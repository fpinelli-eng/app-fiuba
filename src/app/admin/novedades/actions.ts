"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/data";
import { validateNews } from "@/lib/news/model";
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
