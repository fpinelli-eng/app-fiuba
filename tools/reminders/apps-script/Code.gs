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
 *      changes nothing) and the "Panel" tab: how many mails each day needs against the daily limit;
 *   4. at any hour, sends the confirmation mails ("Activaste tus recordatorios", so the student
 *      finds it now and marks it as "No es spam"): avisos_confirmaciones() lists them and
 *      avisos_confirmacion_enviada() marks each one right after sending it (migration
 *      20261116130000_recordarme_confirmacion.sql). It leaves CONFIRM_QUOTA_RESERVE mails of the
 *      daily quota for the reminders.
 *
 * Optional instant path: deployed as a web app (Deploy → New deployment → Web app, execute as me,
 * anyone), doPost() runs step 4 right away when the app posts {token, action: 'confirm'} after a
 * student saves their reminders. Without it, the hourly run sends them.
 *
 * The mail goes to the address the database gives: the student's other mail if they set one in
 * Recordarme, else their @fi.uba.ar account.
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
var PANEL_NAME = 'Panel';
var FAILURES_PREFIX = 'FALLAS_'; // Script Property per day: the mails that failed, {reminder_id: {error, at}}
var NO_QUOTA_PREFIX = 'SIN_CUPO_'; // Script Property per day: the "sin cupo" alert already went
var lastMailError_ = '';
var GMAIL_DAILY_LIMIT = 100; // consumer Gmail through Apps Script: about 100 recipients a day
var SEND_FROM_HOUR = 8;
var PAGE_SIZE = 1000;
var CONFIRM_QUOTA_RESERVE = 30; // confirmations stop here: the rest of the daily quota is for the reminders
var SENDER = 'avisosfiubi@gmail.com';
// A plain address (the database checks the same): no spaces, commas or brackets, one @.
var EMAIL_RE = /^(?=[^@]{1,64}@)[a-z0-9_%+-]+(\.[a-z0-9_%+-]+)*@([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;
var LINKS = {
  siu: 'https://guaraniautogestion.fi.uba.ar/',
  finales: 'https://fiubi.com.ar/finales',
  logo: 'https://fiubi.com.ar/brand/fiubi-logo-mail.png',
};
var HEADERS = ['Creado', 'Aviso', 'Mail', 'Materia', 'Mesa', 'Fecha', 'Hora', 'Inscripción desde', 'Inscripción hasta', 'Mail enviado'];


// ---------------------------------------------------------------------------------------------
// Sending: through Brevo from avisos@fiubi.com.ar when the property BREVO_API_KEY is set (the
// domain is authenticated in Brevo, so @fi.uba.ar accounts trust it more than a new Gmail);
// otherwise MailApp from this Gmail account, as before. Optional property BREVO_SENDER changes
// the sender address. A Brevo error throws, so the caller does not mark the mail as sent.
// ---------------------------------------------------------------------------------------------

var BREVO_URL = 'https://api.brevo.com/v3/smtp/email';
var BREVO_DAILY_LIMIT = 290; // free plan: 300 a day, shared with anything else sent from the account
var BREVO_DEFAULT_SENDER = 'avisos@fiubi.com.ar';
var REPLY_TO = 'contacto@fiubi.com.ar';

function brevoKey_() {
  if (typeof PropertiesService === 'undefined') return ''; // tests without script properties
  return PropertiesService.getScriptProperties().getProperty('BREVO_API_KEY') || '';
}

function brevoCountKey_() {
  return 'BREVO_SENT_' + Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
}

/** Mails left for today on the channel in use. */
function mailQuota_() {
  if (!brevoKey_()) return MailApp.getRemainingDailyQuota();
  var sent = Number(PropertiesService.getScriptProperties().getProperty(brevoCountKey_()) || 0);
  return Math.max(0, BREVO_DAILY_LIMIT - sent);
}

/** Same options as MailApp.sendEmail: { to (comma-separated), subject, body, htmlBody, name }. */
function deliverMail_(m) {
  var key = brevoKey_();
  if (!key) {
    MailApp.sendEmail(m);
    return;
  }
  var props = PropertiesService.getScriptProperties();
  var to = String(m.to).split(',').map(function (a) { return a.trim(); }).filter(function (a) { return a; });
  var payload = {
    sender: { name: m.name || 'FIUBI', email: props.getProperty('BREVO_SENDER') || BREVO_DEFAULT_SENDER },
    to: to.map(function (a) { return { email: a }; }),
    replyTo: { email: REPLY_TO, name: 'FIUBI' },
    subject: m.subject,
    htmlContent: m.htmlBody,
    textContent: m.body,
  };
  var res = UrlFetchApp.fetch(BREVO_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'api-key': key, accept: 'application/json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    // Only the status: the body could echo addresses.
    throw new Error('Brevo no aceptó el mail (HTTP ' + code + '). Revisá BREVO_API_KEY y el remitente.');
  }
  var countKey = brevoCountKey_();
  props.setProperty(countKey, String(Number(props.getProperty(countKey) || 0) + to.length));
}

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
      try {
        alertSendProblems_(result);
      } catch (e) {
        Logger.log('Aviso de fallas: ' + e);
      }
      writeSheet_(rows);
      panelSafe_(rows);
      Logger.log('Recordatorios: ' + rows.length + '. Mails enviados: ' + result.sent + '. Quedan para la próxima: ' + result.left + '.');
    });
  } catch (e) {
    failure = e;
  }
  try {
    confirmPass_();
  } catch (e) {
    Logger.log('Confirmaciones: ' + e);
    failure = failure || e;
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
    panelSafe_(rows);
    Logger.log('Recordatorios en la planilla: ' + rows.length + '.');
  });
}

