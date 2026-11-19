import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { siuExamsUrl } from "../siu/exams-fetch";
import { parseSiuExamsHtml } from "../siu/exams-html";
import {
  changesSql,
  checkedSql,
  checkPlanSync,
  checkSync,
  diffExamRows,
  groupFilters,
  normalizeRow,
  planExamChanges,
  planWrite,
  siuSearchUrl,
  storedRow,
  summaryMarkdown,
  validateFilters,
  writtenRows,
  type ExamFilter,
  type StoredRow,
  type SyncRow,
} from "./siu-sync";

const page = readFileSync(new URL("../../../data/siu/examenes_industrial-2023.html", import.meta.url), "latin1");
const filtersFile = JSON.parse(readFileSync(new URL("../../../data/siu/exam-filters.json", import.meta.url), "utf8"));
const planes = JSON.parse(readFileSync(new URL("../../../data/planes/planes.json", import.meta.url), "utf8")) as {
  plans: { id: string; year: number; current: boolean }[];
};

const industrial: ExamFilter = {
  planId: "industrial-2023",
  career: { id: "74fc1130669c477e394f0fbe153f60695719f487", name: "Ingeniería Industrial" },
  plan: { id: "f05dbadc669a65f8f48d2562f5b0242a3c2bef3d", name: "2023" },
};

describe("data/siu/exam-filters.json", () => {
  const filters = validateFilters(filtersFile);

  // The SIU names some old plans differently: "86V14" is Sistemas 1986 modified in 2014, and the
  // only old plan of Agrimensura in the SIU is "1986" (FIUBA Map's 2006, same subject codes).
  const SIU_PLAN_NAMES: Record<string, string> = { "sistemas-2014": "86V14", "agrimensura-2006": "1986" };

  it("maps every current plan of the app, and only plans of the app", () => {
    const mapped = new Set(filters.plans.map((p) => p.planId));
    const current = planes.plans.filter((p) => p.current).map((p) => p.id);
    expect(current.length).toBeGreaterThan(10);
    for (const id of current) expect(mapped).toContain(id);
    const ids = new Set(planes.plans.map((p) => p.id));
    for (const id of mapped) expect(ids).toContain(id);
  });

  it("asks the SIU for each plan's year", () => {
    for (const p of filters.plans) {
      // "1986M", "1986N": variants of the 1986 plans.
      if (SIU_PLAN_NAMES[p.planId]) expect(p.plan.name).toBe(SIU_PLAN_NAMES[p.planId]);
      else expect(p.plan.name).toMatch(new RegExp(`^${p.planId.slice(-4)}[A-Z]?$`));
    }
  });

  it("builds links the admin screen would accept", () => {
    for (const p of filters.plans) {
      const checked = siuExamsUrl(siuSearchUrl(filters, p));
      expect(checked).toHaveProperty("url");
      const url = new URL((checked as { url: string }).url);
      expect(url.searchParams.get("formulario_filtro[carrera]")).toBe(p.career.id);
      expect(url.searchParams.get("formulario_filtro[plan]")).toBe(p.plan.id);
      expect(url.searchParams.get("formulario_filtro[ubicacion]")).toBe(filters.ubicacion);
    }
  });
});

describe("validateFilters", () => {
  const ok = { ra: "a".repeat(40), ubicacion: "b".repeat(40), plans: [{ ...industrial }] };

  it("accepts a well-formed file", () => {
    expect(validateFilters(ok).plans).toHaveLength(1);
  });

  it("rejects bad ids, repeated plans and missing names", () => {
    expect(() => validateFilters({ ...ok, ra: "3b5e" })).toThrow(/ra o ubicacion/);
    expect(() => validateFilters({ ...ok, plans: [industrial, industrial] })).toThrow(/dos veces/);
    expect(validateFilters({ ...ok, plans: [industrial, { ...industrial, plan: { id: "c".repeat(40), name: "2011" } }] }).plans).toHaveLength(2);
    expect(() => validateFilters({ ...ok, plans: [{ ...industrial, plan: { id: "c".repeat(40), name: " " } }] })).toThrow(/plan incompleto/);
    expect(() => validateFilters({ ...ok, plans: [] })).toThrow(/no hay planes/);
    expect(() => validateFilters(null)).toThrow();
  });
});

