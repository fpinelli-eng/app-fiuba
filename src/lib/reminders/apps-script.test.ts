// Pure part of the Apps Script that sends the "Recordarme" mails (tools/reminders/apps-script/
// Code.gs), loaded as Apps Script would load it. Whether the mail is due is decided in the database and
// tested in tools/db-test/security.sql.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCodeGs, previewHtml } from "../../../tools/reminders/apps-script/preview.mjs";

interface Mail {
  subject: string;
  text: string;
  html: string;
}
type Row = Record<string, string | number | boolean | null>;
interface CodeGs {
  buildMail_(r: Row): Mail;
  buildConfirmMail_(r: Row): Mail;
  confirmRows_(rows: Row[]): Row[];
  handlePost_(body: unknown, token: string | null, pass: () => { sent: number; left: number } | null): Record<string, unknown>;
  sameToken_(a: string, b: string): boolean;
  firstName_(name: string | null): string;
  dueRows_(rows: Row[]): Row[];
  sheetValues_(rows: Row[]): string[][];
  deadline_(moment: string): string;
  longDay_(date: string): string;
  timeRange_(start: string | null, end: string | null): string;
  tokenSql_(hash: string): string;
  toHex_(bytes: number[]): string;
  sampleRow_(): Row;
  HEADERS: string[];
}

const gs = loadCodeGs() as CodeGs;

const row = (over: Row = {}): Row => ({
  reminder_id: 7,
  email: "ana@fi.uba.ar",
  subject_name: "Álgebra Lineal",
  table_name: "MESA 01",
  kind: "Regular",
  exam_date: "2026-12-09",
  start_time: "17:00",
  end_time: "20:00",
  enroll_from: "2026-11-30 14:00",
  enroll_to: "2026-12-07 14:00",
  created_at: "2026-11-20 10:00",
  aviso: "2026-11-30",
  sent_at: null,
  due: false,
  ...over,
});


describe("dates in the mail", () => {
  it("writes the day with its weekday", () => {
    expect(gs.longDay_("2026-12-09")).toBe("miércoles 9/12");
    expect(gs.longDay_("2027-03-01")).toBe("lunes 1/3");
  });

  it("writes the deadline; 00:00 is the end of the day before", () => {
    expect(gs.deadline_("2026-12-07 14:00")).toBe("el lunes 7/12 a las 14:00");
    expect(gs.deadline_("2026-12-07 00:00")).toBe("el domingo 6/12 a las 23:59");
    expect(gs.deadline_("2027-03-01 00:00")).toBe("el domingo 28/2 a las 23:59");
  });

  it("writes the time of the exam", () => {
    expect(gs.timeRange_("17:00", "20:00")).toBe("de 17:00 a 20:00");
    expect(gs.timeRange_("17:00", null)).toBe("a las 17:00");
    expect(gs.timeRange_(null, null)).toBe("");
  });
});


describe("buildMail_", () => {
  it("subject, details and links", () => {
    const m = gs.buildMail_(row());
    expect(m.subject).toBe("Abrió la inscripción al final de Álgebra Lineal");
    expect(m.text).toContain("Examen: Miércoles 9/12, de 17:00 a 20:00");
    expect(m.text).toContain("Mesa: MESA 01");
    expect(m.text).toContain("Te podés anotar hasta el lunes 7/12 a las 14:00.");
    expect(m.text).toContain("https://guaraniautogestion.fi.uba.ar/");
    expect(m.text).toContain("https://fiubi.com.ar/finales");
    expect(m.text).toContain("sacalo en Finales → Recordarme");
    expect(m.html).toContain("#dff2e9"); // mint band
    expect(m.html).toContain('href="https://guaraniautogestion.fi.uba.ar/"');
    expect(m.html).toContain('src="https://fiubi.com.ar/brand/fiubi-logo-mail.png"');
    expect(m.html).toContain("Hecho por estudiantes, no es un sitio oficial de la universidad.");
  });

  it("a deadline at 00:00 is the end of the day before", () => {
    expect(gs.buildMail_(row({ enroll_to: "2026-12-08 00:00" })).text).toContain("Te podés anotar hasta el lunes 7/12 a las 23:59.");
  });

  it("shows the kind when it is not Regular, and no time when the SIU gives none", () => {
    const m = gs.buildMail_(row({ kind: "Libre", start_time: null, end_time: null }));
    expect(m.text).toContain("Mesa: MESA 01 (Libre)");
    expect(m.text).toContain("Examen: Miércoles 9/12\n");
  });

  it("escapes what comes from the SIU", () => {
    const m = gs.buildMail_(row({ subject_name: 'Química <b>"I"</b> & II' }));
    expect(m.html).not.toContain("<b>");
    expect(m.html).toContain("Química &lt;b&gt;&quot;I&quot;&lt;/b&gt; &amp; II");
  });
});

