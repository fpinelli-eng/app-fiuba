import { createClient } from "@/lib/supabase/server";

// Undefined column: the migration 20261107130000_intro_seen is not applied yet. Vercel previews use
// the production database, which only gets it when the branch is merged.
const MISSING_COLUMN = "42703";

/** First day since the student entered the app: Inicio offers to watch the welcome stories again. */
export async function isFirstDay(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("created_at").eq("id", userId).maybeSingle();
  if (error) throw new Error(`profiles: ${error.message}`);
  return Boolean(data?.created_at) && Date.now() - new Date(data!.created_at as string).getTime() < 24 * 60 * 60 * 1000;
}

/** Whether the student already saw (or skipped) the welcome stories. */
export async function getIntroSeen(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("intro_seen_at").eq("id", userId).maybeSingle();
  if (error?.code === MISSING_COLUMN) return true;
  if (error) throw new Error(`profiles: ${error.message}`);
  return Boolean(data?.intro_seen_at);
}

// Function not there yet: the migration 20261113140000_last_seen is not applied (Vercel previews use
// the production database until the branch is merged).
const MISSING_FUNCTION = new Set(["42883", "PGRST202"]);

/** Marks that the student used the app now (the database only writes it once per hour). */
export async function touchLastSeen(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("touch_last_seen");
  if (error && !MISSING_FUNCTION.has(error.code)) throw new Error(`touch_last_seen: ${error.message}`);
}
