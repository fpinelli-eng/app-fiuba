// The health monitor of the Apps Script (tools/reminders/apps-script/Salud.gs), loaded as Apps
// Script would load it: in the same global scope as Code.gs. Google services are mocked.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "tools/reminders/apps-script");
const source = (name: string) => readFileSync(join(dir, name), "utf8");

interface Check {
  key: string;
  title: string;
  ok: boolean;
  detail: string;
}
interface State {
  http: Record<string, number>;
  notified: Record<string, string>;
  day: string;
  mails: number;
}
interface Result {
  checks: Check[];
  problems: Check[];
  resolved: { key: string; title: string }[];
  mail: boolean;
  state: State;
}
type Data = Record<string, string | number | null>;
interface CalendarSeen {
  day: string;
  files: string[] | null;
}
interface CalendarResult {
  status: string;
  log: string;
  mail: boolean;
  added: string[];
  removed: string[];
  state: CalendarSeen | null;
}
interface Http {
  url: string;
  code: number | null;
}
interface SaludGs {
  saludEvaluate_(prev: State, data: Data | null, dataError: string | null, http: Http[], now: number): Result;
  saludParseState_(raw: string | null): State;
  saludRecipients_(raw: string | null, fallback: string): string[];
  saludAge_(ms: number): string;
  saludBuildMail_(problems: Check[], resolved: { key: string; title: string }[], now: number): { subject: string; text: string; html: string };
  saludLog_(checks: Check[]): string;
  saludCalendarParse_(raw: string | null): CalendarSeen;
  saludCalendarDue_(prev: CalendarSeen, now: number): boolean;
  saludCalendarPdfs_(html: string): string[];
  saludCalendarEvaluate_(prev: CalendarSeen, page: { code: number; html: string } | null, now: number): CalendarResult;
  saludCalendarMail_(added: string[], removed: string[], now: number): { subject: string; text: string; html: string };
  saludCheck_(opts?: { dryRun?: boolean }): (Result & { calendar: CalendarResult }) | null;
  hourly(): void;
  [key: string]: unknown;
}

/** Code.gs and Salud.gs in one context, as in Apps Script, with optional mocked globals. */
function load(globals: Record<string, unknown> = {}): SaludGs {
  const context = vm.createContext({ ...globals });
  vm.runInContext(source("Code.gs"), context, { filename: "Code.gs" });
  vm.runInContext(source("Salud.gs"), context, { filename: "Salud.gs" });
  return context as unknown as SaludGs;
}

const gs = load();
const H = 60 * 60 * 1000;
const NOW = Date.parse("2026-11-20T15:00:00Z"); // 12:00 in Buenos Aires
const ago = (hours: number) => new Date(NOW - hours * H).toISOString();
const SITE = "https://fiubi.com.ar";
const ROBOTS = "https://fiubi.com.ar/robots.txt";

const healthy = (over: Data = {}): Data => ({
  checked_at: new Date(NOW).toISOString(),
  exam_sync_at: ago(5),
  news_fetched_at: ago(15),
  reminders_due: 0,
  reminders_due_since: null,
  ...over,
});
const up: Http[] = [
  { url: SITE, code: 200 },
  { url: ROBOTS, code: 200 },
];
const fresh = () => gs.saludParseState_(null);

/** A Date whose "now" is fixed, for the code that reads the clock (the vm context has its own Date). */
function fixedDate(now: number) {
  return class extends Date {
    constructor(...a: unknown[]) {
      super(...((a.length ? a : [now]) as [number]));
    }
    static now() {
      return now;
    }
  };
}

const CALENDAR = "https://www.fi.uba.ar/estudiantes/calendario-academico";
const PDF_2026 = "Calendario_Academico_2026_2027_81c0faa452_909e52c493.pdf";
const PDF_2025 = "Calendario_Academico_2025_2026_43483483f2.pdf";
/** The calendar page as fi.uba.ar serves it: absolute links in the HTML, relative ones in its JSON. */
const calendarPage = (current: string) =>
  `<h1>Calendario académico</h1><p>Enero 2026 - Marzo 2027 <a href="https://cms.fi.uba.ar/uploads/${current}">(+)</a></p>` +
  `<p>Febrero 2025 - Marzo 2026 <a href="https://cms.fi.uba.ar/uploads/${PDF_2025}">(+)</a></p>` +
  `<img src="https://cms.fi.uba.ar/uploads/logo_FIUBA_bco_e004995ae8.png"><a href="/uploads/${PDF_2025}">(+)</a>` +
  `<script id="__NEXT_DATA__">{"body":"[(+)](/uploads/${current})"}</script>`;
