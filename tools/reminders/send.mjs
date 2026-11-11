// Sends the "Recordarme" mails that are due, for the workflow "Recordatorios" (tools/reminders/README.md).
//
//   node --experimental-strip-types tools/reminders/send.mjs --dump due.json --sent sent.json
//        [--summary summary.md] [--now 2026-12-01T08:17]
//
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
const { buenosAiresMoment } = await import("../../src/lib/reminders/model.ts");

const { values: args } = parseArgs({
  options: { dump: { type: "string" }, sent: { type: "string" }, summary: { type: "string" }, now: { type: "string" } },
});
if (!args.dump || !args.sent) throw new Error("Uso: send.mjs --dump due.json --sent sent.json [--summary summary.md]");

const now = args.now ?? buenosAiresMoment(new Date());
const { mails, counts } = planRun(JSON.parse(readFileSync(args.dump, "utf8")), now);
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, NODEMAILER_DIR } = process.env;
const configured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && SMTP_FROM);

const sent = [];
let failed = 0;
if (mails.length > 0 && configured) {
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
    } catch {
      failed++; // no details: they may include the address
    }
  }
  transport.close();
}
writeFileSync(args.sent, JSON.stringify(sent));

const lines = [
  `Recordatorios pendientes: ${counts.pending}`,
  `Para mandar ahora: ${counts.first} de apertura y ${counts.last} de último día`,
  `Mesas que ya no están en el SIU (se conservan): ${counts.missing}`,
  configured ? `Enviados: ${sent.length}. Fallaron: ${failed}.` : "Sin la cuenta de mail (secretos SMTP_*): no se mandó ni se marcó nada.",
];
for (const l of lines) console.log(l);
if (args.summary) appendFileSync(args.summary, `### Recordatorios\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`);
if (!configured && mails.length > 0) console.log(`::warning::${mails.length} avisos esperan la cuenta de mail (secretos SMTP_*).`);
if (failed > 0) process.exitCode = 1;
