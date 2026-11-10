import equivalences from "../../../data/sedes/equivalencias.json";
import table from "../../../data/sedes/materias.json";

// Fills in the campus of a class the SIU publishes without one ("Aula a determinar"), from the
// yearly table of campuses per subject (old-plan codes, data/sedes/materias.json) and the official
// equivalences between the old plans and the 2023/2024 ones (data/sedes/equivalencias.json).
// Only for blocks without a campus: the SIU always wins. Rules, in order (decided with Francisco,
// 10 Nov 2026, see data/sedes/README.md):
//   1. old-plan subject (code 6103 / 61.03): the table, by exact code;
//   2. new-plan subject: the campus of its official equivalents in the old plan;
//   3. no equivalence: a table subject with an almost identical name (similarity >= 90 %);
//   4. none when the equivalents are in different campuses, when equivalence and name disagree,
//      or when the table says "both campuses".

export type CampusCode = "PC" | "LH" | "CU";

interface TableEntry {
  code: string;
  name: string;
  /** "both": taught in Paseo Colón and Las Heras, so no single campus. */
  campus?: CampusCode | "both";
  /** "Según comisión": the campus depends on who teaches the course. */
  byTeacher?: { surnames: string[]; campus: CampusCode }[];
  otherwise?: CampusCode | null;
}

export interface OfferingForCampus {
  planId: string;
  siuCode: string;
  siuName: string;
  /** Teacher names and the offering label (the public SIU table only has the lead in the name). */
  teachers: string[];
}

const ENTRIES = table as TableEntry[];
const BY_CODE = new Map(ENTRIES.map((e) => [e.code, e]));
const SIMILARITY = 90;
const STOP = new Set(["DE", "LA", "LAS", "LOS", "EL", "Y", "E", "EN", "DEL", "A", "PARA", "AL"]);

const upper = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();

/** "Introducción a la Ingeniería (según comisión)" → "INTRODUCCION INGENIERIA". */
export function subjectKey(name: string): string {
  return upper(name)
    .replace(/\(SEGUN[^)]*\)/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .join(" ");
}

/** Same scale as rapidfuzz's ratio: 100 · 2 · LCS / (len a + len b). */
export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 100;
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = up;
    }
  }
  return (200 * prev[b.length]) / (a.length + b.length);
}

const KEYED = ENTRIES.map((e) => ({ key: subjectKey(e.name), entry: e }));
/** Table subjects by word: a 90 % match always shares a word, so only those are compared. */
const BY_WORD = new Map<string, typeof KEYED>();
for (const k of KEYED) for (const w of new Set(k.key.split(" "))) BY_WORD.set(w, [...(BY_WORD.get(w) ?? []), k]);

const EQUIVALENTS = new Map(
  Object.entries(equivalences as Record<string, { subjects: Record<string, string[]> }>).map(([plan, { subjects }]) => [
    plan,
    new Map(Object.entries(subjects).map(([name, codes]) => [subjectKey(name), codes.map((c) => c.replace(".", ""))])),
  ]),
);

/** The table subject with an almost identical name, or null; "ambiguous" if candidates disagree. */
const nameCache = new Map<string, TableEntry | "ambiguous" | null>();
function byName(name: string): TableEntry | "ambiguous" | null {
  const key = subjectKey(name);
  const cached = nameCache.get(key);
  if (cached !== undefined) return cached;
  const good: { score: number; entry: TableEntry }[] = [];
  const candidates = new Set(key.split(" ").flatMap((w) => BY_WORD.get(w) ?? []));
  for (const k of candidates) {
    // A ratio of 90 % needs both lengths within ~20 % of each other: skip the rest without the LCS.
    if (2 * Math.min(k.key.length, key.length) < 0.9 * (k.key.length + key.length)) continue;
    const score = similarity(key, k.key);
    if (score >= SIMILARITY) good.push({ score, entry: k.entry });
  }
  good.sort((a, b) => b.score - a.score);
  const kinds = new Set(good.map((g) => g.entry.campus ?? JSON.stringify(g.entry.byTeacher)));
  const out = good.length === 0 ? null : kinds.size > 1 ? "ambiguous" : good[0].entry;
  nameCache.set(key, out);
  return out;
}

function campusOf(entry: TableEntry, teachers: string[]): CampusCode | null {
  if (entry.byTeacher) {
    const who = upper(teachers.join(" "));
    const hit = entry.byTeacher.find((t) => t.surnames.some((s) => who.includes(s)));
    return hit ? hit.campus : (entry.otherwise ?? null);
  }
  return entry.campus === "both" || !entry.campus ? null : entry.campus;
}

/** The campus to show for a class without one in the SIU, or null when the data does not settle it. */
export function inferCampus(o: OfferingForCampus): CampusCode | null {
  const code = o.siuCode.replace(".", "");
  if (/^\d{4}$/.test(code)) {
    const entry = BY_CODE.get(code);
    return entry ? campusOf(entry, o.teachers) : null;
  }
  const olds = EQUIVALENTS.get(o.planId)?.get(subjectKey(o.siuName));
  let equivalent: CampusCode | null = null;
  if (olds) {
    const found = new Set<CampusCode>();
    for (const c of olds) {
      const entry = BY_CODE.get(c);
      const campus = entry && campusOf(entry, o.teachers);
      if (campus) found.add(campus);
    }
    if (found.size > 1) return null;
    equivalent = found.size === 1 ? [...found][0] : null;
  }
  const named = byName(o.siuName);
  const byNameCampus = named && named !== "ambiguous" ? campusOf(named, o.teachers) : null;
  if (equivalent && byNameCampus && equivalent !== byNameCampus) return null;
  return equivalent ?? byNameCampus;
}

/** inferCampus for every class without a campus; the ones the SIU placed, virtual and asynchronous keep theirs. */
export function withCampus<B extends { campus: CampusCode | null; async?: boolean; room?: string | null }>(
  blocks: B[],
  offering: OfferingForCampus,
): B[] {
  const open = (b: B) => !b.campus && !b.async && !(b.room && /virtual|remot/i.test(b.room));
  if (!blocks.some(open)) return blocks;
  const guess = inferCampus(offering);
  return guess ? blocks.map((b) => (open(b) ? { ...b, campus: guess } : b)) : blocks;
}

/** What inferCampus needs, from an `offerings` row. */
export function campusQuery(
  planId: string,
  o: { siu_subject_code: string; siu_subject_name: string; label?: string | null; teachers?: { nombre: string }[] | null },
): OfferingForCampus {
  const teachers = (o.teachers ?? []).map((t) => t.nombre);
  if (o.label) teachers.push(o.label);
  return { planId, siuCode: o.siu_subject_code, siuName: o.siu_subject_name, teachers };
}