const keys = (r: Result) => r.problems.map((p) => p.key);

describe("Salud.gs and Code.gs share one global scope", () => {
  it("no top-level name is defined in both files", () => {
    const names = (file: string) => {
      const c = vm.createContext({});
      vm.runInContext(source(file), c);
      return new Set(Object.keys(c));
    };
    const code = names("Code.gs");
    const salud = [...names("Salud.gs")];
    expect(salud.filter((n) => code.has(n))).toEqual([]);
    expect(salud.every((n) => /^(salud|SALUD_)/.test(n))).toBe(true);
  });
});

describe("thresholds", () => {
  it("all good: no problems, no mail on the first run", () => {
    const r = gs.saludEvaluate_(fresh(), healthy(), null, up, NOW);
    expect(r.problems).toEqual([]);
    expect(r.mail).toBe(false);
    expect(r.checks.map((c) => c.key)).toEqual(["base", "examenes", "noticias", "recordatorios", `web:${SITE}`, `web:${ROBOTS}`]);
  });

  it("exam sync: ok at 36 h, problem after", () => {
    expect(keys(gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: ago(35.9) }), null, up, NOW))).toEqual([]);
    const r = gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: ago(37) }), null, up, NOW);
    expect(keys(r)).toEqual(["examenes"]);
    expect(r.problems[0].detail).toBe("Última lectura del SIU: hace 37 h.");
    expect(keys(gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: null }), null, up, NOW))).toEqual(["examenes"]);
  });

  it("reads the timestamps as the API sends them", () => {
    // PostgREST: microseconds and "+00:00".
    const r = gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: "2026-11-19T01:30:00.123456+00:00" }), null, up, NOW);
    expect(r.problems[0].detail).toBe("Última lectura del SIU: hace 37 h.");
  });

  it("news: problem after 48 h", () => {
    expect(keys(gs.saludEvaluate_(fresh(), healthy({ news_fetched_at: ago(47) }), null, up, NOW))).toEqual([]);
    const r = gs.saludEvaluate_(fresh(), healthy({ news_fetched_at: ago(73) }), null, up, NOW);
    expect(keys(r)).toEqual(["noticias"]);
    expect(r.problems[0].detail).toBe("Última copia: hace 3 días.");
  });

  it("reminders: due for more than 3 h is a problem; due for less is not", () => {
    expect(keys(gs.saludEvaluate_(fresh(), healthy({ reminders_due: 4, reminders_due_since: ago(2) }), null, up, NOW))).toEqual([]);
    const r = gs.saludEvaluate_(fresh(), healthy({ reminders_due: 4, reminders_due_since: ago(4) }), null, up, NOW);
    expect(keys(r)).toEqual(["recordatorios"]);
    expect(r.problems[0].detail).toBe("4 por mandar; el más viejo tenía que salir hace 4 h.");
  });

  it("the database not answering is one problem", () => {
    const r = gs.saludEvaluate_(fresh(), null, "La base respondió 401 (¿TOKEN…?)", up, NOW);
    expect(keys(r)).toEqual(["base"]);
    expect(r.mail).toBe(true);
  });
});

