/**
 * FIUBI: mails of "Recordarme" (Finales), sent from the project's Google account.
 *
 * This file is pasted into the Apps Script of a Google Sheet of avisosfiubi@gmail.com
 * (Extensions → Apps Script). Step-by-step guide: tools/reminders/README.md in the repo.
 *
 * One mail per reminder, when the enrollment opens. Every hour, hourly():
 *   1. asks the database which reminders exist and whose mail is due now
 *      (avisos_pendientes(), migration 20261114120000_avisos_rpc.sql; it also deletes the
 *      reminders whose exam already happened);
 *   2. from 08:00 (Buenos Aires), mails the due ones and, right after EACH mail, marks it in the
 *      database (avisos_marcar_enviado()): the database never offers it again, even if someone
 *      edits the sheet;
 *   3. rewrites the "Recordatorios" tab with all of them (it is only a copy to look at: editing it
 *      changes nothing).
 *
 * Script Properties (Project Settings → Script Properties), never in this file:
 *   SUPABASE_KEY  the publishable key of the app (sb_publishable_…, in Vercel / .env.local)
 *   TOKEN         created by createToken(); the database only keeps its SHA-256
 *   SUPABASE_URL  optional, defaults to the project's address
 *
 * Functions to run by hand (Run ▸): sendTestMail, createToken, syncSheet, installTriggers.
 * The ones ending in "_" are internal. The pure ones (no Google services) are tested in the repo
 * (src/lib/reminders/apps-script.test.ts), which also regenerates preview.html.
 */

var TIME_ZONE = 'America/Argentina/Buenos_Aires';
var DEFAULT_SUPABASE_URL = 'https://solnlrkmkncsntyptjjm.supabase.co';
var SHEET_NAME = 'Recordatorios';
var SEND_FROM_HOUR = 8;
var PAGE_SIZE = 1000;
var LINKS = {
  siu: 'https://guaraniautogestion.fi.uba.ar/',
  finales: 'https://fiubi.com.ar/finales',
  logo: 'https://fiubi.com.ar/brand/fiubi-logo-mail.png',
};
var HEADERS = ['Creado', 'Aviso', 'Mail', 'Materia', 'Mesa', 'Fecha', 'Hora', 'Inscripción desde', 'Inscripción hasta', 'Mail enviado'];

// ---------------------------------------------------------------------------------------------
// Functions to run by hand or from the trigger
// ---------------------------------------------------------------------------------------------

/**
 * The trigger's function: mails what is due and refreshes the sheet, then runs the health monitor
 * (Salud.gs). Each part in its own try: one failing never stops the other. The error is thrown at
 * the end, so Google still mails the failure.
 */
function hourly() {
  var failure = null;
  try {
    withLock_(function () {
      var rows = fetchReminders_();
      var result = { sent: 0, left: 0 };
      if (Number(Utilities.formatDate(new Date(), TIME_ZONE, 'H')) >= SEND_FROM_HOUR) result = sendRows_(rows);
      writeSheet_(rows);
      Logger.log('Recordatorios: ' + rows.length + '. Mails enviados: ' + result.sent + '. Quedan para la próxima: ' + result.left + '.');
    });
  } catch (e) {
    failure = e;
  }
  try {
    if (typeof saludCheck_ === 'function') saludCheck_();
  } catch (e) {
    Logger.log('Monitor: ' + e);
    failure = failure || e;
  }
  if (failure) throw failure;
}

/** Same as the trigger: mails what is due now (from 08:00) and refreshes the sheet. */
function sendDue() {
  hourly();
}

/** Only refreshes the sheet, without sending anything. */
function syncSheet() {
  withLock_(function () {
    var rows = fetchReminders_();
    writeSheet_(rows);
    Logger.log('Recordatorios en la planilla: ' + rows.length + '.');
  });
}

