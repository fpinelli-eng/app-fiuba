// Career map logic (prototypes 06-mapa and 03-primera-carga). Pure functions: no database,
// no React, so they can be tested and reused by the home screen.

export type SubjectKind =
  | "cbc_subject"
  | "cbc"
  | "required"
  | "elective"
  | "orientation"
  | "final_project"
  | "final_option";

export type SubjectStatus = "approved" | "final_pending" | "in_progress";

/** What the map shows: the student's status, or whether they can take it. */
export type DisplayState = SubjectStatus | "enabled" | "blocked";

export interface Subject {
  id: number;
  code: string;
  name: string;
  credits: number;
  kind: SubjectKind;
  /** FIUBA Map category; for orientation subjects, the orientation name. */
  category: string;
  /** Suggested term (map column). null for electives and final work. */
  level: number | null;
  requiredCredits: number | null;
  requiresCbc: boolean;
  prerequisites: number[];
  sort: number;
  /** Elective area ("Energía"), when the plan defines them (data/planes/areas.json). */
  area?: { name: string; sort: number } | null;
}

export interface Requirement {
  id: number;
  name: string;
  shortName: string;
}

export interface Progress {
  subjects: Map<number, { status: SubjectStatus; grade: number | null }>;
  /** Approved requirements. */
  requirements: Set<number>;
}

/** One box in the map or one row in the electives panel. */
export type MapItem =
  | { key: string; type: "subject"; subject: Subject }
  | { key: string; type: "requirement"; requirement: Requirement };

export const subjectKey = (id: number) => `s${id}`;
export const requirementKey = (id: number) => `r${id}`;

export const GRADES = [4, 5, 6, 7, 8, 9, 10] as const;

export const STATE_LABEL: Record<DisplayState, string> = {
  approved: "Aprobada",
  final_pending: "Final pendiente",
  in_progress: "Cursando",
  enabled: "Habilitada",
  blocked: "Bloqueada",
};

const isElectiveKind = (k: SubjectKind) => k === "elective" || k === "orientation";

export class CareerMap {
  readonly subjects: Subject[];
  readonly requirements: Requirement[];
  readonly byId: Map<number, Subject>;
  /** The node that stands for the whole CBC (FIUBA Map id "CBC"). */
  readonly cbcNode: Subject | null;
  readonly cbcSubjects: Subject[];

  constructor(subjects: Subject[], requirements: Requirement[]) {
    this.subjects = [...subjects].sort((a, b) => a.sort - b.sort);
    this.requirements = requirements;
    this.byId = new Map(this.subjects.map((s) => [s.id, s]));
    this.cbcNode = this.subjects.find((s) => s.kind === "cbc") ?? null;
    this.cbcSubjects = this.subjects.filter((s) => s.kind === "cbc_subject");
  }

  // Progress ---------------------------------------------------------------

  status(progress: Progress, id: number): SubjectStatus | null {
    if (this.cbcNode && id === this.cbcNode.id) return this.cbcComplete(progress) ? "approved" : null;
    return progress.subjects.get(id)?.status ?? null;
  }

  cbcComplete(progress: Progress): boolean {
    return this.cbcSubjects.length > 0 && this.cbcSubjects.every((s) => progress.subjects.get(s.id)?.status === "approved");
  }

  cbcApprovedCount(progress: Progress): number {
    return this.cbcSubjects.filter((s) => progress.subjects.get(s.id)?.status === "approved").length;
  }

  /** Credits of approved subjects (the CBC included). */
  approvedCredits(progress: Progress, filter?: (s: Subject) => boolean): number {
    let total = 0;
    for (const s of this.subjects) {
      if (s.kind === "cbc") continue;
      if (filter && !filter(s)) continue;
      if (progress.subjects.get(s.id)?.status === "approved") total += s.credits;
    }
    return total;
  }

  electiveCredits(progress: Progress): number {
    return this.approvedCredits(progress, (s) => s.kind === "elective");
  }

  /** Average of approved grades, CBC included. null if there are none. */
  average(progress: Progress): number | null {
    let sum = 0;
    let n = 0;
    for (const s of this.subjects) {
      const p = progress.subjects.get(s.id);
      if (p?.status === "approved" && p.grade !== null) {
        sum += p.grade;
        n += 1;
      }
    }
    return n ? sum / n : null;
  }

  displayState(progress: Progress, id: number, credits = this.approvedCredits(progress)): DisplayState {
    const own = this.status(progress, id);
    if (own) return own;
    const s = this.byId.get(id);
    if (!s) return "blocked";
    if (s.kind === "cbc") return "blocked";
    const prereqsOk = s.prerequisites.every((p) => this.status(progress, p) === "approved");
    const creditsOk = credits >= (s.requiredCredits ?? 0);
    const cbcOk = !s.requiresCbc || this.cbcComplete(progress);
    return prereqsOk && creditsOk && cbcOk ? "enabled" : "blocked";
  }