describe("checkSync", () => {
  const parsed = parseSiuExamsHtml(page);

  it("turns the real Industrial page into rows", () => {
    const check = checkSync(parsed, industrial);
    expect("rows" in check && check.rows).toHaveLength(131);
    const rows = (check as { rows: SyncRow[] }).rows;
    expect(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.exam_date))).toBe(true);
    expect(rows.some((r) => r.start_time !== null && r.teachers !== null)).toBe(true);
  });

  it("skips a page of another career or plan", () => {
    expect(checkSync(parsed, { ...industrial, career: { ...industrial.career, name: "Ingeniería Química" } })).toEqual({
      skip: "el SIU no devolvió la carrera y el plan pedidos",
    });
    expect(checkSync(parsed, { ...industrial, plan: { ...industrial.plan, name: "2011" } })).toHaveProperty("skip");
  });

  it("ignores accents and case in the names", () => {
    expect(checkSync(parsed, { ...industrial, career: { ...industrial.career, name: "INGENIERIA INDUSTRIAL" } })).toHaveProperty("rows");
  });

  it("never publishes an empty search or an error page", () => {
    expect(checkSync({ ...parsed, subjects: [] }, industrial)).toEqual({ skip: "el SIU no devolvió mesas" });
    expect(checkSync(parseSiuExamsHtml("<html><body>Error</body></html>"), industrial)).toHaveProperty("skip");
  });
});

describe("groupFilters and checkPlanSync", () => {
  const parsed = parseSiuExamsHtml(page);
  const other: ExamFilter = { ...industrial, plan: { id: "c".repeat(40), name: "2023" } };

  it("groups the searches of each plan", () => {
    const groups = groupFilters([industrial, { ...industrial, planId: "quimica-2023" }, other]);
    expect([...groups.keys()]).toEqual(["industrial-2023", "quimica-2023"]);
    expect(groups.get("industrial-2023")).toEqual([industrial, other]);
  });

  it("keeps a table shown by two searches once", () => {
    const one = checkPlanSync([{ parsed, filter: industrial }]) as { rows: SyncRow[] };
    const both = checkPlanSync([{ parsed, filter: industrial }, { parsed, filter: other }]);
    expect(one.rows).toHaveLength(131);
    expect(both).toEqual(one);
  });

  it("adds the tables of each search", () => {
    const half = { ...parsed, subjects: parsed.subjects.slice(0, 3) };
    const rest = { ...parsed, subjects: parsed.subjects.slice(3) };
    const merged = checkPlanSync([{ parsed: half, filter: industrial }, { parsed: rest, filter: other }]);
    expect("rows" in merged && merged.rows).toHaveLength(131);
  });

  it("allows an empty search next to one with tables, never a page of another plan", () => {
    const empty = { ...parsed, subjects: [] };
    expect(checkPlanSync([{ parsed: empty, filter: industrial }, { parsed, filter: other }])).toHaveProperty("rows");
    expect(checkPlanSync([{ parsed: empty, filter: industrial }])).toEqual({ skip: "el SIU no devolvió mesas" });
    const wrong = { ...industrial, plan: { ...industrial.plan, name: "2011" } };
    expect(checkPlanSync([{ parsed, filter: industrial }, { parsed, filter: wrong }])).toHaveProperty("skip");
  });
});

const row = (over: Partial<SyncRow> = {}): SyncRow => ({
  siu_subject_code: "TC010",
  siu_subject_name: "ECONOMÍA",
  name: "MESA 01",
  exam_date: "2026-12-11",
  kind: "Regular",
  enroll_from: "2026-11-16T08:00",
  enroll_to: "2026-12-09T23:59",
  start_time: "17:00",
  end_time: "20:00",
  room: null,
  drop_until: null,
  teachers: "SURACE PABLO ESTEBAN (Profesor/a)",
  ...over,
});

describe("normalizeRow", () => {
  it("reads the database formats as the parser's", () => {
    expect(
      normalizeRow({
        plan_id: "industrial-2023",
        ...row(),
        exam_date: "2026-12-11T00:00:00",
        enroll_from: "2026-11-16 08:00:00",
        enroll_to: "2026-12-09T23:59:00",
        start_time: "17:00:00",
        end_time: "20:00:00",
        room: undefined,
      }),
    ).toEqual(row());
  });
});