describe("web: two failures in a row", () => {
  const down: Http[] = [
    { url: SITE, code: 503 },
    { url: ROBOTS, code: 200 },
  ];

  it("one failure only counts; the second one alerts; a 200 resets", () => {
    const first = gs.saludEvaluate_(fresh(), healthy(), null, down, NOW);
    expect(first.problems).toEqual([]);
    expect(first.mail).toBe(false);
    expect(first.state.http[SITE]).toBe(1);
    expect(first.checks.find((c) => c.key === `web:${SITE}`)?.detail).toContain("Falló una vez (respondió 503)");

    const second = gs.saludEvaluate_(first.state, healthy(), null, down, NOW + H);
    expect(keys(second)).toEqual([`web:${SITE}`]);
    expect(second.problems[0].title).toBe("fiubi.com.ar no anda");
    expect(second.mail).toBe(true);

    const back = gs.saludEvaluate_(second.state, healthy(), null, up, NOW + 2 * H);
    expect(back.state.http[SITE]).toBe(0);
    expect(back.problems).toEqual([]);
    expect(back.resolved.map((p) => p.key)).toEqual([`web:${SITE}`]);
    expect(back.mail).toBe(true);
  });

  it("failure, success, failure never alerts", () => {
    let s = fresh();
    for (const [i, http] of [down, up, down, up, down].entries()) {
      const r = gs.saludEvaluate_(s, healthy(), null, http, NOW + i * H);
      expect(r.mail).toBe(false);
      s = r.state;
    }
  });

  it("no answer at all counts as a failure", () => {
    const none: Http[] = [
      { url: SITE, code: null },
      { url: ROBOTS, code: null },
    ];
    const first = gs.saludEvaluate_(fresh(), healthy(), null, none, NOW);
    const second = gs.saludEvaluate_(first.state, healthy(), null, none, NOW + H);
    expect(keys(second)).toEqual([`web:${SITE}`, `web:${ROBOTS}`]);
    expect(second.problems[0].detail).toBe("Falló 2 veces seguidas (no respondió).");
  });
});

describe("mails only when the problems change", () => {
  it("a problem mails once, not every hour, and again when solved", () => {
    const late = healthy({ exam_sync_at: ago(40) });
    const a = gs.saludEvaluate_(fresh(), late, null, up, NOW);
    expect(a.mail).toBe(true);
    const b = gs.saludEvaluate_(a.state, healthy({ exam_sync_at: ago(41) }), null, up, NOW + H);
    expect(b.mail).toBe(false);
    const c = gs.saludEvaluate_(b.state, healthy(), null, up, NOW + 2 * H);
    expect(c.mail).toBe(true);
    expect(c.problems).toEqual([]);
    expect(c.resolved).toEqual([{ key: "examenes", title: "Las fechas de examen no se actualizan" }]);
    const d = gs.saludEvaluate_(c.state, healthy(), null, up, NOW + 3 * H);
    expect(d.mail).toBe(false);
  });

  it("a second problem mails again, listing both", () => {
    const a = gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: ago(40) }), null, up, NOW);
    const b = gs.saludEvaluate_(a.state, healthy({ exam_sync_at: ago(41), news_fetched_at: ago(50) }), null, up, NOW + H);
    expect(b.mail).toBe(true);
    expect(keys(b)).toEqual(["examenes", "noticias"]);
  });

  it("while the database does not answer, its checks are not taken as solved", () => {
    const a = gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: ago(40) }), null, up, NOW);
    const b = gs.saludEvaluate_(a.state, null, "timeout", up, NOW + H);
    expect(b.mail).toBe(true); // the database is new
    expect(b.resolved).toEqual([]);
    expect(keys(b)).toEqual(["base", "examenes"]);
    const c = gs.saludEvaluate_(b.state, healthy({ exam_sync_at: ago(42) }), null, up, NOW + 2 * H);
    expect(c.resolved.map((p) => p.key)).toEqual(["base"]);
    expect(keys(c)).toEqual(["examenes"]);
  });

  it("at most 4 mails a day; the next day it catches up", () => {
    let s = fresh();
    let mails = 0;
    for (let i = 0; i < 10; i++) {
      // flips between broken and fine every hour
      const r = gs.saludEvaluate_(s, healthy({ news_fetched_at: i % 2 ? ago(10) : ago(60) }), null, up, NOW + i * H);
      if (r.mail) mails++;
      s = r.state;
    }
    expect(mails).toBe(4);
    // The 4th mail said "solved"; the news broke again later the same day, without a mail.
    expect(s.notified).toEqual({});
    const sameDay = gs.saludEvaluate_(s, healthy({ news_fetched_at: ago(60) }), null, up, NOW + 10 * H);
    expect(sameDay.mail).toBe(false);
    const nextDay = gs.saludEvaluate_(sameDay.state, healthy({ news_fetched_at: ago(60) }), null, up, NOW + 24 * H);
    expect(nextDay.mail).toBe(true);
    expect(nextDay.state.mails).toBe(1);
  });
});

