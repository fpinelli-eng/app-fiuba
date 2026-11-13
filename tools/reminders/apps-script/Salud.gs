/**
 * FIUBI: health monitor. Mails the admins when something of the app breaks.
 *
 * Second file of the Apps Script of the reminders sheet (avisosfiubi@gmail.com), next to Code.gs:
 * hourly() calls saludCheck_() after sending the reminders, each in its own try, so a broken check
 * never stops the reminders and vice versa. Guide: tools/reminders/README.md, "Monitor".
 *
 * Every hour it checks:
 *   - the database answers salud() (migration 20261115130000_salud.sql, same TOKEN as the
 *     reminders): only counts and dates, never data of a student;
 *   - the SIU exam dates were read in the last SALUD_LIMITS.examHours (GitHub runs it every morning);
 *   - the FIUBA news were copied in the last SALUD_LIMITS.newsHours;
 *   - no "Recordarme" mail is due for more than SALUD_LIMITS.reminderHours (sending is broken);
 *   - https://fiubi.com.ar and its robots.txt answer 200 (alert after two failures in a row).
 *
 * It mails only when the list of problems changes (a new one, or one solved), at most
 * SALUD_LIMITS.mailsPerDay mails a day, to the Script Property ALERT_TO (comma-separated; if
 * missing, the account running the script). What it remembers is in the Script Property
 * SALUD_STATE (delete it to start over).
 *
 * Functions to run by hand (Run ▸): saludProbar (checks and logs, mails nothing),
 * saludMailDePrueba (a sample alert to ALERT_TO). Every name here starts with "salud" or
 * "SALUD_": Apps Script puts all files in one global scope. The pure functions are tested in the
 * repo (src/lib/reminders/salud.test.ts).
 */

var SALUD_URLS = ['https://fiubi.com.ar', 'https://fiubi.com.ar/robots.txt'];
var SALUD_PANEL = 'https://fiubi.com.ar/admin/estado';
var SALUD_LOGO = 'https://fiubi.com.ar/brand/fiubi-logo-mail.png';
var SALUD_LIMITS = {
  examHours: 36,     // the sync runs every morning: this is more than one skipped run
  newsHours: 48,     // once a day in the evening
  reminderHours: 3,  // the reminders go every hour from 08:00
  httpFailures: 2,   // in a row, so one slow answer does not wake anybody
  mailsPerDay: 4,
};
var SALUD_DB_CHECKS = ['examenes', 'noticias', 'recordatorios'];
var SALUD_HOUR = 60 * 60 * 1000;

// ---------------------------------------------------------------------------------------------
// Functions to run by hand
// ---------------------------------------------------------------------------------------------

/** Runs every check and logs the result. Mails nothing and does not change what it remembers. */
function saludProbar() {
  var r = saludCheck_({ dryRun: true });
  if (!r) return;
  Logger.log(saludLog_(r.checks) + '\n\n' + (r.mail
    ? 'En una corrida normal mandaría un mail a ' + r.recipients.join(', ') + '.'
    : 'En una corrida normal no mandaría mail (nada cambió desde el último aviso).'));
}