describe("dueRows_", () => {
  it("keeps the rows the database marked as due, to a plain address (@fi.uba.ar or the student's other mail)", () => {
    const rows = [
      row({ reminder_id: 1, due: true }),
      row({ reminder_id: 2 }),
      row({ reminder_id: 3, due: true, email: "ana.perez+fiubi@gmail.com" }),
      row({ reminder_id: 4, due: true }),
      row({ reminder_id: 5, due: true, email: "a@gmail.com, b@gmail.com" }),
      row({ reminder_id: 6, due: true, email: null }),
    ];
    expect(gs.dueRows_(rows).map((r) => r.reminder_id)).toEqual([1, 3, 4]);
  });
});

describe("sheetValues_", () => {
  it("has the Spanish headers and one text row per reminder", () => {
    const values = gs.sheetValues_([row({ kind: "Libre", sent_at: "2026-11-30 14:05" })]);
    expect(values[0]).toEqual(["Creado", "Aviso", "Mail", "Materia", "Mesa", "Fecha", "Hora", "Inscripción desde", "Inscripción hasta", "Mail enviado"]);
    expect(values[1]).toEqual([
      "2026-11-20 10:00", "2026-11-30", "ana@fi.uba.ar", "Álgebra Lineal", "MESA 01 (Libre)", "2026-12-09", "de 17:00 a 20:00",
      "2026-11-30 14:00", "2026-12-07 14:00", "2026-11-30 14:05",
    ]);
  });

  it("never writes a formula", () => {
    expect(gs.sheetValues_([row({ subject_name: "=IMPORTXML(1)" })])[1][3]).toBe("'=IMPORTXML(1)");
  });
});

describe("token", () => {
  it("prints the SQL line with the hash in hex", () => {
    expect(gs.toHex_([0, 15, -1, 127, -128])).toBe("000fff7f80");
    expect(gs.tokenSql_("ab")).toBe(
      "insert into public.avisos_config (id, token_sha256) values (true, 'ab') on conflict (id) do update set token_sha256 = excluded.token_sha256;",
    );
  });
});

describe("preview.html", () => {
  it("is up to date with Code.gs (node tools/reminders/apps-script/preview.mjs)", () => {
    const file = readFileSync(join(process.cwd(), "tools/reminders/apps-script/preview.html"), "utf8").replace(/\r\n/g, "\n");
    expect(file).toBe(previewHtml(gs));
  });
});


describe("sendRows_ (Google services faked)", () => {
  it("checks marking, marks each mail right after sending it and stops at the daily quota", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    const log: string[] = [];
    let quota = 2;
    g.MailApp = {
      getRemainingDailyQuota: () => quota,
      sendEmail: (m: { to: string }) => {
        quota--;
        log.push(`mail ${m.to}`);
      },
    };
    g.Utilities = { formatDate: () => "2026-11-30 14:05" };
    g.rpc_ = (name: string, args: { p_reminder_id: number }) => log.push(`${name} ${args.p_reminder_id}`);
    const rows = [
      row({ reminder_id: 1, email: "a@fi.uba.ar", due: true }),
      row({ reminder_id: 2, email: "b@fi.uba.ar" }),
      row({ reminder_id: 3, email: "c@fi.uba.ar", due: true }),
      row({ reminder_id: 4, email: "d@fi.uba.ar", due: true }),
    ];
    const result = (g as unknown as { sendRows_(r: Row[]): { sent: number; left: number } }).sendRows_(rows);
    expect(log).toEqual([
      "avisos_marcar_enviado 0", // marking works before the first mail
      "mail a@fi.uba.ar",
      "avisos_marcar_enviado 1",
      "mail c@fi.uba.ar",
      "avisos_marcar_enviado 3",
    ]);
    expect({ ...result }).toEqual({ sent: 2, left: 1 });
    expect(rows.map((r) => r.sent_at)).toEqual(["2026-11-30 14:05", null, "2026-11-30 14:05", null]);
  });

  it("does nothing when no mail is due", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    g.rpc_ = () => {
      throw new Error("no call expected");
    };
    expect({ ...(g as unknown as { sendRows_(r: Row[]): object }).sendRows_([row()]) }).toEqual({ sent: 0, left: 0 });
  });
});

