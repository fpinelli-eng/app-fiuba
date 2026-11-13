import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  buenosAiresDate,
  importantDates,
  LATER_DAYS,
  sortNews,
  type AcademicEvent,
  type DateConfirmation,
  type FiubaNewsItem,
  type NewsItem,
} from "./model";

// Server-only queries of the Novedades section. The database only lets FIUBA accounts read.

export interface CalendarInfo {
  /** Name of the latest loaded calendar ("2026-2027"), or null when none was loaded. */
  calendar: string | null;
  count: number;
  /** "YYYY-MM-DD" */
  from: string | null;
  to: string | null;
}

/** The latest loaded calendar: its name is the PDF's years, so the greatest one is the newest. */
async function latestCalendar(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_events")
    .select("calendar")
    .order("calendar", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`academic_events: ${error.message}`);
  return (data?.calendar as string | undefined) ?? null;
}

export async function getNews(): Promise<NewsItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("news")
    .select("id, title, body, url, pinned, published_at")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`news: ${error.message}`);
  return sortNews(
    data.map((n) => ({
      id: n.id as number,
      title: n.title as string,
      body: (n.body as string | null) ?? null,
      url: (n.url as string | null) ?? null,
      pinned: n.pinned as boolean,
      publishedAt: n.published_at as string,
    })),
  );
}

/** The latest FIUBA news, newest first. */
export async function getFiubaNews(limit = 12): Promise<FiubaNewsItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fiuba_news")
    .select("id, title, summary, url, image_url, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);
  // Until the migration is applied (a preview on the shared database, or the minutes after merging),
  // the table does not exist: show no news instead of an error page.
  if (error?.code === "42P01" || error?.code === "PGRST205") return [];
  if (error) throw new Error(`fiuba_news: ${error.message}`);
  return data.map((n) => ({
    id: n.id as number,
    title: n.title as string,
    summary: (n.summary as string | null) ?? null,
    url: n.url as string,
    imageUrl: (n.image_url as string | null) ?? null,
    publishedAt: n.published_at as string,
  }));
}

/** The confirmed dates of a calendar (all of them: few rows, and a past one still hides its tentative row). */
export async function getConfirmations(calendar: string): Promise<DateConfirmation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_date_confirmations")
    .select("id, title, starts_on, ends_on, note, replaces")
    .eq("calendar", calendar)
    .order("starts_on");
  // Until the migration is applied (a preview on the shared database), the table does not exist.
  if (error?.code === "42P01" || error?.code === "PGRST205") return [];
  if (error) throw new Error(`academic_date_confirmations: ${error.message}`);
  return data.map((c) => ({
    id: c.id as number,
    title: c.title as string,
    startsOn: c.starts_on as string,
    endsOn: c.ends_on as string,
    note: c.note as string,
    replaces: (c.replaces as number | null) ?? null,
  }));
}

/** The rows of a calendar that are not over on `today` and, with `until`, start by then. */
async function getEvents(calendar: string, today: string, until: string | null): Promise<AcademicEvent[]> {
  const supabase = await createClient();
  let query = supabase.from("academic_events").select("id, title, starts_on, ends_on, sort").eq("calendar", calendar).gte("ends_on", today);
  if (until) query = query.lte("starts_on", until);
  const { data, error } = await query.order("starts_on").order("sort");
  if (error) throw new Error(`academic_events: ${error.message}`);
  return data.map((e) => ({
    id: e.id as number,
    title: e.title as string,
    startsOn: e.starts_on as string,
    endsOn: e.ends_on as string,
    sort: e.sort as number,
  }));
}

/**
 * Data for /novedades: avisos, FIUBA news and the important dates of the latest calendar
 * (tentative, or confirmed by the Secretaría: importantDates()).
 */
export async function getNewsPage(): Promise<{ today: string; news: NewsItem[]; fiuba: FiubaNewsItem[]; events: AcademicEvent[] }> {
  const today = buenosAiresDate();
  const [news, fiuba, calendar] = await Promise.all([getNews(), getFiubaNews(), latestCalendar()]);
  if (!calendar) return { today, news, fiuba, events: [] };
  const [events, confirmations] = await Promise.all([getEvents(calendar, today, addDays(today, LATER_DAYS)), getConfirmations(calendar)]);
  return { today, news, fiuba, events: importantDates(events, confirmations) };
}

/** For the admin form: the important rows of the latest calendar that are not over, to confirm. */
export async function getDatesToConfirm(): Promise<{ calendar: string | null; events: AcademicEvent[]; confirmations: DateConfirmation[] }> {
  const today = buenosAiresDate();
  const calendar = await latestCalendar();
  if (!calendar) return { calendar, events: [], confirmations: [] };
  const [events, confirmations] = await Promise.all([getEvents(calendar, today, null), getConfirmations(calendar)]);
  return { calendar, events, confirmations };
}

/** For the admin screen: what calendar is loaded. */
export async function getCalendarInfo(): Promise<CalendarInfo> {
  const calendar = await latestCalendar();
  if (!calendar) return { calendar: null, count: 0, from: null, to: null };
  const supabase = await createClient();
  const { data, error } = await supabase.from("academic_events").select("starts_on, ends_on").eq("calendar", calendar);
  if (error) throw new Error(`academic_events: ${error.message}`);
  const starts = data.map((e) => e.starts_on as string).sort();
  const ends = data.map((e) => e.ends_on as string).sort();
  return { calendar, count: data.length, from: starts[0] ?? null, to: ends.at(-1) ?? null };
}
