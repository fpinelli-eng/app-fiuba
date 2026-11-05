import { getMapData } from "@/lib/map/data";
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

  const [map, upcoming, loadedCount] = await Promise.all([
    getMapData(userId, planId),
    supabase
      .from("exam_tables")
      .select("id, siu_subject_code, siu_subject_name, name, exam_date, kind, enroll_from, enroll_to, start_time, end_time, room, drop_until, teachers")
      .eq("plan_id", planId)
      .gte("exam_date", today)
      .order("exam_date")
      .order("start_time", { nullsFirst: true })
      .order("name"),
    supabase.from("exam_tables").select("id", { count: "exact", head: true }).eq("plan_id", planId),
  ]);
  if (upcoming.error) throw new Error(`exam_tables: ${upcoming.error.message}`);
  if (loadedCount.error) throw new Error(`exam_tables: ${loadedCount.error.message}`);

  const { data: codes, error } = await supabase
    .from("subject_siu_codes")
    .select("subject_id, siu_code")
    .in("subject_id", map.subjects.map((s) => s.id));
  if (error) throw new Error(`subject_siu_codes: ${error.message}`);

  const pendingIds = new Set(map.progress.subjects.filter((p) => p.status === "final_pending").map((p) => p.subjectId));
  const { all, pending } = groupExamTables({
    rows: upcoming.data as ExamTableRow[],
    subjects: map.subjects.map((s) => ({ id: s.id, name: s.name })),
    subjectByCode: new Map(codes.map((c) => [c.siu_code as string, c.subject_id as number])),
    pendingIds: map.subjects.filter((s) => pendingIds.has(s.id)).map((s) => s.id),
  });

  return { now, loaded: (loadedCount.count ?? 0) > 0, pending, all };
}
