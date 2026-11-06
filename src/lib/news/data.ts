import { createClient } from "@/lib/supabase/server";
import { addDays, buenosAiresDate, LATER_DAYS, sortNews, type AcademicEvent, type FiubaNewsItem, type NewsItem } from "./model";

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

/** Data for /novedades: avisos and the events of the latest calendar that are not over and start within LATER_DAYS. */
export async function getNewsPage(): Promise<{ today: string; news: NewsItem[]; fiuba: FiubaNewsItem[]; events: AcademicEvent[] }> {
  const today = buenosAiresDate();
  const [news, fiuba, calendar] = await Promise.all([getNews(), getFiubaNews(), latestCalendar()]);
  if (!calendar) return { today, news, fiuba, events: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("academic_events")
    .select("id, title, starts_on, ends_on, sort")
    .eq("calendar", calendar)
    .gte("ends_on", today)
    .lte("starts_on", addDays(today, LATER_DAYS))
    .order("starts_on")
    .order("sort");
  if (error) throw new Error(`academic_events: ${error.message}`);
  const events = data.map((e) => ({
    id: e.id as number,
    title: e.title as string,
    startsOn: e.starts_on as string,
    endsOn: e.ends_on as string,
    sort: e.sort as number,
  }));
  return { today, news, fiuba, events };
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
