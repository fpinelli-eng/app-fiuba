-- Included by the SQL that sync.mjs writes, after it sets 'exams.payload' to
-- { plans: [{ plan_id, stats, rows: [{ siu_subject_code, siu_subject_name, name, exam_date, kind,
--   enroll_from, enroll_to, start_time, end_time, room, drop_until, teachers }] }] }.
-- Only plans whose dates changed come in. Like "Publicar fechas" in Administración, each plan's
-- exam tables are replaced as a whole (nothing depends on these rows) and exam_imports records the
-- load. One transaction: if anything fails, every plan keeps its previous dates.

begin;

create temp table exam_sync on commit drop as
select x.plan_id, x.stats, x.rows
from jsonb_to_recordset(current_setting('exams.payload')::jsonb -> 'plans')
  as x(plan_id text, stats jsonb, rows jsonb)
where exists (select 1 from public.plans p where p.id = x.plan_id)
  and jsonb_array_length(x.rows) > 0;  -- never wipe a plan (sync.mjs already skips empty pages)

delete from public.exam_tables t
using exam_sync s
where t.plan_id = s.plan_id;

insert into public.exam_tables (
  plan_id, siu_subject_code, siu_subject_name, name, exam_date, kind,
  enroll_from, enroll_to, start_time, end_time, room, drop_until, teachers
)
select s.plan_id, r.siu_subject_code, r.siu_subject_name, r.name, r.exam_date, r.kind,
  r.enroll_from, r.enroll_to, r.start_time, r.end_time, r.room, r.drop_until, r.teachers
from exam_sync s
cross join lateral jsonb_to_recordset(s.rows) as r(
  siu_subject_code text, siu_subject_name text, name text, exam_date date, kind text,
  enroll_from timestamp, enroll_to timestamp, start_time time, end_time time,
  room text, drop_until timestamp, teachers text
);

insert into public.exam_imports (plan_id, stats, published_at)
select plan_id, stats, now() from exam_sync
on conflict (plan_id) do update set stats = excluded.stats, published_at = excluded.published_at;

-- Counts only: the log is public.
select s.plan_id as plan, count(t.id) as mesas
from exam_sync s
left join public.exam_tables t on t.plan_id = s.plan_id
group by s.plan_id
order by s.plan_id;

commit;
