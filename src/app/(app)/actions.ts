"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAccount } from "@/lib/session";

// The student finished or skipped the welcome stories: they do not open again by themselves
// (they can be watched again from Perfil).
export async function markIntroSeen(): Promise<void> {
  const account = await requireAccount();
  if (account.introSeen) return;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ intro_seen_at: new Date().toISOString() }).eq("id", account.id);
  if (error) throw new Error(`profiles: ${error.message}`);
}
