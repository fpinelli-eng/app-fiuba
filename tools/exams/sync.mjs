// Reads the SIU's public "Fechas de examen" search of every plan in data/siu/exam-filters.json and
// writes the SQL that replaces the exam tables of the plans that changed, for the workflow
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
const { validateFilters, groupFilters, siuSearchUrl, checkPlanSync, normalizeRow, diffExamRows, hasChanges, summaryMarkdown } =
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

/** Current rows per plan, in the parser's formats. */
const current = new Map();
if (!dryRun) {
  for (const row of JSON.parse(readFileSync(args.current, "utf8"))) {
    const list = current.get(row.plan_id) ?? [];
    list.push(normalizeRow(row));
    current.set(row.plan_id, list);
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** The page of a plan, retrying once: the SIU sometimes takes long to answer. */
async function download(url) {
  const first = await fetchSiuExamsPage(url);
  if (!("error" in first)) return first;
  await wait(10_000);
  return fetchSiuExamsPage(url);
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
  const diff = dryRun ? null : diffExamRows(current.get(planId) ?? [], check.rows);
  outcomes.push({ planId, tables: check.rows.length, diff });
  if (diff && hasChanges(diff)) {
    const dates = check.rows.map((r) => r.exam_date).sort();
    const subjects = new Set(check.rows.map((r) => r.siu_subject_code)).size;
    const stats = { subjects, tables: check.rows.length, from: dates[0], to: dates.at(-1) };
    writes.push({ plan_id: planId, stats, rows: check.rows });
  }
}

const summary = summaryMarkdown(outcomes, dryRun);
console.log(summary);
if (args.summary) appendFileSync(args.summary, summary + "\n");

if (!dryRun) {
  // Dollar-quoted literal with a random tag: nothing in the SIU's text can close it. It goes in a
  // file, not in psql's arguments, so its size does not matter. length() so that psql prints a
  // number, not the payload (teacher names) into the public log.
  const payload = JSON.stringify({ plans: writes });
  let tag;
  do tag = `exams_${randomBytes(6).toString("hex")}`;
  while (payload.includes(tag));
  const sql = writes.length
    ? [
        "\\set ON_ERROR_STOP on",
        `select length(set_config('exams.payload', $${tag}$${payload}$${tag}$, false)) as payload_chars;`,
        // By its full path: the generated file lives elsewhere (the runner's temp folder).
        `\\i '${fileURLToPath(new URL("apply.sql", import.meta.url)).replaceAll("\\", "/").replaceAll("'", "''")}'`,
        "",
      ]
    : ["-- Sin cambios: no hay nada para guardar.", ""];
  writeFileSync(args.sql, sql.join("\n"));
}

for (const o of outcomes) if ("skip" in o) console.log(`::warning title=Fechas de examen::${o.planId}: ${o.skip}`);
if (!outcomes.some((o) => !("skip" in o))) {
  console.log("::error title=Fechas de examen::No se pudo leer ningún plan: ¿el SIU está caído o cambió la página?");
  process.exit(1);
}
