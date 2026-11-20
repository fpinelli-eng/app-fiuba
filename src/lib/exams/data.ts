import { cache } from "react";
import { getSharedPlan } from "@/lib/cache/catalog";
import { SPEC } from "@/lib/cache/keys";
import { sharedRead } from "@/lib/cache/shared";
import { getMapData } from "@/lib/map/data";
import { getMyReminders } from "@/lib/reminders/data";
import { createClient } from "@/lib/supabase/server";
import { groupExamTables, type ExamTableRow } from "./group";
import type { FinalsData } from "./types";

/** Now in Buenos Aires as "YYYY-MM-DDTHH:MM". */
function buenosAiresNow(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", hour12: false })
    .replace(" ", "T")
    .slice(0, 16);
}

// Data for the Finales section: the plan's upcoming exam tables by subject and the student's pending finals.
export async function getFinalsData(userId: string, planId: string): Promise<FinalsData> {
  const now = buenosAiresNow();
  const today = now.slice(0, 10);
  const supabase = await createClient();

  const [map, plan, exams, reminders] = await Promise.all([
    getMapData(userId, planId),
    getSharedPlan(planId),
    getPlanExams(planId, today),
    getMyReminders(supabase),
  ]);

  const pendingIds = new Set(map.progress.subjects.filter((p) => p.status === "final_pending").map((p) => p.subjectId));
  const { all, pending } = groupExamTables({
    rows: exams.upcoming,
    subjects: map.subjects.map((s) => ({ id: s.id, name: s.name })),
    subjectByCode: new Map(plan.siuCodes.map((c) => [c.siu_code, c.subject_id])),
    pendingIds: map.subjects.filter((s) => pendingIds.has(s.id)).map((s) => s.id),
  });

  return { now, planId, loaded: exams.loaded, pending, all, reminders };
}

/**
 * The plan's exam tables from `today` and whether it has any loaded, from the shared cache. The
 * daily SIU sync writes from GitHub Actions and cannot revalidate: entries last an hour at most
 * (keys.ts); "Fechas de examen" in Administración revalidates the plan at once.
 */
const getPlanExams = cache((planId: string, today: string) =>
  sharedRead(SPEC.examTables(planId, today), async (db) => {
    const [upcoming, loadedCount] = await Promise.all([
      db
        .from("exam_tables")
        .select("id, siu_subject_code, siu_subject_name, name, exam_date, kind, enroll_from, enroll_to, start_time, end_time, room, drop_until, teachers")
        .eq("plan_id", planId)
        .gte("exam_date", today)
        .order("exam_date")
        .order("start_time", { nullsFirst: true })
        .order("name"),
      db.from("exam_tables").select("id", { count: "exact", head: true }).eq("plan_id", planId),
    ]);
    if (upcoming.error) throw new Error(`exam_tables: ${upcoming.error.message}`);
    if (loadedCount.error) throw new Error(`exam_tables: ${loadedCount.error.message}`);
    return { upcoming: upcoming.data as ExamTableRow[], loaded: (loadedCount.count ?? 0) > 0 };
  }),
);