describe("state and recipients", () => {
  it("a broken or missing state starts empty", () => {
    expect(gs.saludParseState_("{nope")).toEqual({ http: {}, notified: {}, day: "", mails: 0 });
    expect(gs.saludParseState_(JSON.stringify({ http: { [SITE]: 1 }, mails: 2, day: "2026-11-20" })).http[SITE]).toBe(1);
  });

  it("ALERT_TO: comma-separated, cleaned, without repeats; the owner when empty", () => {
    expect(gs.saludRecipients_(" Ana@fi.uba.ar, beto@fi.uba.ar;ana@fi.uba.ar ,nada", "dueno@gmail.com")).toEqual(["ana@fi.uba.ar", "beto@fi.uba.ar"]);
    expect(gs.saludRecipients_(null, "dueno@gmail.com")).toEqual(["dueno@gmail.com"]);
    expect(gs.saludRecipients_("", "dueno@gmail.com")).toEqual(["dueno@gmail.com"]);
  });

  it("ages", () => {
    expect(gs.saludAge_(5 * 60000)).toBe("5 min");
    expect(gs.saludAge_(3 * H)).toBe("3 h");
    expect(gs.saludAge_(47 * H)).toBe("47 h");
    expect(gs.saludAge_(50 * H)).toBe("2 días");
  });
});

describe("the alert mail", () => {
  it("lists problems and solved ones, links to the admin page, escapes", () => {
    const r = gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: ago(40) }), null, up, NOW);
    const m = gs.saludBuildMail_(r.problems, [{ key: "noticias", title: "Las <b>noticias</b>" }], NOW);
    expect(m.subject).toBe("FIUBI: Las fechas de examen no se actualizan");
    expect(m.text).toContain("⚠️ Las fechas de examen no se actualizan");
    expect(m.text).toContain("Se resolvió:");
    expect(m.text).toContain("https://fiubi.com.ar/admin/estado");
    expect(m.text).toContain("2026-11-20 12:00 (hora de Buenos Aires)");
    expect(m.html).toContain('href="https://fiubi.com.ar/admin/estado"');
    expect(m.html).toContain('src="https://fiubi.com.ar/brand/fiubi-logo-mail.png"');
    expect(m.html).not.toContain("<b>noticias");
    expect(m.html).not.toMatch(/@fi\.uba\.ar/);
  });

  it("subject when everything is back, and with several problems", () => {
    expect(gs.saludBuildMail_([], [{ key: "base", title: "La base no responde" }], NOW).subject).toBe("FIUBI: todo volvió a andar");
    const two = gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: ago(40), news_fetched_at: ago(60) }), null, up, NOW);
    expect(gs.saludBuildMail_(two.problems, [], NOW).subject).toBe("FIUBI: 2 problemas");
  });

  it("the log of saludProbar marks each check", () => {
    const r = gs.saludEvaluate_(fresh(), healthy({ exam_sync_at: ago(40) }), null, up, NOW);
    const log = gs.saludLog_(r.checks);
    expect(log).toContain("✅ Base de datos: Responde.");
    expect(log).toContain("⚠️ Las fechas de examen no se actualizan: Última lectura del SIU: hace 40 h.");
  });
});