/** Sends the mail with sample data to the account running the script. Touches neither the database nor the sheet. */
function sendTestMail() {
  var to = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  var mail = buildMail_(sampleRow_());
  deliverMail_({ to: to, subject: '[Prueba] ' + mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' });
  Logger.log('Listo: se mandó un mail de prueba a ' + to + '.');
}

/** Sends the confirmation mail with sample data to the account running the script. Touches nothing else. */
function sendTestConfirmMail() {
  var to = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  var mail = buildConfirmMail_(sampleConfirmRow_());
  deliverMail_({ to: to, subject: '[Prueba] ' + mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' });
  Logger.log('Listo: se mandó un mail de confirmación de prueba a ' + to + '.');
}

/** Sends the pending confirmation mails now (the same as the end of hourly()). */
function sendConfirmations() {
  var result = confirmPass_();
  if (!result) Logger.log('Otra ejecución sigue corriendo: no se mandó nada.');
}

/**
 * Web app (optional instant path): the app posts {"token": "…", "action": "confirm"} after a
 * student saves their reminders, and this sends the pending confirmations right away. Without the
 * right TOKEN it does nothing. Answers only counts.
 */
function doPost(e) {
  var body = null;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    body = null;
  }
  var result;
  try {
    result = handlePost_(body, PropertiesService.getScriptProperties().getProperty('TOKEN'), confirmPass_);
  } catch (err) {
    Logger.log('doPost: ' + err);
    result = { ok: false, error: 'failed' };
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
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
  var failed = [];
  var noQuota = 0;
  if (!due.length) return { sent: 0, left: 0, failed: failed, noQuota: 0 };
  // First check that marking works (reminder 0 does not exist: it answers false). If it did not,
  // the same students would get the same mail every hour.
  rpc_('avisos_marcar_enviado', { p_reminder_id: 0 });
  var failures = loadFailures_();
  for (var i = 0; i < due.length; i++) {
    if (mailQuota_() < 1) {
      noQuota = due.length - i; // the rest go next time (tomorrow, if the daily limit is spent)
      break;
    }
    var row = due[i];
    var mail = buildMail_(row);
    if (!sendMail_(row.email, mail)) {
      // A rejected address never blocks the others. It stays due, so it is tried again next hour;
      // the admins hear about it only the first time each day.
      if (!failures[row.reminder_id]) failed.push({ row: row, error: lastMailError_ });
      failures[row.reminder_id] = { error: lastMailError_, at: Utilities.formatDate(new Date(), TIME_ZONE, 'HH:mm') };
      saveFailures_(failures);
      continue;
    }
    if (failures[row.reminder_id]) {
      delete failures[row.reminder_id];
      saveFailures_(failures);
    }
    // Right after each mail. If marking fails, stop here: at most this one could go twice.
    rpc_('avisos_marcar_enviado', { p_reminder_id: row.reminder_id });
    row.sent_at = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd HH:mm');
    row.due = false;
    sent++;
  }
  return { sent: sent, left: due.length - sent, failed: failed, noQuota: noQuota };
}

function todayKey_(prefix) {
  return prefix + Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
}

/** Today's failed mails, {reminder_id: {error, at}}. Empty without script properties (tests). */
function loadFailures_() {
  if (typeof PropertiesService === 'undefined') return {};
  try {
    return JSON.parse(PropertiesService.getScriptProperties().getProperty(todayKey_(FAILURES_PREFIX)) || '{}') || {};
  } catch (e) {
    return {};
  }
}

function saveFailures_(failures) {
  if (typeof PropertiesService === 'undefined') return;
  PropertiesService.getScriptProperties().setProperty(todayKey_(FAILURES_PREFIX), JSON.stringify(failures));
}

/** Who gets the alerts: ALERT_TO (comma-separated), else the account running the script. */
function alertRecipients_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ALERT_TO') || '';
  var list = raw.split(/[,;\s]+/).filter(function (a) { return EMAIL_RE.test(a); });
  return list.length ? list : [Session.getEffectiveUser().getEmail()];
}

/**
 * Mails the admins when reminders failed (new ones today) or the daily limit ran out with mails
 * still due (once a day). If Brevo itself is what fails, it falls back to Gmail.
 */
function alertSendProblems_(result) {
  if (!result) return;
  var props = PropertiesService.getScriptProperties();
  var noQuota = result.noQuota && !props.getProperty(todayKey_(NO_QUOTA_PREFIX)) ? result.noQuota : 0;
  var failed = result.failed || [];
  if (!failed.length && !noQuota) return;
  var mail = buildSendAlert_(failed, noQuota);
  var m = { to: alertRecipients_().join(','), subject: mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' };
  try {
    deliverMail_(m);
  } catch (e) {
    MailApp.sendEmail(m);
  }
  if (noQuota) props.setProperty(todayKey_(NO_QUOTA_PREFIX), '1');
}

/**
 * Sends one mail. Returns false (and logs, without the address) when Gmail rejects it: the address
 * comes from the student, so one bad address must not stop the rest. It stays unmarked.
 */
function sendMail_(to, mail) {
  try {
    deliverMail_({ to: to, subject: mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' });
    lastMailError_ = '';
    return true;
  } catch (e) {
    lastMailError_ = String((e && e.message) || e).slice(0, 300);
    Logger.log('No se pudo mandar un mail: ' + e);
    return false;
  }
}

/**
 * The confirmations pass, under the same lock as the reminders (never twice at once). Returns the
 * counts, or null when another run holds the lock.
 */
function confirmPass_() {
  var result = null;
  withLock_(function () {
    result = sendConfirmations_(rpc_('avisos_confirmaciones', {}));
    if (result.sent || result.left) Logger.log('Confirmaciones enviadas: ' + result.sent + '. Quedan para la próxima: ' + result.left + '.');
  });
  return result;
}

/** Sends the due confirmation mails, leaving CONFIRM_QUOTA_RESERVE of the quota. Returns counts. */
function sendConfirmations_(rows) {
  var due = confirmRows_(rows);
  var sent = 0;
  if (!due.length) return { sent: 0, left: 0 };
  // Check that marking works first (no student has this address: it answers 0).
  rpc_('avisos_confirmacion_enviada', { p_email: '' });
  for (var i = 0; i < due.length; i++) {
    if (mailQuota_() <= CONFIRM_QUOTA_RESERVE) break;
    var row = due[i];
    var mail = buildConfirmMail_(row);
    if (!sendMail_(row.email, mail)) continue; // a rejected address never blocks the others
    // Right after each mail. If marking fails, stop here: at most this one could go twice.
    rpc_('avisos_confirmacion_enviada', { p_email: row.email });
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

/** The panel is only to look at: if it fails, the mails still go. */
function panelSafe_(rows) {
  try {
    writePanel_(rows);
  } catch (e) {
    Logger.log('Panel: ' + e);
  }
}

/** The "Panel" tab: mails per day against the daily limit (see panelValues_). Only to look at. */
function writePanel_(rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(PANEL_NAME) || ss.insertSheet(PANEL_NAME);
  var today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  var capacity = brevoKey_() ? BREVO_DAILY_LIMIT : GMAIL_DAILY_LIMIT;
  var hour = Number(Utilities.formatDate(new Date(), TIME_ZONE, 'H'));
  var panel = panelValues_(rows, today, capacity, mailQuota_(), loadFailures_(), hour);
  var width = 7;
  var values = panel.lines.map(function (line) {
    var out = line.slice(0, width);
    while (out.length < width) out.push('');
    return out.map(function (v) { return typeof v === 'number' ? v : cell_(v); });
  });
  sheet.clear();
  sheet.getRange(1, 1, values.length, width).setValues(values);
  sheet.getRange(1, 1).setFontWeight('bold').setFontSize(14);
  panel.bold.forEach(function (r) { sheet.getRange(r + 1, 1, 1, width).setFontWeight('bold'); });
  panel.warn.forEach(function (r) { sheet.getRange(r + 1, 1, 1, width).setBackground('#fde2dc'); });
  panel.ok.forEach(function (r) { sheet.getRange(r + 1, 1, 1, width).setBackground('#dff3e4'); });
  sheet.setColumnWidth(1, 230);
  sheet.setColumnWidths(2, width - 1, 130);
  sheet.setFrozenRows(1);
}

// ---------------------------------------------------------------------------------------------
// Pure functions (no Google services): tested in the repo
// ---------------------------------------------------------------------------------------------

/**
 * Rows whose mail is due now (the database decides), only to a plain address: the student's
 * @fi.uba.ar account or the other mail they set (the database only gives @fi.uba.ar accounts).
 */
function dueRows_(rows) {
  return rows.filter(function (r) {
    return r.due === true && EMAIL_RE.test(r.email || '');
  });
}

/** Confirmations to send: a plain address and at least one mesa. */
function confirmRows_(rows) {
  return rows.filter(function (r) {
    return EMAIL_RE.test(r.email || '') && Number(r.mesas) > 0;
  });
}

/** What doPost() does with the body: checks the token and the action, then runs pass(). */
function handlePost_(body, token, pass) {
  if (!token || !body || typeof body.token !== 'string' || !sameToken_(body.token, token)) return { ok: false, error: 'token' };
  if (body.action !== 'confirm') return { ok: false, error: 'action' };
  var result = pass();
  return result ? { ok: true, sent: result.sent, left: result.left } : { ok: true, busy: true };
}

/** Compares two tokens without stopping at the first different character. */
function sameToken_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** "ANA", "maría josé" → "Ana", "María"; '' when Google gave no name. */
function firstName_(name) {
  var first = String(name || '').trim().split(/\s+/)[0] || '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
}

/** 'YYYY-MM-DD' plus n days. */
function addDays_(date, n) {
  var p = date.split('-').map(Number);
  return new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)).toISOString().slice(0, 10);
}

/** Last day the mail can still go: the enrollment closes at enroll_to, and mails go from 08:00. */
function lastSendDay_(enrollTo) {
  var day = enrollTo.slice(0, 10);
  return enrollTo.slice(11, 16) > '08:00' ? day : addDays_(day, -1);
}

/**
 * The "Panel" tab: how many reminder mails each day needs, against the daily limit. One mail per
 * reminder on its aviso day; what does not fit waits for the next day (those that close first go
 * first), and those whose enrollment closes before their turn are lost. Today uses what is left of
 * today's quota. Returns the lines and which ones to paint (0-based).
 */
function panelValues_(rows, today, capacity, leftToday, failures, hour) {
  failures = failures || {};
  var lines = [];
  var bold = [];
  var warn = [];
  var ok = [];
  var byDay = {};
  var sentByDay = {};
  var pending = 0;
  rows.forEach(function (r) {
    if (r.sent_at) {
      var d = String(r.sent_at).slice(0, 10);
      sentByDay[d] = (sentByDay[d] || 0) + 1;
      return;
    }
    if (!r.aviso || !r.enroll_to || !EMAIL_RE.test(r.email || '')) return;
    var last = lastSendDay_(String(r.enroll_to));
    if (last < today) return; // its enrollment already closed
    var day = r.aviso < today ? today : r.aviso; // overdue: it goes as soon as possible
    (byDay[day] = byDay[day] || []).push(last);
    pending++;
  });

  var days = Object.keys(byDay).sort();
  var queue = [];
  var table = [];
  var late = 0;
  var lost = 0;
  var peak = { day: '', n: 0 };
  if (days.length) {
    var end = days[days.length - 1];
    for (var day = days[0]; day <= end || queue.length; day = addDays_(day, 1)) {
      var arriving = byDay[day] || [];
      var carried = queue.length;
      queue = queue.concat(arriving).sort();
      var cap = day === today ? Math.min(capacity, leftToday) : capacity;
      var toSend = queue.length;
      var sent = Math.min(cap, toSend);
      queue = queue.slice(sent);
      var expired = queue.filter(function (last) { return last <= day; }).length;
      queue = queue.filter(function (last) { return last > day; });
      late += queue.length;
      lost += expired;
      if (arriving.length > peak.n) peak = { day: day, n: arriving.length };
      if (arriving.length || carried) {
        var state = expired ? 'No alcanza: ' + expired + ' sin mail' : queue.length ? 'Se atrasan ' + queue.length : 'OK';
        table.push([longDay_(day), arriving.length, carried, toSend, sent, queue.length, state]);
      }
      if (table.length > 120) break;
    }
  }

  lines.push(['Panel de envíos de Recordarme', '', '', '', '', '', 'Actualizado: ' + longDay_(today)]);
  lines.push([]);
  lines.push(['Límite por día', capacity]);
  lines.push(['Quedan hoy', leftToday]);
  lines.push(['Mails por mandar', pending]);
  lines.push(['Día con más mails', peak.n ? longDay_(peak.day) + ' (' + peak.n + ')' : '—']);
  var verdict = !pending ? 'Sí: no hay mails por mandar'
    : lost ? 'No: ' + lost + ' mails no llegarían antes del cierre de la inscripción'
    : late ? 'Justo: todos salen a tiempo, pero algunos un día después'
    : 'Sí: todo sale el día que corresponde';
  lines.push(['¿Alcanza?', verdict]);
  (lost || late ? warn : ok).push(lines.length - 1);
  bold.push(lines.length - 1);
  lines.push([]);

  var todays = todayMails_(rows, today, leftToday, failures, hour);
  var failedToday = todays.filter(function (t) { return /^Falló/.test(t[4]); }).length;
  lines.push(['Mails de hoy', todays.length ? todays.length + (failedToday ? ' (' + failedToday + ' con error)' : '') : 'ninguno']);
  bold.push(lines.length - 1);
  if (failedToday) warn.push(lines.length - 1);
  if (todays.length) {
    lines.push(['Materia', 'Mesa', 'Examen', 'Para', 'Estado']);
    bold.push(lines.length - 1);
    todays.forEach(function (t) {
      lines.push(t);
      if (/^(Falló|Sin cupo|Mail inválido)/.test(t[4])) warn.push(lines.length - 1);
      else if (/^Enviado/.test(t[4])) ok.push(lines.length - 1);
    });
  }
  lines.push([]);

  lines.push(['Día', 'Tocan ese día', 'Atrasados', 'Para mandar', 'Se mandan', 'Pasan al otro día', 'Estado']);
  bold.push(lines.length - 1);
  if (!table.length) lines.push(['No hay mails programados.']);
  table.forEach(function (t) {
    lines.push(t);
    if (t[6] !== 'OK') warn.push(lines.length - 1);
  });
  lines.push([]);

  lines.push(['Enviados (últimos 14 días)', 'Mails']);
  bold.push(lines.length - 1);
  var any = false;
  for (var i = 13; i >= 0; i--) {
    var d = addDays_(today, -i);
    if (!sentByDay[d]) continue;
    lines.push([longDay_(d), sentByDay[d]]);
    any = true;
  }
  if (!any) lines.push(['Todavía no se mandó ninguno.']);
  lines.push([]);
  lines.push(['Cuenta solo los recordatorios. Las confirmaciones ("Activaste tus recordatorios") usan el mismo límite.']);
  return { lines: lines, bold: bold, warn: warn, ok: ok };
}

/**
 * The mails of today for the panel: sent today, failed, or still to go (their day is today, or
 * earlier and still within the enrollment). One line each: materia, mesa, exam day, to, state.
 */
function todayMails_(rows, today, leftToday, failures, hour) {
  var out = [];
  rows.forEach(function (r) {
    var sentToday = r.sent_at && String(r.sent_at).slice(0, 10) === today;
    var pending = !r.sent_at && r.aviso && r.aviso <= today && r.enroll_to && lastSendDay_(String(r.enroll_to)) >= today;
    if (!sentToday && !pending) return;
    var state;
    var fail = failures[r.reminder_id];
    if (sentToday) state = 'Enviado ' + String(r.sent_at).slice(11, 16);
    else if (!EMAIL_RE.test(r.email || '')) state = 'Mail inválido: no se puede mandar';
    else if (fail) state = 'Falló (' + fail.at + '): ' + fail.error;
    else if (hour !== undefined && hour < SEND_FROM_HOUR) state = 'Sale a las ' + SEND_FROM_HOUR + ':00';
    else if (leftToday < 1) state = 'Sin cupo hoy: sale mañana';
    else state = 'Pendiente: sale en la próxima corrida';
    out.push([r.subject_name, tableLabel_(r), r.exam_date ? longDay_(r.exam_date) : '', r.email || '', state]);
  });
  return out;
}

/** The alert to the admins: mails that failed today (first time) and/or the daily limit spent. */
function buildSendAlert_(failed, noQuota) {
  var n = failed.length;
  var parts = [];
  if (n) parts.push(n === 1 ? '1 mail no salió' : n + ' mails no salieron');
  if (noQuota) parts.push('se terminó el cupo del día');
  var subject = 'FIUBI · Recordarme: ' + parts.join(' y ');
  var text = [];
  var html = [];
  if (n) {
    text.push('Estos recordatorios no se pudieron mandar. Se vuelven a intentar cada hora:');
    html.push('<p>Estos recordatorios no se pudieron mandar. Se vuelven a intentar cada hora:</p><ul>');
    failed.forEach(function (f) {
      var r = f.row;
      var line = r.subject_name + ' · ' + tableLabel_(r) + ' → ' + (r.email || '(sin mail)') + ': ' + (f.error || 'error desconocido');
      text.push('- ' + line);
      html.push('<li>' + escape_(line) + '</li>');
    });
    html.push('</ul>');
  }
  if (noQuota) {
    var q = 'Se terminó el cupo de mails de hoy y quedan ' + noQuota + ' recordatorios por mandar: salen mañana desde las ' + SEND_FROM_HOUR + ':00, si la inscripción sigue abierta.';
    text.push('', q);
    html.push('<p>' + escape_(q) + '</p>');
  }
  var foot = 'El detalle está en la pestaña Panel de la planilla.';
  text.push('', foot);
  html.push('<p style="color:#5b6275">' + foot + '</p>');
  return { subject: subject, text: text.join('\n'), html: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2537">' + html.join('') + '</div>' };
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

/**
 * The confirmation mail, sent once when a student activates their reminders (or changes the address):
 * so they find it now and teach their inbox that the reminders are not spam. Same frame as
 * buildMail_() (logo, colored band, card, button, footer), lavender band. r: {email, first_name, mesas}.
 */
function buildConfirmMail_(r) {
  var name = firstName_(r.first_name);
  var n = Number(r.mesas) || 0;
  var mesas = n === 1 ? '1 mesa' : n + ' mesas';
  var subject = 'Activaste tus recordatorios de FIUBI';
  var band = 'Recordatorios activados';
  var title = name ? '¡Listo, ' + name + '!' : '¡Listo!';
  var lead = 'Elegiste ' + mesas + '. Te vamos a escribir a este mail cuando abra la inscripción' + (n === 1 ? '.' : ' de cada una.');
  var tipsTitle = 'Para que los avisos no se pierdan';
  var tips = [
    'Si este mail te llegó a Spam, tocá «No es spam» para que los avisos te lleguen a Recibidos.',
    'Agregá ' + SENDER + ' a tus contactos.',
  ];
  var footer = [
    'Te llega porque activaste los recordatorios en FIUBI. Para dejar de recibirlos, sacalos en Finales → Recordarme. Si no fuiste vos, escribinos a contacto@fiubi.com.ar.',
    'Hecho por estudiantes, no es un sitio oficial de la universidad.',
  ];

  var text = [
    band.toUpperCase(),
    '',
    title,
    'Activaste tus recordatorios de FIUBI.',
    lead,
    '',
    tipsTitle + ':',
  ].concat(tips.map(function (t, i) { return (i + 1) + '. ' + t; })).concat([
    '',
    'Ver mis finales en FIUBI: ' + LINKS.finales,
    '',
    '—',
  ]).concat(footer).join('\n') + '\n';

  var c = { band: '#e4ecfc', bandInk: '#22408f', bandLine: '#d6e0f7', tip: '#fff0d3', tipInk: '#5c4510', tipLine: '#f2dca6' }; // lavender and butter, as the app
  var font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  var tipRows = tips.map(function (t, i) {
    return '<tr>' +
      '<td style="padding:' + (i ? '10px' : '0') + ' 0 0 0;width:28px;vertical-align:top;font-family:' + font + ';font-size:15px;line-height:22px;font-weight:700;color:' + c.tipInk + ';">' + (i + 1) + '.</td>' +
      '<td style="padding:' + (i ? '10px' : '0') + ' 0 0 0;vertical-align:top;font-family:' + font + ';font-size:15px;line-height:22px;color:' + c.tipInk + ';">' + escape_(t) + '</td>' +
      '</tr>';
  }).join('');

  var html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    '<title>' + escape_(subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background-color:#f6f7fa;">' +
    // Preview line in the inbox, hidden in the mail.
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">' + escape_(lead + ' Si te llegó a Spam, tocá «No es spam».') + '</div>' +
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
    // Title and lead
    '<tr><td style="padding:24px 28px 4px 28px;font-family:' + font + ';font-size:13px;line-height:18px;color:#5e667a;">Activaste tus recordatorios de FIUBI</td></tr>' +
    '<tr><td style="padding:0 28px 8px 28px;font-family:' + font + ';font-size:26px;line-height:32px;font-weight:700;color:#1f2537;">' + escape_(title) + '</td></tr>' +
    '<tr><td style="padding:0 28px 20px 28px;font-family:' + font + ';font-size:15px;line-height:22px;color:#3b4357;">' + escape_(lead) + '</td></tr>' +
    // Tips card
    '<tr><td style="padding:0 28px 24px 28px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:' + c.tip + ';border:1px solid ' + c.tipLine + ';border-radius:12px;border-collapse:separate;">' +
    '<tr><td style="padding:16px 18px;">' +
    '<div style="font-family:' + font + ';font-size:15px;line-height:22px;font-weight:700;color:' + c.tipInk + ';padding:0 0 8px 0;">' + escape_(tipsTitle) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' + tipRows + '</table>' +
    '</td></tr></table></td></tr>' +
    // Button
    '<tr><td style="padding:0 28px 28px 28px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td align="center" bgcolor="#3b5bd0" style="background-color:#3b5bd0;border-radius:10px;">' +
    '<a href="' + LINKS.finales + '" style="display:inline-block;padding:14px 26px;font-family:' + font + ';font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Ver mis finales</a>' +
    '</td></tr></table></td></tr>' +
    '</table>' +
    // Footer
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">' +
    '<tr><td style="padding:16px 28px 0 28px;font-family:' + font + ';font-size:12px;line-height:18px;color:#5e667a;">' +
    footer.map(escape_).join('<br>') + '</td></tr></table>' +
    '</td></tr></table></body></html>';

  return { subject: subject, text: text, html: html };
}

/** Sample data for sendTestConfirmMail() and preview.html. */
function sampleConfirmRow_() {
  return { email: 'alumno@fi.uba.ar', first_name: 'ANA', mesas: 3 };
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