/** Sends a sample alert to ALERT_TO (or the account running the script). Touches nothing else. */
function saludMailDePrueba() {
  var recipients = saludRecipients_(PropertiesService.getScriptProperties().getProperty('ALERT_TO'), saludOwner_());
  var mail = saludBuildMail_(saludSampleProblems_(), [{ key: 'web:https://fiubi.com.ar', title: 'fiubi.com.ar' }], Date.now());
  MailApp.sendEmail({ to: recipients.join(','), subject: '[Prueba] ' + mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' });
  Logger.log('Listo: se mandó un aviso de prueba a ' + recipients.join(', ') + '.');
}

// ---------------------------------------------------------------------------------------------
// Google services
// ---------------------------------------------------------------------------------------------

/** The hourly check. Returns what it saw (for saludProbar) or null if another run holds the lock. */
function saludCheck_(opts) {
  var dryRun = !!(opts && opts.dryRun);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) {
    Logger.log('Monitor: otra ejecución sigue corriendo.');
    return null;
  }
  try {
    var props = PropertiesService.getScriptProperties();
    var prev = saludParseState_(props.getProperty('SALUD_STATE'));
    var data = null;
    var dataError = null;
    try {
      data = rpc_('salud', {})[0] || null; // rpc_() and the TOKEN are those of Code.gs
      if (!data) dataError = 'respuesta vacía';
    } catch (e) {
      dataError = String(e && e.message || e);
    }
    var http = SALUD_URLS.map(function (url) {
      try {
        var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
        return { url: url, code: res.getResponseCode() };
      } catch (e) {
        return { url: url, code: null };
      }
    });
    var now = Date.now();
    var r = saludEvaluate_(prev, data, dataError, http, now);
    r.recipients = saludRecipients_(props.getProperty('ALERT_TO'), saludOwner_());
    Logger.log('Monitor: ' + (r.problems.length ? r.problems.map(function (p) { return p.title; }).join('; ') : 'todo bien') + '.');
    if (dryRun) return r;
    if (r.mail) {
      try {
        var mail = saludBuildMail_(r.problems, r.resolved, now);
        MailApp.sendEmail({ to: r.recipients.join(','), subject: mail.subject, body: mail.text, htmlBody: mail.html, name: 'FIUBI' });
      } catch (e) {
        // Not sent: keep the last notified list, so the next run tries again.
        r.state.notified = prev.notified;
        r.state.mails = prev.day === r.state.day ? prev.mails : 0;
        props.setProperty('SALUD_STATE', JSON.stringify(r.state));
        throw e;
      }
    }
    props.setProperty('SALUD_STATE', JSON.stringify(r.state));
    return r;
  } finally {
    lock.releaseLock();
  }
}

function saludOwner_() {
  return Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail();
}

// ---------------------------------------------------------------------------------------------
// Pure functions (no Google services): tested in the repo
// ---------------------------------------------------------------------------------------------

/** The remembered state, or an empty one. */
function saludParseState_(raw) {
  var s = {};
  try { s = raw ? JSON.parse(raw) : {}; } catch (e) { s = {}; }
  return {
    http: s.http && typeof s.http === 'object' ? s.http : {},       // url → failures in a row
    notified: s.notified && typeof s.notified === 'object' ? s.notified : {}, // key → title, last mailed
    day: typeof s.day === 'string' ? s.day : '',
    mails: typeof s.mails === 'number' ? s.mails : 0,
  };
}

/** "2026-11-13" in Buenos Aires (UTC−3, no daylight saving time). */
function saludDay_(now) {
  return new Date(now - 3 * SALUD_HOUR).toISOString().slice(0, 10);
}

/** "5 min", "3 h", "2 días". */
function saludAge_(ms) {
  var min = Math.max(0, Math.floor(ms / 60000));
  if (min < 60) return min + ' min';
  var h = Math.floor(min / 60);
  if (h < 48) return h + ' h';
  return Math.floor(h / 24) + ' días';
}

/** Hours since an ISO date (Infinity when there is none). */
function saludHours_(iso, now) {
  var t = iso ? Date.parse(iso) : NaN;
  return isNaN(t) ? Infinity : (now - t) / SALUD_HOUR;
}

function saludAgo_(iso, now) {
  var h = saludHours_(iso, now);
  return h === Infinity ? 'nunca' : 'hace ' + saludAge_(h * SALUD_HOUR);
}

function saludHost_(url) {
  return url.replace(/^https?:\/\//, '');
}

/**
 * Every check, with ok and a short detail (counts and ages only).
 * data: the row of salud(), or null with dataError. httpFails: url → failures in a row (already
 * counting this run); http: this run's answers.
 */
function saludChecks_(data, dataError, http, httpFails, now) {
  var L = SALUD_LIMITS;
  var checks = [];
  if (dataError) {
    checks.push({ key: 'base', title: 'La base no responde', ok: false,
      detail: 'El monitor no pudo leer el estado: ' + String(dataError).slice(0, 160) });
  } else {
    checks.push({ key: 'base', title: 'Base de datos', ok: true, detail: 'Responde.' });
    var exam = saludHours_(data.exam_sync_at, now);
    checks.push({ key: 'examenes', title: exam > L.examHours ? 'Las fechas de examen no se actualizan' : 'Fechas de examen del SIU',
      ok: exam <= L.examHours, detail: 'Última lectura del SIU: ' + saludAgo_(data.exam_sync_at, now) + '.' });
    var news = saludHours_(data.news_fetched_at, now);
    checks.push({ key: 'noticias', title: news > L.newsHours ? 'Las noticias de la FIUBA no se actualizan' : 'Noticias de la FIUBA',
      ok: news <= L.newsHours, detail: 'Última copia: ' + saludAgo_(data.news_fetched_at, now) + '.' });
    var due = Number(data.reminders_due) || 0;
    var late = due > 0 && saludHours_(data.reminders_due_since, now) > L.reminderHours;
    checks.push({ key: 'recordatorios', title: late ? 'Hay mails de Recordarme sin mandar' : 'Mails de Recordarme', ok: !late,
      detail: due === 0 ? 'Ninguno pendiente.'
        : due + ' por mandar; el más viejo tenía que salir ' + saludAgo_(data.reminders_due_since, now) + '.' });
  }
  http.forEach(function (h) {
    var fails = httpFails[h.url] || 0;
    var answer = h.code === null ? 'no respondió' : 'respondió ' + h.code;
    checks.push({ key: 'web:' + h.url, title: fails >= L.httpFailures ? saludHost_(h.url) + ' no anda' : saludHost_(h.url),
      ok: fails < L.httpFailures,
      detail: fails === 0 ? 'Responde 200.'
        : fails < L.httpFailures ? 'Falló una vez (' + answer + '); avisa si vuelve a fallar.'
        : 'Falló ' + fails + ' veces seguidas (' + answer + ').' });
  });
  return checks;
}

/**
 * The whole decision of one run: checks, problems, whether to mail and the next state.
 * Mails when the set of problems differs from the last mailed one (a new problem or a solved
 * one), at most SALUD_LIMITS.mailsPerDay a day. When the database does not answer, the checks
 * that need it keep what was last mailed (unknown is not solved).
 */
function saludEvaluate_(prev, data, dataError, http, now) {
  var httpFails = {};
  http.forEach(function (h) {
    httpFails[h.url] = h.code === 200 ? 0 : (prev.http[h.url] || 0) + 1;
  });
  var checks = saludChecks_(data, dataError, http, httpFails, now);
  var problems = checks.filter(function (c) { return !c.ok; });
  if (dataError) {
    SALUD_DB_CHECKS.forEach(function (key) {
      if (prev.notified[key]) problems.push({ key: key, title: prev.notified[key], ok: false, detail: 'Sin datos nuevos: la base no responde.' });
    });
  }
  var current = {};
  problems.forEach(function (p) { current[p.key] = p.title; });
  var resolved = Object.keys(prev.notified).filter(function (k) { return !(k in current); })
    .map(function (k) { return { key: k, title: prev.notified[k] }; });
  var changed = resolved.length > 0 || problems.some(function (p) { return !(p.key in prev.notified); });

  var day = saludDay_(now);
  var mails = prev.day === day ? prev.mails : 0;
  var mail = changed && mails < SALUD_LIMITS.mailsPerDay;
  return {
    checks: checks,
    problems: problems,
    resolved: resolved,
    mail: mail,
    state: { http: httpFails, notified: mail ? current : prev.notified, day: day, mails: mail ? mails + 1 : mails },
  };
}

/** Addresses from ALERT_TO (comma-separated); the fallback when there is none valid. */
function saludRecipients_(raw, fallback) {
  var seen = {};
  var list = String(raw || '').split(/[,;\s]+/).map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) {
      if (!/^[^\s@<>",]+@[^\s@<>",]+\.[a-z]{2,}$/.test(s) || seen[s]) return false;
      seen[s] = true;
      return true;
    });
  return list.length ? list : [fallback];
}

