import { createClient } from "@/lib/supabase/server";

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
  /** How many reviews they wrote (only the number: reviews stay anonymous). */
  reviews: number;
}

/** The students, newest first, and the moment they were read (to count the new ones). */
export async function getAdminUsers(): Promise<{ users: AdminUser[]; readAt: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_users");
  if (error) throw new Error(`admin_users: ${error.message}`);
  const users = (data as Record<string, unknown>[]).map((u) => ({
    fullName: (u.full_name as string) || "",
    email: u.email as string,
    planId: (u.plan_id as string | null) ?? null,
    createdAt: u.created_at as string,
    introSeen: u.intro_seen === true,
    subjects: Number(u.subjects),
    planCourses: Number(u.plan_courses),
    reviews: Number(u.reviews ?? 0),
  }));
  return { users, readAt: Date.now() };
}
