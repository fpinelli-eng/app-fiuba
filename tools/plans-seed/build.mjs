// Builds the SQL that loads the study plans into the database, from the
// FIUBA Map files in data/planes and the metadata in data/planes/planes.json.
//
//   node tools/plans-seed/build.mjs > supabase/migrations/20261015120100_seed_plans.sql
//   node tools/plans-seed/build.mjs --plan sistemas-2014 > supabase/migrations/20261113145000_sistemas_2014.sql
//
// Migrations never change once applied: to fix a plan later, write a new
// migration with the change (or edit it from the admin screen).
//
// The first seed has every plan of planes.json except those with "migration": a plan added
// later names in "migration" the file (without .sql) that loads it, built with --plan. If the
// new plan becomes the current one, the plan it replaces keeps "current": false and gets
// "current_until": "<that migration>": the first seed still loads it as current and the new
// plan's migration takes the flag away before inserting the new one. CI checks that every one
// of these files is up to date (.github/workflows/database.yml).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dataDir = join(root, "data", "planes");
const meta = JSON.parse(readFileSync(join(dataDir, "planes.json"), "utf8"));
const { values: args } = parseArgs({ options: { plan: { type: "string" } } });

// FIUBA Map category → subjects.kind. Any other category is an orientation.
const KINDS = {
  "*CBC": "cbc_subject",
  CBC: "cbc",
  "Materias Obligatorias": "required",
  "Materias Electivas": "elective",
  "Fin de Carrera (Obligatorio)": "final_project",
  "Fin de Carrera": "final_option",
};

const sql = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replaceAll("'", "''")}'`;
};
const json = (v) => `${sql(JSON.stringify(v))}::jsonb`;
const values = (rows) => rows.map((r) => `  (${r.map(sql).join(", ")})`).join(",\n");

const errors = [];
const careers = meta.careers.map((c, i) => [c.id, c.name, c.short_name, i]);
const careerIds = new Set(meta.careers.map((c) => c.id));
const later = new Map(meta.plans.filter((p) => p.migration).map((p) => [p.migration, p]));

meta.plans.forEach((p) => {
  if (!careerIds.has(p.career)) errors.push(`${p.id}: unknown career ${p.career}`);
  if (p.migration && !/^\d{14}_[a-z0-9_]+$/.test(p.migration)) errors.push(`${p.id}: bad migration ${p.migration}`);
  if (p.current_until) {
    const next = later.get(p.current_until);
    if (p.current || !next || !next.current || next.career !== p.career || p.migration) {
      errors.push(`${p.id}: current_until must name the migration of the career's new current plan`);
    }
  }
});
for (const c of meta.careers) {
  if (meta.plans.filter((p) => p.career === c.id && p.current).length !== 1) errors.push(`${c.id}: needs exactly one current plan`);
}

// One plan's rows (plan, requirements, subjects, prerequisites). `sort` keeps its place in planes.json.
function planRows(p, sort, rows) {
  const codes = new Set();
  for (const m of rows) {
    if (codes.has(m.id)) errors.push(`${p.id}: duplicated code ${m.id}`);
    codes.add(m.id);
  }
  for (const code of p.credit_rules.materias ?? []) {
    if (!codes.has(code)) errors.push(`${p.id}: credit rule names missing subject ${code}`);
  }
  const subjects = [];
  const prerequisites = [];
  rows.forEach((m, i) => {
    const kind = KINDS[m.categoria] ?? "orientation";
    subjects.push([
      p.id,
      m.id,
      m.materia.trim(),
      m.creditos ?? 0,
      kind,
      m.categoria,
      m.level ?? null,
      m.requiere || null,
      m.requiereCBC === true,
      i,
    ]);
    const reqs = (m.correlativas ?? "").split("-").filter(Boolean);
    for (const r of new Set(reqs)) {
      if (!codes.has(r)) errors.push(`${p.id}: ${m.id} needs missing subject ${r}`);
      else if (r === m.id) errors.push(`${p.id}: ${m.id} needs itself`);
      else prerequisites.push([p.id, m.id, r]);
    }
  });
  return {
    // In the first seed, a plan replaced later was still the current one.
    plan: `  (${[p.id, p.career, p.year, p.legacy_name, p.current || Boolean(p.current_until)].map(sql).join(", ")}, ${json(p.credit_rules)}, ${sql(p.fiuba_map_file)}, ${sort})`,
    requirements: p.requirements.map((r, i) => [p.id, r.name, r.short_name, i]),
    subjects,
    prerequisites,
  };
}

const read = (p) => JSON.parse(readFileSync(join(dataDir, p.fiuba_map_file), "utf8"));
let selected;
if (args.plan) {
  const p = meta.plans.find((x) => x.id === args.plan);
  if (!p) errors.push(`unknown plan ${args.plan}`);
  else if (!p.migration) errors.push(`${p.id} is in the first seed: build it without --plan`);
  selected = p ? [planRows(p, meta.plans.indexOf(p), read(p))] : [];
} else {
  selected = meta.plans.flatMap((p, i) => (p.migration ? [] : [planRows(p, i, read(p))]));
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

const plans = selected.map((s) => s.plan);
const requirements = selected.flatMap((s) => s.requirements);
const subjects = selected.flatMap((s) => s.subjects);
const prerequisites = selected.flatMap((s) => s.prerequisites);

const out = [];
if (args.plan) {
  const p = meta.plans.find((x) => x.id === args.plan);
  const career = meta.careers.find((c) => c.id === p.career);
  out.push(`-- Study plan ${p.id} (${career.name}, ${p.year}): ${subjects.length} subjects, ${prerequisites.length} prerequisites.
-- Generated by tools/plans-seed/build.mjs --plan ${p.id} from data/planes (FIUBA Map, MIT license:
-- LICENSES/FIUBA-Map.txt). Do not edit by hand.
`);
  const replaced = meta.plans.filter((x) => x.current_until === p.migration).map((x) => x.id);
  if (replaced.length) {
    out.push(`-- ${p.id} is the career's current plan from now on (one current plan per career).
update public.plans set is_current = false where id in (${replaced.map(sql).join(", ")});
`);
  }
} else {
  out.push(`-- Study plans: ${careers.length} careers, ${plans.length} plans, ${subjects.length} subjects, ${prerequisites.length} prerequisites.
-- Generated by tools/plans-seed/build.mjs from data/planes (FIUBA Map, MIT license:
-- LICENSES/FIUBA-Map.txt). Do not edit by hand.
`);

  out.push(`insert into public.careers (id, name, short_name, sort) values
${values(careers)};
`);
}

out.push(`insert into public.plans (id, career_id, year, legacy_name, is_current, credit_rules, fiuba_map_file, sort) values
${plans.join(",\n")};
`);

if (requirements.length) {
  out.push(`insert into public.plan_requirements (plan_id, name, short_name, sort) values
${values(requirements)};
`);
}

out.push(`insert into public.subjects (plan_id, code, name, credits, kind, category, level, required_credits, requires_cbc, sort) values
${values(subjects)};
`);

out.push(`insert into public.subject_prerequisites (subject_id, prerequisite_id)
select s.id, r.id
from (values
${values(prerequisites)}
) as v (plan_id, code, prerequisite_code)
join public.subjects s on s.plan_id = v.plan_id and s.code = v.code
join public.subjects r on r.plan_id = v.plan_id and r.code = v.prerequisite_code;
`);

process.stdout.write(out.join("\n"));
console.error(
  `OK: ${args.plan ? "" : `${careers.length} careers, `}${plans.length} plans, ${requirements.length} requirements, ${subjects.length} subjects, ${prerequisites.length} prerequisites`,
);