/** Sends the mail with sample data to the account running the script. Touches neither the database nor the sheet. */
function sendTestMail() {
  var to = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  var mail = buildMail_(sampleRow_());
  MailApp.sendEmail({ to: to, subject: '[Prueba] ' + mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' });
  Logger.log('Listo: se mandó un mail de prueba a ' + to + '.');
}

/**
 * Creates the TOKEN (if there is none) and prints the SQL line that stores its hash in the
 * database. To change it: delete TOKEN in Script Properties and run this again.
 */
function createToken() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('TOKEN');
  if (!token) {
    token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    props.setProperty('TOKEN', token);
    Logger.log('Token nuevo guardado en las propiedades del script (TOKEN).');
  } else {
    Logger.log('Ya había un TOKEN: se usa ese.');
  }
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token, Utilities.Charset.UTF_8);
  Logger.log('Copiá esta línea en Supabase → SQL Editor y tocá Run:\n\n' + tokenSql_(toHex_(digest)) + '\n');
}

/** Creates the hourly trigger (once; running it again does not duplicate it). */
function installTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'hourly') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('hourly').timeBased().everyHours(1).create();
  Logger.log('Listo: hourly() corre una vez por hora.');
}

// ---------------------------------------------------------------------------------------------
// Google services: database, mail, sheet
// ---------------------------------------------------------------------------------------------

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) {
    Logger.log('Otra ejecución sigue corriendo: esta no hace nada.');
    return;
  }
  try {
    fn();
  } finally {
    lock.releaseLock();
  }
}

function config_() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('SUPABASE_KEY');
  var token = props.getProperty('TOKEN');
  if (!key) throw new Error('Falta SUPABASE_KEY en las propiedades del script (Configuración del proyecto).');
  if (!token) throw new Error('Falta TOKEN: corré createToken() primero.');
  return { url: (props.getProperty('SUPABASE_URL') || DEFAULT_SUPABASE_URL).replace(/\/+$/, ''), key: key, token: token };
}

/**
 * Calls a database function through the API (role anon: only the two avisos_* functions).
 * query: optional "limit=…&offset=…" for functions that return rows.
 */
function rpc_(name, args, query) {
  var c = config_();
  args.p_token = c.token;
  var res = UrlFetchApp.fetch(c.url + '/rest/v1/rpc/' + name + (query ? '?' + query : ''), {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: c.key },
    payload: JSON.stringify(args),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code >= 300) {
    var hint = code === 401 || /invalid token/.test(body) ? ' (¿TOKEN o SUPABASE_KEY mal copiados? ¿Corriste la línea SQL de createToken()?)' : '';
    throw new Error('La base respondió ' + code + hint + ': ' + body.slice(0, 300));
  }
  return JSON.parse(body);
}

/**
 * All the reminders, by pages: the API returns at most a fixed number of rows per call (1000 in
 * Supabase by default) and would cut the rest without saying so. The database keeps a stable order
 * (exam date, id); it stops at the first empty page.
 */
function fetchReminders_() {
  var all = [];
  for (var page = 0; page < 100; page++) {
    var rows = rpc_('avisos_pendientes', {}, 'limit=' + PAGE_SIZE + '&offset=' + all.length);
    if (!rows.length) return all;
    all = all.concat(rows);
  }
  throw new Error('Demasiados recordatorios: más de ' + all.length + '.');
}

