-- Reminders to send now, as one JSON array (see DueReminder in src/lib/reminders/email.ts).
-- Run by the workflow "Recordatorios" as the database owner; it prints nothing else.
--   exam:     a table of the student's plan, with one of the reminder's SIU codes, whose enrollment
--             opened after the reminder was created and is still open.
--   calendar: the date started (from 8:00, Buenos Aires) and is not over.
with now_ar as (select (now() at time zone 'America/Argentina/Buenos_Aires') as t),
who as (
  select u.id, u.email,
         nullif(initcap(lower(split_part(coalesce(u.raw_user_meta_data ->> 'given_name', u.raw_user_meta_data ->> 'full_name', ''), ' ', 1))), '') as first_name
  from auth.users u
),
exam as (
  select r.id, 'exam' as kind, w.email, w.first_name as "firstName", r.subject_name as subject,
         to_char(min(t.enroll_to), 'YYYY-MM-DD"T"HH24:MI:SS') as "enrollTo"
  from public.reminders r
  join public.profiles p on p.id = r.user_id
  join who w on w.id = r.user_id
  join public.exam_tables t on t.plan_id = p.plan_id and t.siu_subject_code = any (r.siu_codes)
  cross join now_ar
  where r.kind = 'exam' and r.sent_at is null
    and t.enroll_from is not null
    and t.enroll_from > (r.created_at at time zone 'America/Argentina/Buenos_Aires')
    and t.enroll_from <= now_ar.t
    and (t.enroll_to is null or t.enroll_to > now_ar.t)
  group by r.id, w.email, w.first_name, r.subject_name
),
cal as (
  select r.id, 'calendar' as kind, w.email, w.first_name as "firstName", e.title, to_char(e.ends_on, 'YYYY-MM-DD') as "endsOn"
  from public.reminders r
  join public.academic_events e on e.id = r.academic_event_id
  join who w on w.id = r.user_id
  cross join now_ar
  where r.kind = 'calendar' and r.sent_at is null
    and e.starts_on <= now_ar.t::date and e.ends_on >= now_ar.t::date
    and extract(hour from now_ar.t) >= 8
)
select coalesce(json_agg(x), '[]'::json) from (
  select to_jsonb(exam) as x from exam
  union all
  select to_jsonb(cal) from cal
) s;