describe("diffExamRows", () => {
  it("finds nothing when the SIU did not change", () => {
    const rows = [row(), row({ name: "MESA 02" })];
    expect(diffExamRows(rows, [...rows].reverse())).toEqual({ added: 0, removed: 0, changed: 0, unchanged: 2 });
  });

  it("counts new, removed and changed tables", () => {
    const before = [row(), row({ name: "MESA 02" }), row({ name: "MESA 03" })];
    const after = [row({ room: "Aula 301" }), row({ name: "MESA 02" }), row({ name: "MESA 04" }), row({ name: "MESA 05" })];
    expect(diffExamRows(before, after)).toEqual({ added: 2, removed: 1, changed: 1, unchanged: 1 });
  });

  it("takes a new day as a removed and an added table", () => {
    expect(diffExamRows([row()], [row({ exam_date: "2026-12-18" })])).toEqual({ added: 1, removed: 1, changed: 0, unchanged: 0 });
  });

  it("pairs repeated tables (same name, kind and day) one by one", () => {
    const before = [row(), row(), row({ room: "A" })];
    const after = [row(), row({ room: "B" })];
    expect(diffExamRows(before, after)).toEqual({ added: 0, removed: 1, changed: 1, unchanged: 1 });
  });

  it("counts everything as new for a plan without dates", () => {
    expect(diffExamRows([], [row(), row({ kind: "Libre" })])).toEqual({ added: 2, removed: 0, changed: 0, unchanged: 0 });
  });
});

describe("storedRow", () => {
  it("keeps the id of a database row", () => {
    expect(storedRow({ id: 42, plan_id: "industrial-2023", ...row() })).toEqual({ id: 42, ...row() });
  });

  it("rejects rows without a valid id", () => {
    expect(() => storedRow({ ...row() })).toThrow(/id inválido/);
    expect(() => storedRow({ id: "1; drop table x", ...row() })).toThrow(/id inválido/);
    expect(() => storedRow({ id: -3, ...row() })).toThrow(/id inválido/);
  });
});

describe("planExamChanges", () => {
  const stored = (id: number, over: Partial<SyncRow> = {}): StoredRow => ({ ...row(over), id });

  it("writes nothing when the SIU did not change", () => {
    const before = [stored(1), stored(2, { name: "MESA 02" })];
    const c = planExamChanges(before, [row({ name: "MESA 02" }), row()]);
    expect(c).toEqual({ diff: { added: 0, removed: 0, changed: 0, unchanged: 2 }, inserts: [], updates: [], deletes: [] });
  });

  it("inserts the new tables, deletes the removed ones and updates the changed ones by id", () => {
    const before = [stored(10), stored(11, { name: "MESA 02" }), stored(12, { name: "MESA 03" })];
    const after = [row({ room: "Aula 301" }), row({ name: "MESA 02" }), row({ name: "MESA 04" })];
    const c = planExamChanges(before, after);
    expect(c.updates).toEqual([{ ...row({ room: "Aula 301" }), id: 10 }]);
    expect(c.inserts).toEqual([row({ name: "MESA 04" })]);
    expect(c.deletes).toEqual([12]);
    expect(c.diff).toEqual({ added: 1, removed: 1, changed: 1, unchanged: 1 });
  });

  it("keeps the natural key of reminders on an update: only the details change", () => {
    const before = [stored(7, { start_time: "17:00", enroll_to: "2026-12-09T23:59" })];
    const after = [row({ start_time: "18:00", enroll_to: "2026-12-10T23:59", teachers: "OTRO DOCENTE" })];
    const [update] = planExamChanges(before, after).updates;
    const key = (r: SyncRow) => [r.siu_subject_code, r.name, r.kind, r.exam_date];
    expect(update.id).toBe(7);
    expect(key(update)).toEqual(key(before[0]));
    expect(update.start_time).toBe("18:00");
  });

  it("deletes and inserts when the day moves (another key: reminders of the old day stay pending)", () => {
    const c = planExamChanges([stored(5)], [row({ exam_date: "2026-12-18" })]);
    expect(c.updates).toEqual([]);
    expect(c.deletes).toEqual([5]);
    expect(c.inserts).toEqual([row({ exam_date: "2026-12-18" })]);
  });

  it("pairs repeated tables one by one, in the database's order", () => {
    const before = [stored(1), stored(2), stored(3, { room: "A" })];
    const after = [row(), row({ room: "B" })];
    const c = planExamChanges(before, after);
    expect(c.updates).toEqual([{ ...row({ room: "B" }), id: 2 }]);
    expect(c.deletes).toEqual([3]);
    expect(c.inserts).toEqual([]);
  });

  it("inserts every table of a plan without dates", () => {
    const c = planExamChanges([], [row(), row({ kind: "Libre" })]);
    expect(c.inserts).toHaveLength(2);
    expect(c.updates).toEqual([]);
    expect(c.deletes).toEqual([]);
  });
});

