import { createClient } from "@/lib/supabase/server";

const MISSING_FUNCTION = new Set(["42883", "PGRST202"]);

/** One student, for Administración → Usuarios (public.admin_users, admins only). */
export interface AdminUser {
  fullName: string;
  email: string;
  planId: string | null;
  createdAt: string;
  introSeen: boolean;
  /** Subjects marked as approved in the map. */
  subjects: number;
  planCourses: number;
  /** Day they last used the app (ISO, Buenos Aires midnight), or null if never recorded. */
  lastSeenAt: string | null;
  /** How they arrived before signing up ("qr": the printed QR), or null if unknown. */
  signupSource: string | null;
}

/**
 * The students, newest first, the moment they were read (to count the new ones) and how many of them
 * wrote at least one review: only that total, never per student, so reviews stay anonymous.
 */
export async function getAdminUsers(): Promise<{ users: AdminUser[]; readAt: number; reviewAuthors: number | null }> {
  const supabase = await createClient();
  const [{ data, error }, authors] = await Promise.all([supabase.rpc("admin_users"), supabase.rpc("admin_review_authors")]);
  if (error) throw new Error(`admin_users: ${error.message}`);
  // A preview before the migration is applied (they share the production database): no total yet.
  const missing = authors.error && MISSING_FUNCTION.has(authors.error.code);
  if (authors.error && !missing) throw new Error(`admin_review_authors: ${authors.error.message}`);
  const users = (data as Record<string, unknown>[]).map((u) => ({
    fullName: (u.full_name as string) || "",
    email: u.email as string,
    planId: (u.plan_id as string | null) ?? null,
    createdAt: u.created_at as string,
    introSeen: u.intro_seen === true,
    subjects: Number(u.subjects),
    planCourses: Number(u.plan_courses),
    lastSeenAt: (u.last_seen_at as string | null) ?? null,
    signupSource: (u.signup_source as string | null) ?? null,
  }));
  return { users, readAt: Date.now(), reviewAuthors: missing ? null : Number(authors.data ?? 0) };
}