/** Sends the due mails, within the daily quota of the account. Returns counts. */
function sendRows_(rows) {
  var due = dueRows_(rows);
  var sent = 0;
  if (!due.length) return { sent: 0, left: 0 };
  // First check that marking works (reminder 0 does not exist: it answers false). If it did not,
  // the same students would get the same mail every hour.
  rpc_('avisos_marcar_enviado', { p_reminder_id: 0 });
  for (var i = 0; i < due.length; i++) {
    if (MailApp.getRemainingDailyQuota() < 1) break; // Gmail: ~100 recipients a day; the rest go next time
    var row = due[i];
    var mail = buildMail_(row);
    MailApp.sendEmail({ to: row.email, subject: mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' });
    // Right after each mail. If marking fails, stop here: at most this one could go twice.
    rpc_('avisos_marcar_enviado', { p_reminder_id: row.reminder_id });
    row.sent_at = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm');
    row.due = false;
    sent++;
  }
  return { sent: sent, left: due.length - sent };
}

function writeSheet_(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  var values = sheetValues_(rows);
  sheet.clearContents();
  var range = sheet.getRange(1, 1, values.length, HEADERS.length);
  range.setNumberFormat('@'); // plain text: Sheets does not turn "2026-12-09" or "17:00" into dates
  range.setValues(values);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// ---------------------------------------------------------------------------------------------
// Pure functions (no Google services): tested in the repo
// ---------------------------------------------------------------------------------------------

/** Rows whose mail is due now (the database decides), only to @fi.uba.ar. */
function dueRows_(rows) {
  return rows.filter(function (r) {
    return r.due === true && /@fi\.uba\.ar$/i.test(r.email || '');
  });
}

/** The sheet as values: the headers and one row per reminder. */
function sheetValues_(rows) {
  var values = [HEADERS.slice()];
  rows.forEach(function (r) {
    values.push([
      r.created_at, r.aviso, r.email, r.subject_name, tableLabel_(r), r.exam_date, timeRange_(r.start_time, r.end_time),
      r.enroll_from, r.enroll_to, r.sent_at,
    ].map(cell_));
  });
  return values;
}

/** A cell as text; never a formula. */
function cell_(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function tokenSql_(hash) {
  return "insert into public.avisos_config (id, token_sha256) values (true, '" + hash + "') " +
    'on conflict (id) do update set token_sha256 = excluded.token_sha256;';
}

function toHex_(bytes) {
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

var WEEKDAYS_ = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "2026-12-09" → "miércoles 9/12" */
function longDay_(date) {
  var p = date.split('-').map(Number);
  return WEEKDAYS_[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()] + ' ' + p[2] + '/' + p[1];
}

/** "2026-12-07" → "2026-12-06" */
function previousDay_(date) {
  var p = date.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] - 1)).toISOString().slice(0, 10);
}

/** "2026-12-07 14:00" → "el lunes 7/12 a las 14:00"; 00:00 is the end of the day before. */
function deadline_(moment) {
  var day = moment.slice(0, 10);
  var time = moment.slice(11, 16);
  if (time === '00:00') return 'el ' + longDay_(previousDay_(day)) + ' a las 23:59';
  return 'el ' + longDay_(day) + ' a las ' + time;
}

/** "de 17:00 a 20:00", "a las 17:00" or "". */
function timeRange_(start, end) {
  if (!start) return '';
  return end && end !== start ? 'de ' + start + ' a ' + end : 'a las ' + start;
}

/** "MESA 01" or "MESA 01 (Libre)". */
function tableLabel_(r) {
  return r.table_name + (r.kind && r.kind !== 'Regular' ? ' (' + r.kind + ')' : '');
}

function escape_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function capitalize_(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The mail of one reminder: the enrollment opened.
 * Email-safe HTML (tables and inline styles, 560 px, light) plus a plain-text version.
 */
function buildMail_(r) {
  var subject = 'Abrió la inscripción al final de ' + r.subject_name;
  var band = 'Abrió la inscripción';
  var lead = 'Ya te podés anotar en el SIU.';
  var time = timeRange_(r.start_time, r.end_time);
  var exam = capitalize_(longDay_(r.exam_date)) + (time ? ', ' + time : '');
  var until = r.enroll_to ? 'Te podés anotar hasta ' + deadline_(r.enroll_to) + '.' : 'Revisá la fecha de cierre en el SIU.';
  var details = [['Examen', exam], ['Mesa', tableLabel_(r)], ['Inscripción', until]];
  var footer = [
    'Te llega porque pediste un recordatorio en FIUBI. Para dejar de recibirlo, sacalo en Finales → Recordarme.',
    'Hecho por estudiantes, no es un sitio oficial de la universidad.',
  ];

  var text = [
    band.toUpperCase(),
    '',
    'Final de ' + r.subject_name,
    lead,
    '',
  ].concat(details.map(function (d) { return d[0] + ': ' + d[1]; })).concat([
    '',
    'Anotarme en el SIU: ' + LINKS.siu,
    'Ver mis finales en FIUBI: ' + LINKS.finales,
    '',
    '—',
  ]).concat(footer).join('\n') + '\n';

  var c = { band: '#dff2e9', bandInk: '#245c48', bandLine: '#bfe3d1' }; // mint, as the app
  var font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  var detailRows = details.map(function (d, i) {
    var border = i < details.length - 1 ? 'border-bottom:1px solid #e6e9f0;' : '';
    return '<tr>' +
      '<td style="padding:12px 16px;' + border + 'font-family:' + font + ';font-size:13px;line-height:20px;color:#5e667a;width:96px;vertical-align:top;">' + escape_(d[0]) + '</td>' +
      '<td style="padding:12px 16px 12px 0;' + border + 'font-family:' + font + ';font-size:15px;line-height:22px;color:#1f2537;font-weight:600;vertical-align:top;">' + escape_(d[1]) + '</td>' +
      '</tr>';
  }).join('');

  var html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    '<title>' + escape_(subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background-color:#f6f7fa;">' +
    // Preview line in the inbox, hidden in the mail.
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">' + escape_(lead + ' ' + until) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f7fa;">' +
    '<tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e6e9f0;border-radius:16px;border-collapse:separate;">' +
    // Logo
    '<tr><td style="padding:24px 28px 20px 28px;">' +
    '<a href="' + LINKS.finales + '" style="text-decoration:none;"><img src="' + LINKS.logo + '" width="112" height="31" alt="FIUBI" style="display:block;border:0;outline:none;width:112px;height:31px;"></a>' +
    '</td></tr>' +
    // Colored band
    '<tr><td style="background-color:' + c.band + ';border-top:1px solid ' + c.bandLine + ';border-bottom:1px solid ' + c.bandLine + ';padding:12px 28px;font-family:' + font + ';font-size:14px;line-height:20px;font-weight:700;color:' + c.bandInk + ';">' +
    escape_(band) + '</td></tr>' +
    // Subject
    '<tr><td style="padding:24px 28px 4px 28px;font-family:' + font + ';font-size:13px;line-height:18px;color:#5e667a;">Final de</td></tr>' +
    '<tr><td style="padding:0 28px 8px 28px;font-family:' + font + ';font-size:26px;line-height:32px;font-weight:700;color:#1f2537;">' + escape_(r.subject_name) + '</td></tr>' +
    '<tr><td style="padding:0 28px 20px 28px;font-family:' + font + ';font-size:15px;line-height:22px;color:#3b4357;">' + escape_(lead) + '</td></tr>' +
    // Details card
    '<tr><td style="padding:0 28px 24px 28px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f7fa;border:1px solid #e6e9f0;border-radius:12px;border-collapse:separate;">' +
    detailRows + '</table></td></tr>' +
    // Button
    '<tr><td style="padding:0 28px 12px 28px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td align="center" bgcolor="#3b5bd0" style="background-color:#3b5bd0;border-radius:10px;">' +
    '<a href="' + LINKS.siu + '" style="display:inline-block;padding:14px 26px;font-family:' + font + ';font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Anotarme en el SIU</a>' +
    '</td></tr></table></td></tr>' +
    '<tr><td style="padding:4px 28px 28px 28px;font-family:' + font + ';font-size:14px;line-height:20px;">' +
    '<a href="' + LINKS.finales + '" style="color:#3b5bd0;font-weight:600;text-decoration:underline;">Ver mis finales en FIUBI</a></td></tr>' +
    '</table>' +
    // Footer
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">' +
    '<tr><td style="padding:16px 28px 0 28px;font-family:' + font + ';font-size:12px;line-height:18px;color:#5e667a;">' +
    footer.map(escape_).join('<br>') + '</td></tr></table>' +
    '</td></tr></table></body></html>';

  return { subject: subject, text: text, html: html };
}

/** Sample data for sendTestMail() and preview.html. */
function sampleRow_() {
  return {
    reminder_id: 0,
    email: 'alumno@fi.uba.ar',
    subject_name: 'Análisis Matemático II',
    table_name: 'MESA 01',
    kind: 'Regular',
    exam_date: '2026-12-09',
    start_time: '17:00',
    end_time: '20:00',
    enroll_from: '2026-11-30 08:00',
    enroll_to: '2026-12-07 14:00',
    due: true,
  };
}
