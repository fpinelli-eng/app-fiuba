import { createClient } from "@/lib/supabase/server";
import { toAdminUser, type AdminUser } from "./usage";

const MISSING_FUNCTION = new Set(["42883", "PGRST202"]);

/**
 * The students with admin_users() and how many wrote a review with admin_review_authors(): the way
 * Administración → Usuarios read them before admin_uso() brought both (20261119180000). Only used
 * while that migration is not applied.
 */
export async function getAdminUsers(): Promise<{ users: AdminUser[]; reviewAuthors: number | null }> {
  const supabase = await createClient();
  const [{ data, error }, authors] = await Promise.all([supabase.rpc("admin_users"), supabase.rpc("admin_review_authors")]);
  if (error) throw new Error(`admin_users: ${error.message}`);
  // A preview before the migration is applied (they share the production database): no total yet.
  const missing = authors.error && MISSING_FUNCTION.has(authors.error.code);
  if (authors.error && !missing) throw new Error(`admin_review_authors: ${authors.error.message}`);
  const users = ((data ?? []) as Record<string, unknown>[]).map(toAdminUser);
  return { users, reviewAuthors: missing ? null : Number(authors.data ?? 0) };
}
