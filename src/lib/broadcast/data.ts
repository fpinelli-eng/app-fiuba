import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/lib/session";
import { canUseBroadcasts, DISMISSED_COOKIE, NOT_YET, parseDismissed, pickAnnouncement, type Announcement } from "./model";

// Reads of the aviso on Inicio and of Administración → Notificaciones. Before the migration
// 20261118120000_avisos_push is in the database (Vercel previews), everything comes back empty.

const COLUMNS = "id, title, body, url, career_id, ends_at, created_at";

type Row = { id: number; title: string; body: string; url: string | null; career_id: string | null; ends_at: string | null; created_at: string };

const toAnnouncement = (r: Row): Announcement => ({
  id: r.id,
  title: r.title,
  body: r.body,
  url: r.url,
  careerId: r.career_id,
  endsAt: r.ends_at,
  createdAt: r.created_at,
});

/** The aviso for this viewer on Inicio, or null (also for students while only admins try it). */
export async function getHomeAnnouncement(account: Account): Promise<Announcement | null> {
  if (!canUseBroadcasts(account) || !account.planId) return null;
  const supabase = await createClient();
  const [rows, plan] = await Promise.all([
    supabase.from("announcements").select(COLUMNS).order("created_at", { ascending: false }).limit(20),
    supabase.from("plans").select("career_id").eq("id", account.planId).maybeSingle(),
  ]);
  if (rows.error) {
    if (NOT_YET.has(rows.error.code)) return null;
    throw new Error(`announcements: ${rows.error.message}`);
  }
  const careerId = (plan.data?.career_id as string | undefined) ?? null;
  const dismissed = parseDismissed((await cookies()).get(DISMISSED_COOKIE)?.value);
  return pickAnnouncement((rows.data as Row[]).map(toAnnouncement), careerId, dismissed, new Date());
}

/** Every aviso, the newest first, for Administración. null: the table is not in the database yet. */
export async function getAnnouncements(): Promise<Announcement[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").select(COLUMNS).order("created_at", { ascending: false }).limit(50);
  if (error) {
    if (NOT_YET.has(error.code)) return null;
    throw new Error(`announcements: ${error.message}`);
  }
  return (data as Row[]).map(toAnnouncement);
}

/** Subscribed browsers per career (no endpoints). null: the function is not in the database yet. */
export async function getPushCounts(): Promise<{ careerId: string | null; devices: number }[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_push_counts");
  if (error) {
    if (NOT_YET.has(error.code)) return null;
    throw new Error(`admin_push_counts: ${error.message}`);
  }
  return (data as { career_id: string | null; devices: number | string }[]).map((r) => ({ careerId: r.career_id, devices: Number(r.devices) }));
}