describe("hourly(): the reminders and the monitor never stop each other", () => {
  /** Mocked Google services. failDb: every database call fails. */
  function services(opts: { failDb?: boolean; failSalud?: boolean }) {
    const calls: string[] = [];
    const props: Record<string, string> = { SUPABASE_KEY: "k", TOKEN: "t".repeat(40) };
    const sent: { to: string; subject: string }[] = [];
    const response = (code: number, body: unknown) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });
    const globals = {
      Date: fixedDate(NOW),
      Logger: { log: () => undefined },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => (props[k] = v) }),
      },
      Session: { getEffectiveUser: () => ({ getEmail: () => "avisos@example.com" }), getActiveUser: () => ({ getEmail: () => "" }) },
      Utilities: { formatDate: () => "12" },
      MailApp: { sendEmail: (m: { to: string; subject: string }) => sent.push(m), getRemainingDailyQuota: () => 100 },
      SpreadsheetApp: {
        getActiveSpreadsheet: () => {
          calls.push("sheet");
          const range = { setNumberFormat: () => range, setValues: () => range, setFontWeight: () => range };
          const sheet = { clearContents: () => undefined, getRange: () => range, setFrozenRows: () => undefined };
          return { getSheetByName: () => sheet, insertSheet: () => sheet };
        },
      },
      UrlFetchApp: {
        fetch: (url: string) => {
          if (url.includes("/rpc/avisos_pendientes")) {
            calls.push("avisos");
            return opts.failDb ? response(500, "down") : response(200, []);
          }
          if (url.includes("/rpc/salud")) {
            calls.push("salud");
            if (opts.failDb) return response(500, "down");
            return response(200, [{ exam_sync_at: new Date(NOW).toISOString(), news_fetched_at: new Date(NOW).toISOString(), reminders_due: 0 }]);
          }
          if (url === CALENDAR) {
            calls.push("calendario");
            return { getResponseCode: () => 200, getContentText: () => calendarPage(PDF_2026) };
          }
          calls.push("web");
          if (opts.failSalud) throw new Error("boom");
          return response(200, "ok");
        },
      },
    };
    return { globals, calls, props, sent };
  }

  it("all fine: reminders, then the monitor; no alert", () => {
    const s = services({});
    load(s.globals).hourly();
    expect(s.calls).toEqual(["avisos", "sheet", "salud", "web", "web", "calendario"]);
    expect(s.sent).toEqual([]);
    expect(JSON.parse(s.props.SALUD_STATE).notified).toEqual({});
    expect(JSON.parse(s.props.SALUD_CALENDARIO)).toEqual({ day: "2026-11-20", files: [PDF_2025, PDF_2026] });
  });

  it("the reminders fail: the monitor still runs and alerts, and hourly() still fails", () => {
    const s = services({ failDb: true });
    expect(() => load(s.globals).hourly()).toThrow(/La base respondió 500/);
    expect(s.calls).toContain("salud");
    expect(s.sent.map((m) => m.subject)).toEqual(["FIUBI: La base no responde"]);
    expect(s.sent[0].to).toBe("avisos@example.com");
  });

  it("the monitor fails: the reminders already ran, and hourly() reports it", () => {
    const s = services({ failSalud: true });
    s.globals.UrlFetchApp.fetch = ((orig) => (url: string) => {
      if (url === SITE || url === ROBOTS) throw new Error("boom");
      return orig(url);
    })(s.globals.UrlFetchApp.fetch);
    s.globals.MailApp.sendEmail = () => {
      throw new Error("sin cuota");
    };
    // Two runs: the second failure in a row alerts, and the mail fails.
    const gsMocked = load(s.globals);
    gsMocked.hourly();
    expect(() => gsMocked.hourly()).toThrow(/sin cuota/);
    expect(s.calls.filter((c) => c === "sheet")).toHaveLength(2);
    // Not sent: nothing is recorded as notified, so the next run tries again.
    expect(JSON.parse(s.props.SALUD_STATE).notified).toEqual({});
  });

  it("ALERT_TO decides who gets the alert", () => {
    const s = services({ failDb: true });
    s.props.ALERT_TO = "ana@fi.uba.ar, beto@fi.uba.ar";
    expect(() => load(s.globals).hourly()).toThrow();
    expect(s.sent[0].to).toBe("ana@fi.uba.ar,beto@fi.uba.ar");
  });
});