describe("planWrite and changesSql", () => {
  const before: StoredRow[] = [{ ...row(), id: 1 }, { ...row({ name: "MESA 02" }), id: 2 }];
  const after = [row({ room: "Aula 301" }), row({ name: "MESA 03", exam_date: "2027-02-20", siu_subject_code: "TC011" })];
  const write = planWrite("industrial-2023", before, after, planExamChanges(before, after));
  const apply = "C:\\repo\\tools\\exams\\apply.sql";

  it("sends only the changed rows, the stats of the whole plan and how many rows it had", () => {
    expect(write).toEqual({
      plan_id: "industrial-2023",
      stats: { subjects: 2, tables: 2, from: "2026-12-11", to: "2027-02-20" },
      before: 2,
      inserts: [after[1]],
      updates: [{ ...after[0], id: 1 }],
      deletes: [2],
    });
    expect(writtenRows([write, write])).toBe(6);
  });

  it("without changes writes only checked_at, in one transaction", () => {
    const sql = changesSql([], ["industrial-2023"], apply, "exams_abc");
    expect(sql).toContain("begin;");
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
    expect(sql).toContain("-- Sin cambios en las fechas.");
    expect(sql).not.toContain("exams.payload");
    expect(sql).not.toContain("apply.sql");
    expect(sql).toContain("update public.exam_imports set checked_at = now() where plan_id in ('industrial-2023');");
    expect(sql.match(/\b(insert|delete)\b/gi)).toBeNull();
  });

  it("with changes sets the payload for the transaction only and includes apply.sql before the commit", () => {
    const sql = changesSql([write], ["industrial-2023", "civil-2023"], apply, "exams_abc");
    const lines = sql.split("\n");
    expect(lines[0]).toBe("\\set ON_ERROR_STOP on");
    expect(lines[1]).toBe("begin;");
    expect(lines[2]).toBe(`select length(set_config('exams.payload', $exams_abc$${JSON.stringify({ plans: [write] })}$exams_abc$, true)) as payload_chars;`);
    expect(lines[3]).toBe("\\i 'C:/repo/tools/exams/apply.sql'");
    expect(sql.indexOf("checked_at = now()")).toBeGreaterThan(sql.indexOf("\\i "));
    expect(sql.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("keeps the payload and the path quoted", () => {
    const tricky = { ...write, inserts: [row({ teachers: "O'BRIEN $x$ (Profesor/a)" })] };
    expect(() => changesSql([tricky], [], apply, "x")).toThrow(/Etiqueta/);
    expect(() => changesSql([write], [], apply, "bad tag$")).toThrow(/Etiqueta/);
    const sql = changesSql([tricky], [], "/tmp/it's/apply.sql", "exams_abc");
    expect(sql).toContain("\\i '/tmp/it''s/apply.sql'");
    expect(sql).toContain("$exams_abc$" + JSON.stringify({ plans: [tricky] }) + "$exams_abc$");
  });
});

describe("summaryMarkdown", () => {
  it("lists counts per plan, never names", () => {
    const md = summaryMarkdown(
      [
        { planId: "industrial-2023", tables: 240, diff: { added: 3, removed: 1, changed: 2, unchanged: 236 } },
        { planId: "quimica-2023", tables: 157, diff: { added: 0, removed: 0, changed: 0, unchanged: 157 } },
        { planId: "civil-2023", skip: "el SIU no devolvió mesas" },
      ],
      false,
    );
    expect(md).toContain("2 de 3 planes leídos; 1 con cambios se actualizaron.");
    expect(md).toContain("| industrial-2023 | 240 | +3 nuevas, −1 quitadas, 2 cambiadas |");
    expect(md).toContain("| quimica-2023 | 157 | sin cambios |");
    expect(md).toContain("| civil-2023 | — | salteado: el SIU no devolvió mesas |");
  });

  it("adds how many rows were written", () => {
    const ok = { planId: "industrial-2023", tables: 240, diff: { added: 3, removed: 1, changed: 2, unchanged: 236 } };
    expect(summaryMarkdown([ok], false, 6)).toContain("1 de 1 planes leídos; 1 con cambios se actualizaron (6 filas escritas en exam_tables).");
    expect(summaryMarkdown([ok], false, 1)).toContain("(1 fila escrita en exam_tables).");
  });

  it("says when nothing was saved", () => {
    expect(summaryMarkdown([{ planId: "industrial-2023", tables: 240, diff: null }], true)).toContain("Prueba: 1 de 1 planes leídos");
  });
});

describe("checkedSql", () => {
  it("marks the plans read, only with safe ids, and nothing without plans", () => {
    const sql = checkedSql(["industrial-2023", "civil-2023", "x'); drop table y; --"]);
    expect(sql).toContain("where plan_id in ('industrial-2023', 'civil-2023');");
    expect(sql).not.toContain("drop table");
    expect(sql).toContain("column_name = 'checked_at'");
    expect(checkedSql([])).toBe("-- Ningún plan leído.");
  });
});
