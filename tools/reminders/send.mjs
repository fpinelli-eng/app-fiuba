// Sends the "Recordarme" mails that are due, for the workflow "Recordatorios" (tools/reminders/README.md).
//
//   node --experimental-strip-types tools/reminders/send.mjs --dump due.json --sent sent.json
//        [--summary summary.md] [--now 2026-12-01T08:17] [--control]
//
// --control: after the reminders, also sends a control mail (buildControlMail) to SMTP_CONTROL_TO
// (comma-separated, a secret: the administrators' @fi.uba.ar, the same kind of mailbox the students
// have) or, without it, to SMTP_FROM. The workflow asks for it by hand and once a month, so the SMTP
// key is never 90 days unused. Without SMTP it fails.
// --dump: what tools/reminders/due.sql printed. --sent: written with [{ id, which }] of the mails
// that went out, for tools/reminders/mark.sql. --now (Buenos Aires, "YYYY-MM-DDTHH:MM") is for tests.
// SMTP comes from the environment (secrets SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)
// and nodemailer from NODEMAILER_DIR (the workflow installs it there, outside package.json). Without
// SMTP it only counts and marks nothing, so the workflow works before the app's mailbox exists.
// The repository is public: only counts go to the log and the summary, never mails, names or
// error messages (an SMTP error may quote the recipient).
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseArgs } from "node:util";
import "../exams/ts-resolve.mjs";

const { planRun } = await import("../../src/lib/reminders/bot.ts");
const { buildControlMail } = await import("../../src/lib/reminders/email.ts");
const { buenosAiresMoment } = await import("../../src/lib/reminders/model.ts");

const { values: args } = parseArgs({
  options: {
    dump: { type: "string" },
    sent: { type: "string" },
    summary: { type: "string" },
    now: { type: "string" },
    control: { type: "boolean" },
  },
});
if (!args.dump || !args.sent) throw new Error("Uso: send.mjs --dump due.json --sent sent.json [--summary summary.md]");

const now = args.now ?? buenosAiresMoment(new Date());
let dump;
try {
  dump = JSON.parse(readFileSync(args.dump, "utf8"));
} catch {
  // No details: a JSON error quotes part of the file, which has the students' mails.
  console.log("::error::No se pudo leer la lista de recordatorios.");
  writeFileSync(args.sent, "[]");
  process.exit(1);
}
const { mails, counts } = planRun(dump, now);
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_CONTROL_TO, NODEMAILER_DIR } = process.env;
const configured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM);

const sent = [];
let failed = 0;
// Error codes only (EAUTH, ECONNECTION…, plus the SMTP reply code): enough to tell a wrong key
// from a server problem, and they never contain an address. The messages may.
const errors = new Set();
const errorCode = (e) => [e?.code, e?.responseCode].filter(Boolean).join(" ") || "desconocido";
let control = "no pedido";
if ((mails.length > 0 || args.control) && configured) {
  if (!NODEMAILER_DIR) throw new Error("Falta NODEMAILER_DIR (carpeta donde se instaló nodemailer).");
  const nodemailer = createRequire(join(NODEMAILER_DIR, "noop.js"))("nodemailer");
  const port = Number(SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port === 587, // never send the password in clear on the submission port
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  for (const m of mails) {
    try {
      await transport.sendMail({ from: SMTP_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html });
      sent.push({ id: m.id, which: m.which });
    } catch (e) {
      failed++; // no message: it may include the address
      errors.add(errorCode(e));
    }
  }
  if (args.control) {
    const m = buildControlMail({ now, counts, sent: sent.length, failed });
    try {
      await transport.sendMail({ from: SMTP_FROM, to: SMTP_CONTROL_TO || SMTP_FROM, subject: m.subject, text: m.text, html: m.html });
      control = "enviado";
    } catch (e) {
      control = "falló";
      errors.add(errorCode(e));
    }
  }
  transport.close();
} else if (args.control) {
  control = "falló (faltan los secretos SMTP_*)";
}
writeFileSync(args.sent, JSON.stringify(sent));

const lines = [
  `Recordatorios pendientes: ${counts.pending}`,
  `Para mandar ahora (abrió la inscripción): ${counts.first}`,
  `Mesas que ya no están en el SIU (se conservan): ${counts.missing}`,
  configured ? `Enviados: ${sent.length}. Fallaron: ${failed}.` : "Sin la cuenta de mail (secretos SMTP_*): no se mandó ni se marcó nada.",
  `Mail de control: ${control}`,
  ...(errors.size > 0 ? [`Códigos de error: ${[...errors].join(", ")}`] : []),
];
for (const l of lines) console.log(l);
if (args.summary) appendFileSync(args.summary, `### Recordatorios\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`);
if (!configured && mails.length > 0) console.log(`::warning::${mails.length} avisos esperan la cuenta de mail (secretos SMTP_*).`);
if (failed > 0 || control.startsWith("falló")) process.exitCode = 1;
