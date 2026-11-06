// Reads the public Dolly FIUBA surveys (github.com/lugfi/dolly, gente.txt, GPL-3.0) and writes the
// SQL that loads them into public.historical_reviews (tools/reviews-dolly/README.md).
//
//   node --experimental-strip-types tools/reviews-dolly/build.mjs [gente.txt] > tools/reviews-dolly/out.sql
//
// Without a file it downloads gente.txt. Only surveys from MIN_YEAR on, of old subjects listed in
// mapping.json. Each survey becomes 1 to 5 stars (the average of its nine scores, rounded). The
// comment goes through the same filter as the app's reviews; when it does not pass (insults,
// contact data, more than 500 characters) the survey is kept without the comment.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { commentProblem } from "../../src/lib/reviews/filter.ts";

const SOURCE = "https://raw.githubusercontent.com/lugfi/dolly/master/gente.txt";
const MIN_YEAR = Number(process.env.MIN_YEAR ?? 2019);
const here = new URL(".", import.meta.url);

const { mappings } = JSON.parse(readFileSync(new URL("mapping.json", here), "utf8"));
const targets = mappings.flatMap((m) => m.targets.map((t) => ({ old: m.old, plan: t.plan, code: t.code })));
const mapped = new Set(targets.map((t) => t.old));

const text = process.argv[2] ? readFileSync(process.argv[2], "utf8") : await (await fetch(SOURCE)).text();
const [header, ...lines] = text.trim().split(/\r?\n/);
if (!header.startsWith("doc,mat,cuat,")) throw new Error("gente.txt cambió de formato");

/** "Pérez  Gómez" → ["PEREZ", "GOMEZ"]: the words to find in the SIU teacher's name. */
const nameKey = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((w) => w.length > 1);

const decode = (b64) => Buffer.from(b64, "base64").toString("utf8").replace(/\s+/g, " ").trim();

const rows = [];
const skipped = { year: 0, subject: 0, invalid: 0, teacher: 0 };
let commentsDropped = 0;
for (const line of lines) {
  const f = line.split(",");
  const [doc, mat, cuat] = f;
  const scores = f.slice(4, 13).map(Number);
  const term = /^([12])Q(\d{4})$/.exec(cuat ?? "");
  if (!term || scores.length < 9 || scores.some((n) => !Number.isInteger(n) || n < 1 || n > 5)) {
    skipped.invalid++;
    continue;
  }
  const year = Number(term[2]);
  if (year < MIN_YEAR) {
    skipped.year++;
    continue;
  }
  if (!mapped.has(mat)) {
    skipped.subject++;
    continue;
  }
  const key = nameKey(doc);
  if (!key.length || /designar/i.test(doc)) {
    skipped.teacher++;
    continue;
  }
  let comment = f[13] ? decode(f[13]) : "";
  if (comment && commentProblem(comment)) {
    comment = "";
    commentsDropped++;
  }
  const stars = Math.min(5, Math.max(1, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)));
  rows.push({
    i: rows.length,
    old: mat,
    teacher: doc.trim().slice(0, 120),
    key,
    term: `${term[1]}C ${year}`,
    year,
    stars,
    comment: comment || null,
  });
}

const payload = JSON.stringify({ targets, rows });
// Dollar-quoted literal with a random tag: nothing in the surveys can close it.
let tag;
do tag = `dolly_${randomBytes(6).toString("hex")}`;
while (payload.includes(tag));

process.stdout.write(
  [
    "\\set ON_ERROR_STOP on",
    `select set_config('dolly.payload', $${tag}$${payload}$${tag}$, false);`,
    "\\ir load.sql",
    "",
  ].join("\n"),
);
console.error(
  `encuestas: ${rows.length} para cargar (${rows.filter((r) => r.comment).length} con comentario, ${commentsDropped} comentarios filtrados); ` +
    `afuera: ${skipped.year} anteriores a ${MIN_YEAR}, ${skipped.subject} de materias sin equivalencia, ` +
    `${skipped.teacher} sin docente, ${skipped.invalid} inválidas`,
);