describe("fetchReminders_ (API faked)", () => {
  it("reads every page: the API cuts long answers", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    const all = Array.from({ length: 2500 }, (_, i) => ({ reminder_id: i }));
    const calls: string[] = [];
    g.PAGE_SIZE = 1000;
    g.PropertiesService = { getScriptProperties: () => ({ getProperty: (k: string) => ({ SUPABASE_KEY: "sb_publishable_x", TOKEN: "t".repeat(64) })[k] ?? null }) };
    g.UrlFetchApp = {
      fetch: (url: string, opts: { headers: Record<string, string>; payload: string }) => {
        calls.push(url);
        expect(opts.headers).toEqual({ apikey: "sb_publishable_x" });
        expect(JSON.parse(opts.payload)).toEqual({ p_token: "t".repeat(64) });
        const q = new URL(url).searchParams;
        const offset = Number(q.get("offset"));
        const page = all.slice(offset, offset + Math.min(Number(q.get("limit")), 800)); // the API caps at 800 here
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(page) };
      },
    };
    const rows = (g as unknown as { fetchReminders_(): { reminder_id: number }[] }).fetchReminders_();
    expect(rows.length).toBe(2500);
    expect(rows[2499].reminder_id).toBe(2499);
    expect(calls[0]).toBe("https://solnlrkmkncsntyptjjm.supabase.co/rest/v1/rpc/avisos_pendientes?limit=1000&offset=0");
  });

  it("fails with a hint when the token is wrong", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    g.PropertiesService = { getScriptProperties: () => ({ getProperty: (k: string) => ({ SUPABASE_KEY: "k", TOKEN: "t" })[k] ?? null }) };
    g.UrlFetchApp = { fetch: () => ({ getResponseCode: () => 400, getContentText: () => '{"message":"invalid token"}' }) };
    expect(() => (g as unknown as { fetchReminders_(): unknown }).fetchReminders_()).toThrow(/TOKEN o SUPABASE_KEY/);
  });
});

describe("confirmation mail", () => {
  const confirm = (over: Row = {}): Row => ({ email: "ana@fi.uba.ar", first_name: "ANA", mesas: 3, ...over });

  it("subject, count, the spam steps and the link", () => {
    const m = gs.buildConfirmMail_(confirm());
    expect(m.subject).toBe("Activaste tus recordatorios de FIUBI");
    expect(m.text).toContain("¡Listo, Ana!");
    expect(m.text).toContain("Elegiste 3 mesas. Te vamos a escribir a este mail cuando abra la inscripción de cada una.");
    expect(m.text).toContain("1. Si este mail te llegó a Spam, tocá «No es spam» para que los avisos te lleguen a Recibidos.");
    expect(m.text).toContain("2. Agregá avisosfiubi@gmail.com a tus contactos.");
    expect(m.text).toContain("Ver mis finales en FIUBI: https://fiubi.com.ar/finales");
    expect(m.text).toContain("Si no fuiste vos, escribinos a contacto@fiubi.com.ar.");
    expect(m.html).toContain('href="https://fiubi.com.ar/finales"');
    expect(m.html).toContain('src="https://fiubi.com.ar/brand/fiubi-logo-mail.png"');
    expect(m.html).toContain("#e4ecfc"); // lavender band
    expect(m.html).toContain("Agregá avisosfiubi@gmail.com a tus contactos.");
  });

  it("one mesa, and no name", () => {
    const m = gs.buildConfirmMail_(confirm({ mesas: 1, first_name: "" }));
    expect(m.text).toContain("¡Listo!\n");
    expect(m.text).toContain("Elegiste 1 mesa. Te vamos a escribir a este mail cuando abra la inscripción.\n");
  });

  it("escapes the name", () => {
    const m = gs.buildConfirmMail_(confirm({ first_name: "<b>Ana</b>" }));
    expect(m.html).not.toContain("<b>");
  });

  it("writes the first name with a capital", () => {
    expect(gs.firstName_("ANA")).toBe("Ana");
    expect(gs.firstName_("  maría josé ")).toBe("María");
    expect(gs.firstName_(null)).toBe("");
  });

  it("sends only to a plain address with mesas", () => {
    const rows = [confirm(), confirm({ email: "x@gmail.com", mesas: 0 }), confirm({ email: "a@b.com; c@d.com" }), confirm({ email: "ana.perez@gmail.com" })];
    expect(gs.confirmRows_(rows).map((r) => r.email)).toEqual(["ana@fi.uba.ar", "ana.perez@gmail.com"]);
  });
});

