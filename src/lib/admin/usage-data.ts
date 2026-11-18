import { createClient } from "@/lib/supabase/server";
import { SITE_URL, toDeployments, toUsage, type DeploymentsResult, type SiteCheck, type Usage } from "./usage";

// Undefined function or table: the migration 20261118150000_admin_uso is not applied yet (Vercel
// previews use the production database, which only gets it when the branch is merged).
const NOT_YET = new Set(["42883", "PGRST202", "42P01", "PGRST205"]);

const TIMEOUT_MS = 3000;

/** admin_uso() (null before the migration), how long the round trip took and when it was read. */
export async function getUsage(): Promise<{ usage: Usage | null; dbMs: number; readAt: number }> {
  const supabase = await createClient();
  const start = performance.now();
  const { data, error } = await supabase.rpc("admin_uso");
  const dbMs = Math.round(performance.now() - start);
  if (error) {
    if (NOT_YET.has(error.code)) return { usage: null, dbMs, readAt: Date.now() };
    throw new Error(`admin_uso: ${error.message}`);
  }
  return { usage: data && typeof data === "object" ? toUsage(data as Record<string, unknown>) : null, dbMs, readAt: Date.now() };
}

/** A HEAD request to the public site, 3 s at most. */
export async function checkSite(): Promise<SiteCheck> {
  const start = performance.now();
  try {
    const res = await fetch(SITE_URL, {
      method: "HEAD",
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { ok: res.status < 400, status: res.status, ms: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, status: null, ms: null };
  }
}

/**
 * The last 5 deployments from the Vercel API, only with VERCEL_TOKEN and VERCEL_PROJECT_ID (and
 * VERCEL_TEAM_ID if the project belongs to a team). Server only: the token never reaches the browser.
 */
export async function getDeployments(): Promise<DeploymentsResult> {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return { kind: "missing" };
  const params = new URLSearchParams({ projectId, limit: "5" });
  if (process.env.VERCEL_TEAM_ID) params.set("teamId", process.env.VERCEL_TEAM_ID);
  try {
    const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { kind: "error", message: `Vercel respondió ${res.status}.` };
    return { kind: "ok", deployments: toDeployments(await res.json()) };
  } catch {
    return { kind: "error", message: "Vercel no respondió a tiempo." };
  }
}