describe("FIUBA academic calendar: once a day, mails when its PDF changes", () => {
  const seen = (files: string[] | null, day = "2026-11-19") => ({ day, files });
  const ok = (current = PDF_2026) => ({ code: 200, html: calendarPage(current) });

  it("reads the PDF names of the page, absolute or relative, without repeats or other files", () => {
    expect(gs.saludCalendarPdfs_(calendarPage(PDF_2026))).toEqual([PDF_2025, PDF_2026]);
    // Any PDF counts, even without "calendario" in its name.
    expect(gs.saludCalendarPdfs_('<a href="https://cms.fi.uba.ar/uploads/CA_FIUBA_2027_2028_ab12.pdf">(+)</a>')).toEqual(["CA_FIUBA_2027_2028_ab12.pdf"]);
    expect(gs.saludCalendarPdfs_("<p>Sin calendario</p>")).toEqual([]);
  });

  it("once a day, from 09:00 in Buenos Aires", () => {
    const at = (ba: string) => Date.parse(`${ba}-03:00`);
    expect(gs.saludCalendarDue_(seen(null, ""), at("2026-11-20T08:59:00"))).toBe(false);
    expect(gs.saludCalendarDue_(seen(null, ""), at("2026-11-20T09:00:00"))).toBe(true);
    expect(gs.saludCalendarDue_(seen([PDF_2026], "2026-11-19"), at("2026-11-20T23:30:00"))).toBe(true);
    expect(gs.saludCalendarDue_(seen([PDF_2026], "2026-11-20"), at("2026-11-20T23:30:00"))).toBe(false);
  });

  it("the first reading only stores the names", () => {
    const r = gs.saludCalendarEvaluate_(gs.saludCalendarParse_(null), ok(), NOW);
    expect(r.status).toBe("primera");
    expect(r.mail).toBe(false);
    expect(r.state).toEqual({ day: "2026-11-20", files: [PDF_2025, PDF_2026] });
  });

  it("the same PDFs: no mail, and today is marked as read", () => {
    const r = gs.saludCalendarEvaluate_(seen([PDF_2025, PDF_2026]), ok(), NOW);
    expect(r.status).toBe("igual");
    expect(r.mail).toBe(false);
    expect(r.state?.day).toBe("2026-11-20");
  });

  it("a PDF uploaded again (new name) mails, with the new and the gone file", () => {
    const fixed = "Calendario_Academico_2026_2027_81c0faa452_909e52c493_a1b2c3d4e5.pdf";
    const r = gs.saludCalendarEvaluate_(seen([PDF_2025, PDF_2026]), ok(fixed), NOW);
    expect(r.status).toBe("cambió");
    expect(r.mail).toBe(true);
    expect(r.added).toEqual([fixed]);
    expect(r.removed).toEqual([PDF_2026]);
    expect(r.state?.files).toEqual([PDF_2025, fixed]);
  });

  it("no answer, an error or a page without PDFs is unknown: no mail, nothing stored", () => {
    const prev = seen([PDF_2025, PDF_2026]);
    for (const page of [null, { code: 503, html: "" }, { code: 200, html: "<p>Nuevo sitio</p>" }]) {
      const r = gs.saludCalendarEvaluate_(prev, page, NOW);
      expect(r.status).toBe("desconocido");
      expect(r.mail).toBe(false);
      expect(r.state).toBeNull();
    }
  });

  it("a broken stored value starts over", () => {
    expect(gs.saludCalendarParse_("{nope")).toEqual({ day: "", files: null });
    expect(gs.saludCalendarParse_(JSON.stringify({ day: "2026-11-20", files: [] }))).toEqual({ day: "2026-11-20", files: null });
  });

  it("the mail says what changed, what to do and links to the FIUBA page", () => {
    const m = gs.saludCalendarMail_(["Calendario_<b>nuevo</b>.pdf"], [PDF_2026], NOW);
    expect(m.subject).toBe("El calendario académico de la FIUBA cambió: revisá las fechas de FIUBI");
    expect(m.text).toContain("Calendario_<b>nuevo</b>.pdf");
    expect(m.text).toContain(PDF_2026);
    expect(m.text).toContain("data/calendario/README.md");
    expect(m.text).toContain(`Ver el calendario: ${CALENDAR}`);
    expect(m.html).toContain(`href="${CALENDAR}"`);
    expect(m.html).not.toContain("<b>nuevo");
  });

  /** saludCheck_() with mocked services, a fixed clock and the calendar page answering `page`. */
  function run(opts: {
    now: number;
    page: () => { code: number; html: string };
    props?: Record<string, string>;
    failMail?: boolean;
    dryRun?: boolean;
  }) {
    const props: Record<string, string> = { SUPABASE_KEY: "k", TOKEN: "t".repeat(40), ...opts.props };
    const sent: { to: string; subject: string }[] = [];
    const fetched: string[] = [];
    const response = (code: number, body: string) => ({ getResponseCode: () => code, getContentText: () => body });
    const g = load({
      Date: fixedDate(opts.now),
      Logger: { log: () => undefined },
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => (props[k] = v) }),
      },
      Session: { getEffectiveUser: () => ({ getEmail: () => "avisos@example.com" }), getActiveUser: () => ({ getEmail: () => "" }) },
      MailApp: {
        sendEmail: (m: { to: string; subject: string }) => {
          if (opts.failMail) throw new Error("sin cuota");
          sent.push(m);
        },
      },
      UrlFetchApp: {
        fetch: (url: string) => {
          fetched.push(url);
          if (url === CALENDAR) {
            const p = opts.page();
            return response(p.code, p.html);
          }
          if (url.includes("/rpc/salud")) {
            const now = new Date(opts.now).toISOString();
            return response(200, JSON.stringify([{ exam_sync_at: now, news_fetched_at: now, reminders_due: 0 }]));
          }
          return response(200, "ok");
        },
      },
    });
    let error: unknown = null;
    let r: ReturnType<SaludGs["saludCheck_"]> = null;
    try {
      r = g.saludCheck_({ dryRun: opts.dryRun });
    } catch (e) {
      error = e;
    }
    return { r, error, props, sent, fetched };
  }

  it("day by day: stores, skips the rest of the day, mails once when it changes", () => {
    const day1 = run({ now: NOW, page: () => ok() });
    expect(day1.error).toBeNull();
    expect(day1.sent).toEqual([]);
    const stored = { SALUD_CALENDARIO: day1.props.SALUD_CALENDARIO };

    const later = run({ now: NOW + H, page: () => ok("Otro_calendario.pdf"), props: stored });
    expect(later.fetched).not.toContain(CALENDAR);
    expect(later.sent).toEqual([]);

    const day2 = run({ now: NOW + 24 * H, page: () => ok("Calendario_Academico_2026_2027_nuevo.pdf"), props: stored });
    expect(day2.sent.map((m) => m.subject)).toEqual(["El calendario académico de la FIUBA cambió: revisá las fechas de FIUBI"]);
    expect(day2.sent[0].to).toBe("avisos@example.com");
    expect(JSON.parse(day2.props.SALUD_CALENDARIO).files).toContain("Calendario_Academico_2026_2027_nuevo.pdf");

    const day3 = run({
      now: NOW + 48 * H,
      page: () => ok("Calendario_Academico_2026_2027_nuevo.pdf"),
      props: { SALUD_CALENDARIO: day2.props.SALUD_CALENDARIO },
    });
    expect(day3.sent).toEqual([]);
  });

  it("a mail that fails stores nothing (the error reaches hourly()), so the next run tries again", () => {
    const stored = { SALUD_CALENDARIO: JSON.stringify(seen([PDF_2025, PDF_2026])) };
    const failed = run({ now: NOW, page: () => ok("Nuevo.pdf"), props: stored, failMail: true });
    expect(String(failed.error)).toContain("sin cuota");
    expect(failed.props.SALUD_CALENDARIO).toBe(stored.SALUD_CALENDARIO);
    // The health checks of that run were saved before.
    expect(JSON.parse(failed.props.SALUD_STATE).day).toBe("2026-11-20");
  });

  it("the page failing does not alert and keeps the last names", () => {
    const stored = { SALUD_CALENDARIO: JSON.stringify(seen([PDF_2025, PDF_2026])) };
    const down = run({ now: NOW, page: () => ({ code: 500, html: "" }), props: stored });
    expect(down.error).toBeNull();
    expect(down.sent).toEqual([]);
    expect(down.props.SALUD_CALENDARIO).toBe(stored.SALUD_CALENDARIO);
  });

  it("saludProbar reads the page even if it was read today, and stores nothing", () => {
    const stored = { SALUD_CALENDARIO: JSON.stringify(seen([PDF_2025, PDF_2026], "2026-11-20")) };
    const dry = run({ now: NOW, page: () => ok("Nuevo.pdf"), props: stored, dryRun: true });
    expect(dry.r?.calendar.mail).toBe(true);
    expect(dry.sent).toEqual([]);
    expect(dry.props.SALUD_CALENDARIO).toBe(stored.SALUD_CALENDARIO);
  });
});

describe("the repository has no alert addresses", () => {
  it("Salud.gs only knows the panel, the logo and the site", () => {
    const addresses = source("Salud.gs").match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
    expect(addresses.filter((a) => a !== "avisosfiubi@gmail.com")).toEqual([]);
  });
});