  // Relations --------------------------------------------------------------

  /** Prerequisites with the CBC node replaced by its subjects (for highlighting). */
  expandedPrerequisites(id: number): number[] {
    const s = this.byId.get(id);
    if (!s) return [];
    return s.prerequisites.flatMap((p) => (this.cbcNode && p === this.cbcNode.id ? this.cbcSubjects.map((c) => c.id) : [p]));
  }

  /** Subjects that list this one as a prerequisite (through the CBC node for CBC subjects). */
  unlocks(id: number): Subject[] {
    return this.subjects.filter((s) => s.kind !== "cbc" && this.expandedPrerequisites(s.id).includes(id));
  }

  /** "Análisis Matemático II · Álgebra Lineal · 3 electivas" */
  unlockText(id: number): string {
    const s = this.byId.get(id);
    const list = this.unlocks(id);
    const main = list.filter((x) => !isElectiveKind(x.kind)).map((x) => x.name);
    const electives = list.filter((x) => isElectiveKind(x.kind)).length;
    if (electives) main.push(`${electives} ${electives === 1 ? "electiva" : "electivas"}`);
    if (!main.length) return "No es correlativa de ninguna materia";
    const text = main.join(" · ");
    return s?.kind === "cbc_subject" ? `Con el CBC completo: ${text}` : text;
  }

  // Layout ------------------------------------------------------------------

  /**
   * Map columns: the CBC, then one per suggested term. Final work (no term) and
   * requirements (English test) go at the end of the last column.
   */
  columns(): { cbc: MapItem[]; terms: { level: number; items: MapItem[] }[] } {
    const asItem = (s: Subject): MapItem => ({ key: subjectKey(s.id), type: "subject", subject: s });
    const cbc = this.cbcSubjects.map(asItem);
    const inMap = this.subjects.filter((s) => s.kind === "required" || s.kind === "final_project" || s.kind === "final_option");
    const levels = [...new Set(inMap.map((s) => s.level).filter((l): l is number => l !== null && l > 0))].sort((a, b) => a - b);
    if (levels.length === 0) levels.push(1);
    const terms = levels.map((level) => ({ level, items: inMap.filter((s) => s.level === level).map(asItem) }));
    const last = terms[terms.length - 1];
    last.items.push(...inMap.filter((s) => s.level === null || s.level <= 0).map(asItem));
    last.items.push(...this.requirements.map((r): MapItem => ({ key: requirementKey(r.id), type: "requirement", requirement: r })));
    return { cbc, terms };
  }

  /**
   * Electives for the side panel: by area when the plan defines them (in their order),
   * then one group per orientation. Without areas, plain electives go in a single list.
   */
  electiveGroups(): { name: string | null; items: Subject[] }[] {
    const electives = this.subjects.filter((s) => s.kind === "elective");
    const hasAreas = electives.some((s) => s.area);
    const byArea = new Map<string, { sort: number; items: Subject[] }>();
    const noArea: Subject[] = [];
    for (const s of electives) {
      if (!s.area) {
        noArea.push(s);
        continue;
      }
      const g = byArea.get(s.area.name) ?? { sort: s.area.sort, items: [] };
      g.items.push(s);
      byArea.set(s.area.name, g);
    }
    const groups: { name: string | null; items: Subject[] }[] = [...byArea.entries()]
      .sort((a, b) => a[1].sort - b[1].sort)
      .map(([name, g]) => ({ name, items: g.items }));
    if (noArea.length) groups.push({ name: hasAreas ? "Otras electivas" : null, items: noArea });

    const orientations = new Map<string, Subject[]>();
    for (const s of this.subjects) {
      if (s.kind !== "orientation") continue;
      orientations.set(s.category, [...(orientations.get(s.category) ?? []), s]);
    }
    groups.push(...[...orientations.entries()].map(([name, items]) => ({ name, items })));
    return groups;
  }

  /** Order of the guided first load: the CBC, then the map column by column. */
  loadSequence(): string[] {
    const { cbc, terms } = this.columns();
    return [...cbc, ...terms.flatMap((t) => t.items)].map((i) => i.key);
  }
}

// Formatting -----------------------------------------------------------------

/** 7.756 → "7,76" */
export function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(2).replace(".", ",");
}

/** credit_rules.electivas: a number, or { tesis, tpp } depending on the final work. */
export function electiveTarget(rules: unknown): string | null {
  const e = (rules as { electivas?: unknown } | null)?.electivas;
  if (typeof e === "number") return String(e);
  if (e && typeof e === "object") {
    const values = Object.values(e).filter((v): v is number => typeof v === "number");
    if (values.length) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      return min === max ? String(min) : `${min}–${max}`;
    }
  }
  return null;
}

export function totalCredits(rules: unknown): number | null {
  const t = (rules as { total?: unknown } | null)?.total;
  return typeof t === "number" ? t : null;
}

/** Search without accents or case: "logistica" finds "Logística". */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
