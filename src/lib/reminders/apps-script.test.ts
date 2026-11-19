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
  buildSendAlert_(failed: { row: Row; error: string }[], noQuota: number): Mail;
  panelValues_(rows: Row[], today: string, capacity: number, leftToday: number, failures?: Record<string, { error: string; at: string }>, hour?: number): { lines: (string | number)[][]; bold: number[]; warn: number[]; ok: number[] };
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
    expect({ ...result }).toEqual({ sent: 2, left: 1, failed: [], noQuota: 1 });
    expect(rows.map((r) => r.sent_at)).toEqual(["2026-11-30 14:05", null, "2026-11-30 14:05", null]);
  });

  it("does nothing when no mail is due", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    g.rpc_ = () => {
      throw new Error("no call expected");
    };
    expect({ ...(g as unknown as { sendRows_(r: Row[]): object }).sendRows_([row()]) }).toEqual({ sent: 0, left: 0, failed: [], noQuota: 0 });
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

describe("a rejected address never blocks the others", () => {
  it("skips it unmarked and keeps sending, reminders and confirmations", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    const log: string[] = [];
    g.Logger = { log: () => undefined };
    g.MailApp = {
      getRemainingDailyQuota: () => 100,
      sendEmail: (m: { to: string }) => {
        if (m.to.startsWith("malo")) throw new Error("Invalid email");
        log.push(`mail ${m.to}`);
      },
    };
    g.Utilities = { formatDate: () => "2026-11-30 14:05" };
    g.rpc_ = (name: string, args: { p_reminder_id?: number; p_email?: string }) => log.push(`${name} ${args.p_reminder_id ?? args.p_email}`);
    const reminders = [row({ reminder_id: 1, email: "malo@gmail.com", due: true }), row({ reminder_id: 2, email: "b@fi.uba.ar", due: true })];
    const r1 = (g as unknown as { sendRows_(r: Row[]): object }).sendRows_(reminders);
    expect({ ...r1 }).toMatchObject({ sent: 1, left: 1, noQuota: 0 });
    expect((r1 as { failed: { row: Row; error: string }[] }).failed.map((f) => [f.row.reminder_id, f.error])).toEqual([[1, "Invalid email"]]);
    const r2 = (g as unknown as { sendConfirmations_(r: Row[]): object }).sendConfirmations_([
      { email: "malo@gmail.com", first_name: "A", mesas: 1 },
      { email: "c@gmail.com", first_name: "C", mesas: 1 },
    ]);
    expect({ ...r2 }).toEqual({ sent: 1, left: 1 });
    expect(log).toEqual([
      "avisos_marcar_enviado 0",
      "mail b@fi.uba.ar",
      "avisos_marcar_enviado 2",
      "avisos_confirmacion_enviada ",
      "mail c@gmail.com",
      "avisos_confirmacion_enviada c@gmail.com",
    ]);
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

describe("deliverMail_ through Brevo", () => {
  it("sends from avisos@fiubi.com.ar with the API key, counts the day and throws on an error", () => {
    const g = loadCodeGs() as CodeGs & Record<string, unknown>;
    const props: Record<string, string> = { BREVO_API_KEY: "xkeysib-test" };
    g.PropertiesService = {
      getScriptProperties: () => ({ getProperty: (k: string) => props[k] ?? null, setProperty: (k: string, v: string) => (props[k] = v) }),
    };
    g.Utilities = { formatDate: () => "2026-11-16" };
    g.MailApp = { sendEmail: () => { throw new Error("MailApp must not be used"); }, getRemainingDailyQuota: () => 0 };
    const calls: { url: string; opts: { headers: Record<string, string>; payload: string } }[] = [];
    let status = 201;
    g.UrlFetchApp = { fetch: (url: string, opts: { headers: Record<string, string>; payload: string }) => { calls.push({ url, opts }); return { getResponseCode: () => status }; } };
    const send = (g as unknown as { deliverMail_(m: object): void }).deliverMail_;
    const quota = (g as unknown as { mailQuota_(): number }).mailQuota_;
    expect(quota()).toBe(290);
    send({ to: "a@fi.uba.ar, b@fi.uba.ar", subject: "Hola", body: "texto", htmlBody: "<p>hola</p>", name: "FIUBI" });
    expect(calls[0].url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(calls[0].opts.headers["api-key"]).toBe("xkeysib-test");
    const body = JSON.parse(calls[0].opts.payload);
    expect(body.sender).toEqual({ name: "FIUBI", email: "avisos@fiubi.com.ar" });
    expect(body.to).toEqual([{ email: "a@fi.uba.ar" }, { email: "b@fi.uba.ar" }]);
    expect(quota()).toBe(288);
    status = 401;
    expect(() => send({ to: "c@fi.uba.ar", subject: "x", body: "x", htmlBody: "x" })).toThrow(/HTTP 401/);
    expect(quota()).toBe(288);
  });
});

describe("panelValues_ (Panel tab)", () => {
  const find = (lines: (string | number)[][], label: string) => lines.find((l) => l[0] === label);
  const many = (n: number, over: Row) => Array.from({ length: n }, (_, i) => row({ reminder_id: i + 1, ...over }));

  it("says it fits when every day is under the limit", () => {
    const { lines } = gs.panelValues_(many(3, {}), "2026-11-20", 290, 290);
    expect(find(lines, "Mails por mandar")?.[1]).toBe(3);
    expect(String(find(lines, "¿Alcanza?")?.[1])).toMatch(/^Sí/);
    expect(lines.some((l) => l[0] === "lunes 30/11" && l[1] === 3 && l[6] === "OK")).toBe(true);
  });

  it("carries what does not fit to the next day, and counts the ones that close first", () => {
    // 5 mails on 30/11 with a limit of 2: 2 + 2 + 1 over three days; the enrollment closes 1/12 14:00,
    // so the last one (2/12) is lost.
    const rows = many(5, { enroll_to: "2026-12-01 14:00" });
    const { lines } = gs.panelValues_(rows, "2026-11-20", 2, 2);
    expect(String(find(lines, "¿Alcanza?")?.[1])).toBe("No: 1 mails no llegarían antes del cierre de la inscripción");
    expect(lines.find((l) => l[0] === "lunes 30/11")?.slice(1)).toEqual([5, 0, 5, 2, 3, "Se atrasan 3"]);
    expect(lines.find((l) => l[0] === "martes 1/12")?.slice(1)).toEqual([0, 3, 3, 2, 0, "No alcanza: 1 sin mail"]);
  });

  it("leaves out sent ones and closed enrollments, and lists what was sent", () => {
    const rows = [
      row({ sent_at: "2026-11-19 08:05" }),
      row({ reminder_id: 2, aviso: "2026-11-10", enroll_to: "2026-11-15 14:00" }),
      row({ reminder_id: 3, aviso: null }),
    ];
    const { lines } = gs.panelValues_(rows, "2026-11-20", 290, 290);
    expect(find(lines, "Mails por mandar")?.[1]).toBe(0);
    expect(lines.some((l) => l[0] === "jueves 19/11" && l[1] === 1)).toBe(true);
  });

  it("uses what is left of today's quota for overdue mails", () => {
    const rows = many(4, { aviso: "2026-11-18", enroll_to: "2026-11-25 14:00" });
    const { lines } = gs.panelValues_(rows, "2026-11-20", 290, 1);
    expect(lines.find((l) => l[0] === "viernes 20/11")?.slice(1)).toEqual([4, 0, 4, 1, 3, "Se atrasan 3"]);
  });
});

describe("today's mails in the panel and the alert to the admins", () => {
  const today = "2026-11-30";
  const rows = [
    row({ reminder_id: 1, email: "a@fi.uba.ar", sent_at: "2026-11-30 08:04" }),
    row({ reminder_id: 2, email: "b@fi.uba.ar", subject_name: "Física II" }),
    row({ reminder_id: 3, email: "c@fi.uba.ar", aviso: "2026-12-02" }),
  ];

  it("lists what goes today with its state", () => {
    const { lines } = gs.panelValues_(rows, today, 290, 288, { 2: { error: "Brevo no aceptó el mail (HTTP 400)", at: "09:00" } }, 10);
    expect(lines.find((l) => l[0] === "Mails de hoy")?.[1]).toBe("2 (1 con error)");
    expect(lines.find((l) => l[3] === "a@fi.uba.ar")?.[4]).toBe("Enviado 08:04");
    expect(lines.find((l) => l[3] === "b@fi.uba.ar")?.[4]).toBe("Falló (09:00): Brevo no aceptó el mail (HTTP 400)");
    expect(lines.some((l) => l[3] === "c@fi.uba.ar")).toBe(false);
  });

  it("says when they go before 08:00 and when the quota ran out", () => {
    const early = gs.panelValues_(rows, today, 290, 290, {}, 6).lines;
    expect(early.find((l) => l[3] === "b@fi.uba.ar")?.[4]).toBe("Sale a las 8:00");
    const spent = gs.panelValues_(rows, today, 290, 0, {}, 15).lines;
    expect(spent.find((l) => l[3] === "b@fi.uba.ar")?.[4]).toBe("Sin cupo hoy: sale mañana");
  });

  it("the alert lists the failed mails and the spent quota", () => {
    const mail = gs.buildSendAlert_([{ row: row({ email: "b@fi.uba.ar" }), error: "HTTP 400" }], 12);
    expect(mail.subject).toBe("FIUBI · Recordarme: 1 mail no salió y se terminó el cupo del día");
    expect(mail.text).toContain("Álgebra Lineal · MESA 01 → b@fi.uba.ar: HTTP 400");
    expect(mail.text).toContain("quedan 12 recordatorios");
    expect(gs.buildSendAlert_([], 3).subject).toBe("FIUBI · Recordarme: se terminó el cupo del día");
    expect(gs.buildSendAlert_([{ row: row({ subject_name: "<b>x</b>" }), error: "e" }], 0).html).not.toContain("<b>x</b>");
  });
});
