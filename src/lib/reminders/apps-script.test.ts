// Pure part of the Apps Script that sends the "Recordarme" mails (tools/reminders/apps-script/
// Code.gs), loaded as Apps Script would load it. Which mail is due is decided in the database and
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
type Row = Record<string, string | number | null>;
interface CodeGs {
  buildMail_(r: Row, kind: string): Mail;
  dueRows_(rows: Row[]): Row[];
  sheetValues_(rows: Row[]): string[][];
  deadline_(moment: string): string;
  longDay_(date: string): string;
  timeRange_(start: string | null, end: string | null): string;
  tokenSql_(hash: string): string;
  toHex_(bytes: number[]): string;
  sampleRows_(): Row[];
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
  aviso_primer_dia: "2026-11-30",
  aviso_ultimo_dia: "2026-12-07",
  first_sent_at: null,
  last_sent_at: null,
  due: null,
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
  it("opening mail: subject, details and links", () => {
    const m = gs.buildMail_(row(), "primer_dia");
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

  it("last-day mail", () => {
    const m = gs.buildMail_(row({ enroll_to: "2026-12-08 00:00" }), "ultimo_dia");
    expect(m.subject).toBe("Hoy es el último día para anotarte al final de Álgebra Lineal");
    expect(m.text).toContain("Te podés anotar hasta el lunes 7/12 a las 23:59.");
    expect(m.html).toContain("#fcebe7"); // peach band
  });

  it("shows the kind when it is not Regular, and no time when the SIU gives none", () => {
    const m = gs.buildMail_(row({ kind: "Libre", start_time: null, end_time: null }), "primer_dia");
    expect(m.text).toContain("Mesa: MESA 01 (Libre)");
    expect(m.text).toContain("Examen: Miércoles 9/12\n");
  });

  it("escapes what comes from the SIU", () => {
    const m = gs.buildMail_(row({ subject_name: 'Química <b>"I"</b> & II' }), "primer_dia");
    expect(m.html).not.toContain("<b>");
    expect(m.html).toContain("Química &lt;b&gt;&quot;I&quot;&lt;/b&gt; &amp; II");
  });
});

describe("dueRows_", () => {
  it("keeps the rows the database marked as due, only to @fi.uba.ar, last-day mails first", () => {
    const rows = [
      row({ reminder_id: 1, due: "primer_dia" }),
      row({ reminder_id: 2 }),
      row({ reminder_id: 3, due: "ultimo_dia" }),
      row({ reminder_id: 4, due: "primer_dia", email: "x@gmail.com" }),
      row({ reminder_id: 5, due: "otro" }),
    ];
    expect(gs.dueRows_(rows).map((r) => r.reminder_id)).toEqual([3, 1]);
  });
});

describe("sheetValues_", () => {
  it("has the Spanish headers and one text row per reminder", () => {
    const values = gs.sheetValues_([row({ kind: "Libre", first_sent_at: "2026-11-30 14:05" })]);
    expect(values[0]).toEqual([
      "Creado", "Aviso (primer día)", "Aviso (último día)", "Mail", "Materia", "Mesa", "Fecha del examen", "Hora",
      "Inscripción desde", "Inscripción hasta", "Primer mail enviado", "Último mail enviado",
    ]);
    expect(values[1]).toEqual([
      "2026-11-20 10:00", "2026-11-30", "2026-12-07", "ana@fi.uba.ar", "Álgebra Lineal", "MESA 01 (Libre)", "2026-12-09",
      "de 17:00 a 20:00", "2026-11-30 14:00", "2026-12-07 14:00", "2026-11-30 14:05", "",
    ]);
  });

  it("never writes a formula", () => {
    expect(gs.sheetValues_([row({ subject_name: "=IMPORTXML(1)" })])[1][4]).toBe("'=IMPORTXML(1)");
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
      sendEmail: (m: { to: string; subject: string }) => {
        quota--;
        log.push(`mail ${m.to}`);
      },
    };
    g.Utilities = { formatDate: () => "2026-11-30 14:05" };
    g.rpc_ = (name: string, args: { p_reminder_id: number; p_kind: string }) => log.push(`${name} ${args.p_reminder_id} ${args.p_kind}`);
    const rows = [
      row({ reminder_id: 1, email: "a@fi.uba.ar", due: "primer_dia" }),
      row({ reminder_id: 2, email: "b@fi.uba.ar" }),
      row({ reminder_id: 3, email: "c@fi.uba.ar", due: "ultimo_dia" }),
      row({ reminder_id: 4, email: "d@fi.uba.ar", due: "primer_dia" }),
    ];
    const result = (g as unknown as { sendRows_(r: Row[]): { sent: number; left: number } }).sendRows_(rows);
    expect(log).toEqual([
      "avisos_marcar_enviado 0 primer_dia", // marking works before the first mail
      "mail c@fi.uba.ar",
      "avisos_marcar_enviado 3 ultimo_dia",
      "mail a@fi.uba.ar",
      "avisos_marcar_enviado 1 primer_dia",
    ]);
    expect({ ...result }).toEqual({ sent: 2, left: 1 });
    expect([rows[0].first_sent_at, rows[2].last_sent_at, rows[3].first_sent_at]).toEqual(["2026-11-30 14:05", "2026-11-30 14:05", null]);
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
