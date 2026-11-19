// Reads the SIU's public "Fechas de examen" search of every plan in data/siu/exam-filters.json and
// writes the SQL that inserts, updates and deletes only the exam tables that changed, for the workflow
// "Fechas de examen del SIU" (tools/exams/README.md). Run with:
//
//   node --experimental-strip-types tools/exams/sync.mjs [--current current.json] [--sql apply.sql]
//        [--summary summary.md] [--only industrial-2023,quimica-2023]
//
// Without --current it is a dry run: it downloads and parses, prints the counts and writes nothing.
// --current is the JSON array of exam_tables rows that tools/exams/current.sql prints.
// A plan is skipped (and keeps its dates) when its page fails, has no tables or shows another
// career or plan. The script exits with an error only when no plan could be read: then the SIU
// is down or changed its page, and GitHub emails the owner. Only counts go to the log.
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import "./ts-resolve.mjs";

const { fetchSiuExamsPage, siuExamsUrl } = await import("../../src/lib/siu/exams-fetch.ts");
const { parseSiuExamsHtml } = await import("../../src/lib/siu/exams-html.ts");
const { validateFilters, groupFilters, siuSearchUrl, checkPlanSync, storedRow, planExamChanges, hasChanges, planWrite, writtenRows, summaryMarkdown, changesSql } =
  await import("../../src/lib/exams/siu-sync.ts");

const { values: args } = parseArgs({
  options: {
    current: { type: "string" },
    sql: { type: "string" },
    summary: { type: "string" },
    only: { type: "string" },
  },
});
const dryRun = !args.current;
if (!dryRun && !args.sql) throw new Error("Con --current hace falta --sql");

const filters = validateFilters(JSON.parse(readFileSync(new URL("../../data/siu/exam-filters.json", import.meta.url), "utf8")));
const only = args.only ? new Set(args.only.split(",")) : null;
// A plan can have more than one SIU search (exam-filters.json): its tables are the union.
const plans = [...groupFilters(filters.plans.filter((p) => !only || only.has(p.planId)))];

/** Current rows per plan, with their ids, in the parser's formats. */
const current = new Map();
if (!dryRun) {
  for (const row of JSON.parse(readFileSync(args.current, "utf8"))) {
    const list = current.get(row.plan_id) ?? [];
    list.push(storedRow(row));
    current.set(row.plan_id, list);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Longer than the app: some searches always take ~17 s in the SIU (Bioingeniería 2024).
const SYNC_TIMEOUT_MS = 60_000;

/** The page of a plan, retrying once: the SIU sometimes takes long to answer. */
async function download(url) {
  const first = await fetchSiuExamsPage(url, SYNC_TIMEOUT_MS);
  if (!("error" in first)) return first;
  await wait(10_000);
  return fetchSiuExamsPage(url, SYNC_TIMEOUT_MS);
}

const outcomes = [];
const writes = [];
let requests = 0;
for (const [planId, searches] of plans) {
  const pages = [];
  for (const filter of searches) {
    if (requests++ > 0) await wait(2_000); // gentle with the SIU: one page at a time
    const checked = siuExamsUrl(siuSearchUrl(filters, filter));
    if ("error" in checked) throw new Error(`${planId}: ${checked.error}`);
    const page = await download(checked.url);
    if ("error" in page) break;
    pages.push({ parsed: parseSiuExamsHtml(page.html), filter });
  }
  if (pages.length < searches.length) {
    outcomes.push({ planId, skip: "no se pudo bajar la página del SIU" });
    continue;
  }
  const check = checkPlanSync(pages);
  if ("skip" in check) {
    outcomes.push({ planId, skip: check.skip });
    continue;
  }
  const before = current.get(planId) ?? [];
  const changes = dryRun ? null : planExamChanges(before, check.rows);
  outcomes.push({ planId, tables: check.rows.length, diff: changes?.diff ?? null });
  if (changes && hasChanges(changes.diff)) writes.push(planWrite(planId, before, check.rows, changes));
}

const summary = summaryMarkdown(outcomes, dryRun, dryRun ? undefined : writtenRows(writes));
console.log(summary);
if (args.summary) appendFileSync(args.summary, summary + "\n");

if (!dryRun) {
  // Dollar-quoted payload with a random tag that does not appear in it (changesSql() checks it).
  // It goes in a file, not in psql's arguments, so its size does not matter.
  const payload = JSON.stringify(writes);
  let tag;
  do tag = `exams_${randomBytes(6).toString("hex")}`;
  while (payload.includes(tag));
  const read = outcomes.filter((o) => !("skip" in o)).map((o) => o.planId);
  writeFileSync(args.sql, changesSql(writes, read, fileURLToPath(new URL("apply.sql", import.meta.url)), tag));
}

for (const o of outcomes) if ("skip" in o) console.log(`::warning title=Fechas de examen::${o.planId}: ${o.skip}`);
if (!outcomes.some((o) => !("skip" in o))) {
  console.log("::error title=Fechas de examen::No se pudo leer ningún plan: ¿el SIU está caído o cambió la página?");
  process.exit(1);
}
