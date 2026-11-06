// Sends the due reminders of the workflow "Recordatorios".
//   node --experimental-strip-types tools/reminders/send.mjs <due.json> <sent.json>
// <due.json>: what tools/reminders/due.sql printed. <sent.json>: written with the ids that went out,
// for tools/reminders/sent.sql. SMTP comes from the environment (repository secrets SMTP_HOST,
// SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM). Without them it only counts (nothing is marked as
// sent), so the workflow can be merged before the app's mail account exists. No addresses or
// names go to the log.
import { readFileSync, writeFileSync } from "node:fs";
import { buildEmail } from "../../src/lib/reminders/email.ts";

const [dueFile, sentFile] = process.argv.slice(2);
const due = JSON.parse(readFileSync(dueFile, "utf8"));
const sent = [];
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;

if (due.length === 0) {
  console.log("Sin recordatorios para mandar.");
} else if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
  console.log(`::warning::${due.length} recordatorios esperan, pero falta la cuenta de mail (secretos SMTP_*). No se mandó ninguno.`);
} else {
  const { default: nodemailer } = await import("nodemailer");
  const port = Number(SMTP_PORT || 465);
  const transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  let failed = 0;
  for (const r of due) {
    const mail = buildEmail(r);
    try {
      await transport.sendMail({ from: MAIL_FROM, ...mail });
      sent.push(r.id);
    } catch {
      failed++;
    }
  }
  console.log(`Enviados: ${sent.length}. Fallaron: ${failed}.`);
  if (failed > 0) process.exitCode = 1;
}
writeFileSync(sentFile, JSON.stringify(sent));