/** The log of saludProbar(): one line per check. */
function saludLog_(checks) {
  return checks.map(function (c) { return (c.ok ? '✅ ' : '⚠️ ') + c.title + ': ' + c.detail; }).join('\n');
}

function saludEscape_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * The alert: the problems now and the ones solved since the last mail. Counts and ages only.
 * Email-safe HTML like the reminder mail (Code.gs, buildMail_()), plus a plain-text version.
 */
function saludBuildMail_(problems, resolved, now) {
  var n = problems.length;
  var subject = n === 0 ? 'FIUBI: todo volvió a andar'
    : n === 1 ? 'FIUBI: ' + problems[0].title
    : 'FIUBI: ' + n + ' problemas';
  var band = n === 0 ? 'Todo volvió a andar' : n === 1 ? 'Hay un problema' : 'Hay ' + n + ' problemas';
  var when = new Date(now - 3 * SALUD_HOUR).toISOString().slice(0, 16).replace('T', ' ') + ' (hora de Buenos Aires)';
  var footer = [
    'Lo manda el monitor de la planilla de avisosfiubi@gmail.com (Salud.gs). Llega solo cuando aparece o se resuelve un problema.',
  ];

  var text = [band.toUpperCase(), when, ''];
  problems.forEach(function (p) { text.push('⚠️ ' + p.title, '   ' + p.detail); });
  if (resolved.length) {
    if (problems.length) text.push('');
    text.push('Se resolvió:');
    resolved.forEach(function (p) { text.push('✅ ' + p.title); });
  }
  text = text.concat(['', 'Ver el estado: ' + SALUD_PANEL, '', '—'], footer).join('\n') + '\n';

  var c = n === 0
    ? { band: '#dff2e9', bandInk: '#245c48', bandLine: '#bfe3d1' }  // mint, as the app
    : { band: '#fcebe7', bandInk: '#7a2a1e', bandLine: '#f4cfc6' }; // peach, as the app
  var font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  var items = problems.map(function (p) { return { mark: '⚠️', title: p.title, detail: p.detail }; })
    .concat(resolved.map(function (p) { return { mark: '✅', title: p.title, detail: 'Se resolvió.' }; }));
  var rows = items.map(function (it, i) {
    var border = i < items.length - 1 ? 'border-bottom:1px solid #e6e9f0;' : '';
    return '<tr>' +
      '<td style="padding:12px 0 12px 16px;' + border + 'font-size:16px;line-height:22px;width:28px;vertical-align:top;">' + it.mark + '</td>' +
      '<td style="padding:12px 16px 12px 8px;' + border + 'font-family:' + font + ';vertical-align:top;">' +
      '<div style="font-size:15px;line-height:22px;color:#1f2537;font-weight:600;">' + saludEscape_(it.title) + '</div>' +
      '<div style="font-size:13px;line-height:20px;color:#5e667a;">' + saludEscape_(it.detail) + '</div></td>' +
      '</tr>';
  }).join('');

  var html =
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">' +
    '<title>' + saludEscape_(subject) + '</title></head>' +
    '<body style="margin:0;padding:0;background-color:#f6f7fa;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f7fa;">' +
    '<tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:#ffffff;border:1px solid #e6e9f0;border-radius:16px;border-collapse:separate;">' +
    '<tr><td style="padding:24px 28px 20px 28px;">' +
    '<a href="' + SALUD_PANEL + '" style="text-decoration:none;"><img src="' + SALUD_LOGO + '" width="112" height="31" alt="FIUBI" style="display:block;border:0;outline:none;width:112px;height:31px;"></a>' +
    '</td></tr>' +
    '<tr><td style="background-color:' + c.band + ';border-top:1px solid ' + c.bandLine + ';border-bottom:1px solid ' + c.bandLine + ';padding:12px 28px;font-family:' + font + ';font-size:14px;line-height:20px;font-weight:700;color:' + c.bandInk + ';">' +
    saludEscape_(band) + '</td></tr>' +
    '<tr><td style="padding:20px 28px 16px 28px;font-family:' + font + ';font-size:13px;line-height:18px;color:#5e667a;">' + saludEscape_(when) + '</td></tr>' +
    (rows ? '<tr><td style="padding:0 28px 24px 28px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f6f7fa;border:1px solid #e6e9f0;border-radius:12px;border-collapse:separate;">' +
      rows + '</table></td></tr>' : '') +
    '<tr><td style="padding:0 28px 28px 28px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td align="center" bgcolor="#3b5bd0" style="background-color:#3b5bd0;border-radius:10px;">' +
    '<a href="' + SALUD_PANEL + '" style="display:inline-block;padding:14px 26px;font-family:' + font + ';font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Ver el estado</a>' +
    '</td></tr></table></td></tr>' +
    '</table>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">' +
    '<tr><td style="padding:16px 28px 0 28px;font-family:' + font + ';font-size:12px;line-height:18px;color:#5e667a;">' +
    footer.map(saludEscape_).join('<br>') + '</td></tr></table>' +
    '</td></tr></table></body></html>';

  return { subject: subject, text: text, html: html };
}

/** Sample problems for saludMailDePrueba(). */
function saludSampleProblems_() {
  return [
    { key: 'examenes', title: 'Las fechas de examen no se actualizan', detail: 'Última lectura del SIU: hace 2 días.' },
    { key: 'recordatorios', title: 'Hay mails de Recordarme sin mandar', detail: '12 por mandar; el más viejo tenía que salir hace 4 h.' },
  ];
}