describe("sendConfirmations_ (Google services faked)", () => {
  it("checks marking, marks each mail right after sending it and leaves quota for the reminders", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    const log: string[] = [];
    let quota = 32; // CONFIRM_QUOTA_RESERVE is 30: two confirmations fit
    g.MailApp = {
      getRemainingDailyQuota: () => quota,
      sendEmail: (m: { to: string; subject: string }) => {
        quota--;
        log.push(`mail ${m.to} ${m.subject}`);
      },
    };
    g.rpc_ = (name: string, args: { p_email: string }) => log.push(`${name} '${args.p_email}'`);
    const rows = [
      { email: "a@fi.uba.ar", first_name: "A", mesas: 1 },
      { email: "b@gmail.com", first_name: "B", mesas: 2 },
      { email: "c@fi.uba.ar", first_name: "C", mesas: 1 },
    ];
    const result = (g as unknown as { sendConfirmations_(r: Row[]): { sent: number; left: number } }).sendConfirmations_(rows);
    expect(log).toEqual([
      "avisos_confirmacion_enviada ''",
      "mail a@fi.uba.ar Activaste tus recordatorios de FIUBI",
      "avisos_confirmacion_enviada 'a@fi.uba.ar'",
      "mail b@gmail.com Activaste tus recordatorios de FIUBI",
      "avisos_confirmacion_enviada 'b@gmail.com'",
    ]);
    expect({ ...result }).toEqual({ sent: 2, left: 1 });
  });

  it("does nothing when none is due", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    g.rpc_ = () => {
      throw new Error("no call expected");
    };
    expect({ ...(g as unknown as { sendConfirmations_(r: Row[]): object }).sendConfirmations_([]) }).toEqual({ sent: 0, left: 0 });
  });
});

describe("doPost (instant confirmations)", () => {
  const token = "t".repeat(64);
  const pass = () => ({ sent: 1, left: 0 });

  it("runs the pass only with the right token and action", () => {
    expect({ ...gs.handlePost_({ token, action: "confirm" }, token, pass) }).toEqual({ ok: true, sent: 1, left: 0 });
    expect({ ...gs.handlePost_({ token: "u".repeat(64), action: "confirm" }, token, pass) }).toEqual({ ok: false, error: "token" });
    expect({ ...gs.handlePost_({ token: "t", action: "confirm" }, token, pass) }).toEqual({ ok: false, error: "token" });
    expect({ ...gs.handlePost_({ action: "confirm" }, token, pass) }).toEqual({ ok: false, error: "token" });
    expect({ ...gs.handlePost_(null, token, pass) }).toEqual({ ok: false, error: "token" });
    expect({ ...gs.handlePost_({ token, action: "confirm" }, null, pass) }).toEqual({ ok: false, error: "token" });
    expect({ ...gs.handlePost_({ token, action: "otra" }, token, pass) }).toEqual({ ok: false, error: "action" });
    expect({ ...gs.handlePost_({ token, action: "confirm" }, token, () => null) }).toEqual({ ok: true, busy: true });
  });

  it("does not run the pass with a wrong token", () => {
    let ran = false;
    gs.handlePost_({ token: "x".repeat(64), action: "confirm" }, token, () => {
      ran = true;
      return null;
    });
    expect(ran).toBe(false);
    expect(gs.sameToken_("abc", "abc")).toBe(true);
    expect(gs.sameToken_("abc", "abd")).toBe(false);
  });

  it("answers JSON from the web app", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    let sent: string | null = null;
    g.PropertiesService = { getScriptProperties: () => ({ getProperty: (k: string) => (k === "TOKEN" ? token : null) }) };
    g.ContentService = {
      MimeType: { JSON: "json" },
      createTextOutput: (s: string) => {
        sent = s;
        return { setMimeType: () => s };
      },
    };
    g.confirmPass_ = () => ({ sent: 0, left: 0 });
    const doPost = (g as unknown as { doPost(e: unknown): unknown }).doPost;
    doPost({ postData: { contents: JSON.stringify({ token, action: "confirm" }) } });
    expect(JSON.parse(sent!)).toEqual({ ok: true, sent: 0, left: 0 });
    doPost({ postData: { contents: "no es json" } });
    expect(JSON.parse(sent!)).toEqual({ ok: false, error: "token" });
  });
});
