// Who has the app open right now, with Supabase Realtime Presence: it lives in the memory of the
// Realtime service, so it writes nothing and reads nothing from Postgres.
//
// * Each signed-in student with a visible tab joins the channel of their plan ("presencia:<plan id>")
//   and tracks only { since } under a random key kept in their browser (localStorage), so tabs of
//   the same browser count once. No user id, name or mail ever goes to Realtime.
// * One channel per plan instead of one for everybody: every join and leave is sent to everyone in
//   the same channel, so smaller channels mean far fewer Realtime messages (free plan: 2M a month).
// * Administración → Usuarios listens to every plan's channel without tracking itself.
// Pure helpers here (tested in presence.test.ts); the components are OnlinePresence and LiveOnline.

export const PRESENCE_PREFIX = "presencia:";

/** "presencia:informatica-2023". */
export function presenceTopic(planId: string): string {
  return `${PRESENCE_PREFIX}${planId}`;
}

/** What each tab tracks: when it joined (ms, rounded to the minute). Nothing else. */
export interface PresencePayload {
  since: number;
}

const KEY_STORAGE = "fiubi_presencia";

/**
 * A random key for this browser (localStorage), so two tabs count once. Has nothing to do with the
 * account. If storage is blocked, a new random key for this tab.
 */
export function browserPresenceKey(storage: Pick<Storage, "getItem" | "setItem"> | null, random: () => string): string {
  try {
    const saved = storage?.getItem(KEY_STORAGE);
    if (saved && /^[\w-]{8,64}$/.test(saved)) return saved;
    const key = random();
    storage?.setItem(KEY_STORAGE, key);
    return key;
  } catch {
    return random();
  }
}

export interface OnlineSummary {
  total: number;
  byCareer: { id: string; name: string; count: number }[];
}

/**
 * Online people from the presence keys of each plan's channel. A key seen in two channels (someone
 * who changed career with two tabs open) counts once, in the first. Careers sorted by count, then name.
 */
export function summarizeOnline(
  keysByPlan: Record<string, readonly string[]>,
  careerOfPlan: ReadonlyMap<string, { id: string; name: string }>,
): OnlineSummary {
  const seen = new Set<string>();
  const counts = new Map<string, { id: string; name: string; count: number }>();
  for (const [planId, keys] of Object.entries(keysByPlan)) {
    const career = careerOfPlan.get(planId) ?? { id: planId, name: planId };
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      const row = counts.get(career.id) ?? { ...career, count: 0 };
      row.count++;
      counts.set(career.id, row);
    }
  }
  const byCareer = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "es"));
  return { total: seen.size, byCareer };
}
