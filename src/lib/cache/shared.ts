import { cache } from "react";
import { redirect } from "next/navigation";
import { revalidateTag, unstable_cache } from "next/cache";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { requireAccount } from "@/lib/session";
import type { CacheSpec } from "./keys";

// Shared catalog cache (Next.js data cache, unstable_cache + tags): data that is the same for
// every student of a plan (subjects, offer, exam dates, news) is read from Postgres once and
// served from the cache until a tag is revalidated or `revalidate` seconds pass.
//
// Security:
// * The database only lets members read these tables (is_member(), RLS), and the app has no
//   service-role key. So a cache miss reads with the access token of the member who caused it,
//   and only after requireAccount() verified that member in this same request. A cache hit is
//   also served only after that check: nobody without an account gets cached data.
// * The cached value never depends on who read it: queries filter what admins could see on top
//   of students (visible = true, hidden_at is null) explicitly, and nothing per user is cached here.
// * Keys and tags come from keys.ts: one entry per plan (and term).

/** The verified member's access token, once per request. Redirects to /ingresar without a session. */
const memberToken = cache(async (): Promise<string> => {
  await requireAccount();
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) redirect("/ingresar");
  return token;
});

/** Client without cookies (cached functions cannot read them) that queries as the given member. */
function tokenClient(token: string): SupabaseClient {
  const { url, key } = supabaseEnv();
  return createSupabaseClient(url, key, { accessToken: async () => token });
}

/**
 * Reads shared data through the cache. `read` must return plain JSON (no Map, Set or Date) and
 * must not depend on the user: it gets a client, not the user's id.
 */
export async function sharedRead<T>(spec: CacheSpec, read: (db: SupabaseClient) => Promise<T>): Promise<T> {
  const token = await memberToken();
  return unstable_cache(() => read(tokenClient(token)), spec.key, { tags: spec.tags, revalidate: spec.revalidate })();
}

/**
 * After a write (Server Actions and Route Handlers): the next read of these tags goes to the
 * database instead of serving the old value.
 */
export function expireTags(...tags: string[]): void {
  for (const tag of new Set(tags)) revalidateTag(tag, { expire: 0 });
}
