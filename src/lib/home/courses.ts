import { createClient } from "@/lib/supabase/server";
import { normalizeText, type Subject } from "@/lib/map/model";
import { titleCase } from "@/lib/plan/format";

// The student's courses of the current term, for the home calendar (prototype 04-inicio).
// They come from user_courses, which "Me inscribí en esta opción" fills in the Plan.

export type Campus = "PC" | "LH" | "CU";

export interface HomeBlock {
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
  /** Minutes from midnight. */
  start: number;
  end: number;
  campus: Campus | null;
  virtual: boolean;
  async: boolean;
}

export interface HomeCourse {
  offeringId: number;
  subject: string;
  credits: number;
  /** "C02" or "C01 A" */
  code: string;
  blocks: HomeBlock[];
}

export interface HomeCourses {
  /** "2C 2026" */
  term: string;
  courses: HomeCourse[];
}

type Row = {
  offerings: {
    id: number;
    term_id: string;
    siu_subject_code: string;
    siu_subject_name: string;
    course_number: string | null;
    practice: string | null;
    label: string;
    visible: boolean;
    offering_blocks: {
      weekday: number;
      starts_at: number;
      ends_at: number;
      room: string | null;
      campus: string | null;
      is_async: boolean;
    }[];
  } | null;
};

const CAMPUS = new Set(["PC", "LH", "CU"]);

/** null when there is no current term or the student did not enroll in anything this term. */
export async function getHomeCourses(userId: string, subjects: Subject[]): Promise<HomeCourses | null> {
  const supabase = await createClient();
  const term = await supabase.from("terms").select("id, year, half").eq("is_current", true).maybeSingle();
  if (term.error) throw new Error(`terms: ${term.error.message}`);
  if (!term.data) return null;

  const [taken, codes] = await Promise.all([
    supabase
      .from("user_courses")
      .select(
        "offerings!inner(id, term_id, siu_subject_code, siu_subject_name, course_number, practice, label, visible, offering_blocks(weekday, starts_at, ends_at, room, campus, is_async))",
      )
      .eq("user_id", userId)
      .eq("offerings.term_id", term.data.id as string),
    supabase.from("subject_siu_codes").select("subject_id, siu_code").in("subject_id", subjects.map((s) => s.id)),
  ]);
  if (taken.error) throw new Error(`user_courses: ${taken.error.message}`);
  if (codes.error) throw new Error(`subject_siu_codes: ${codes.error.message}`);

  const byId = new Map(subjects.map((s) => [s.id, s]));
  const byCode = new Map(codes.data.map((c) => [c.siu_code as string, byId.get(c.subject_id as number)]));
  const byName = new Map(subjects.map((s) => [normalizeText(s.name), s]));

  const courses = (taken.data as unknown as Row[])
    .map((r) => r.offerings)
    // A course an admin removed is not shown, like everywhere else for students.
    .filter((o): o is NonNullable<Row["offerings"]> => !!o && o.visible)
    .map((o) => {
      const subject = byCode.get(o.siu_subject_code) ?? byName.get(normalizeText(o.siu_subject_name));
      const number = o.course_number ? `C${o.course_number}` : o.label.split(" · ")[0];
      return {
        offeringId: o.id,
        subject: subject?.name ?? titleCase(o.siu_subject_name),
        credits: subject?.credits ?? 0,
        code: o.practice ? `${number} ${o.practice}` : number,
        blocks: o.offering_blocks.map((b) => ({
          weekday: b.weekday,
          start: b.starts_at,
          end: b.ends_at,
          campus: b.campus && CAMPUS.has(b.campus) ? (b.campus as Campus) : null,
          virtual: b.room !== null && /virtual|remot/i.test(b.room),
          async: b.is_async === true,
        })),
      };
    })
    .sort((a, b) => a.subject.localeCompare(b.subject, "es"));

  if (!courses.length) return null;
  return { term: `${term.data.half}C ${term.data.year}`, courses };
}
