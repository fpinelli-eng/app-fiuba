"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/data";

// Moderation: only "Fijar" and "Eliminar" (hide, with undo). The database only lets admins
// change pinned and hidden_at, and never the stars or the text.

export type ModerationResult = { error: string | null };

const validId = (id: number) => Number.isInteger(id) && id > 0;

export async function setReviewPinned(id: number, pinned: boolean): Promise<ModerationResult> {
  await requireAdmin();
  if (!validId(id)) return { error: "Reseña inválida." };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ pinned }).eq("id", id);
  if (error) return { error: "No pudimos cambiar la reseña." };
  revalidatePath("/admin/resenas");
  revalidatePath("/resenas", "layout");
  return { error: null };
}

/** "Eliminar" hides the review (kept for "Deshacer"); hidden reviews are not shown to students. */
export async function setReviewHidden(id: number, hidden: boolean): Promise<ModerationResult> {
  await requireAdmin();
  if (!validId(id)) return { error: "Reseña inválida." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ hidden_at: hidden ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: "No pudimos cambiar la reseña." };
  revalidatePath("/admin/resenas");
  revalidatePath("/resenas", "layout");
  return { error: null };
}
