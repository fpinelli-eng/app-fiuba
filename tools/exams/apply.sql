-- Included by the SQL that sync.mjs writes (changesSql() in src/lib/exams/siu-sync.ts), inside its
-- transaction, after it sets 'exams.payload' to
-- { plans: [{ plan_id, stats, before, inserts: [row], updates: [{ id, ...row }], deletes: [id] }] }
-- with row = { siu_subject_code, siu_subject_name, name, exam_date, kind, enroll_from, enroll_to,
-- start_time, end_time, room, drop_until, teachers }.
--
-- Only plans whose dates changed come in, and only their changed rows (planExamChanges()): new
-- tables are inserted, tables gone from the SIU deleted, and tables with the same natural key
-- (subject code, name, kind, day) but other details updated in place. exam_reminders match a table
-- by that same key (migration 20261113150000_exam_reminders.sql and avisos_pendientes()), so an
-- update never detaches a reminder; it re-reads the new time and enrollment like before.
-- exam_imports records the load. The caller's single transaction (begin … commit in the generated
-- file) means that if anything fails, every plan keeps its previous dates.

-- Nobody else writes exam tables until the commit ("Publicar fechas" in Administración waits a
-- moment); reading them (Finales, the reminders) is not blocked.
lock table public.exam_tables in share row exclusive mode;

create temp table exam_sync on commit drop as
select x.plan_id, x.stats, x.before, x.inserts, x.updates, x.deletes
from jsonb_to_recordset(current_setting('exams.payload')::jsonb -> 'plans')
  as x(plan_id text, stats jsonb, before integer, inserts jsonb, updates jsonb, deletes jsonb)
where exists (select 1 from public.plans p where p.id = x.plan_id)
  and coalesce((x.stats ->> 'tables')::integer, 0) > 0;  -- never wipe a plan (sync.mjs already skips empty pages)

-- The changes were computed against the rows current.sql read a minute ago. If a plan's rows moved
-- since then (an admin published it by hand), stop: nothing is written and the next run retries.
do $guard$
declare
  moved text;
begin
  select string_agg(s.plan_id, ', ' order by s.plan_id) into moved
  from exam_sync s
  where s.before is distinct from (select count(*) from public.exam_tables t where t.plan_id = s.plan_id)
     or exists (
       select 1
       from (select (d.value)::bigint as id from jsonb_array_elements_text(coalesce(s.deletes, '[]')) as d(value)
             union all
             select u.id from jsonb_to_recordset(coalesce(s.updates, '[]')) as u(id bigint)) ref
       where not exists (select 1 from public.exam_tables t where t.id = ref.id and t.plan_id = s.plan_id)
     );
  if moved is not null then
    raise exception 'Las mesas de % cambiaron mientras corría la sincronización; no se guardó nada (se reintenta en la próxima corrida)', moved;
  end if;
end
$guard$;

delete from public.exam_tables t
using exam_sync s
cross join lateral jsonb_array_elements_text(coalesce(s.deletes, '[]')) as d(value)
where t.plan_id = s.plan_id
  and t.id = (d.value)::bigint;

-- The natural key (code, name, kind, day) is the same by construction: only the details change.
update public.exam_tables t
set siu_subject_name = r.siu_subject_name,
    enroll_from = r.enroll_from,
    enroll_to = r.enroll_to,
    start_time = r.start_time,
    end_time = r.end_time,
    room = r.room,
    drop_until = r.drop_until,
    teachers = r.teachers
from exam_sync s
cross join lateral jsonb_to_recordset(coalesce(s.updates, '[]')) as r(
  id bigint, siu_subject_name text, enroll_from timestamp, enroll_to timestamp,
  start_time time, end_time time, room text, drop_until timestamp, teachers text
)
where t.plan_id = s.plan_id
  and t.id = r.id;

insert into public.exam_tables (
  plan_id, siu_subject_code, siu_subject_name, name, exam_date, kind,
  enroll_from, enroll_to, start_time, end_time, room, drop_until, teachers
)
select s.plan_id, r.siu_subject_code, r.siu_subject_name, r.name, r.exam_date, r.kind,
  r.enroll_from, r.enroll_to, r.start_time, r.end_time, r.room, r.drop_until, r.teachers
from exam_sync s
cross join lateral jsonb_to_recordset(coalesce(s.inserts, '[]')) as r(
  siu_subject_code text, siu_subject_name text, name text, exam_date date, kind text,
  enroll_from timestamp, enroll_to timestamp, start_time time, end_time time,
  room text, drop_until timestamp, teachers text
);

insert into public.exam_imports (plan_id, stats, published_at)
select plan_id, stats, now() from exam_sync
on conflict (plan_id) do update set stats = excluded.stats, published_at = excluded.published_at;

-- Counts only: the log is public.
select s.plan_id as plan,
  jsonb_array_length(coalesce(s.inserts, '[]')) as nuevas,
  jsonb_array_length(coalesce(s.updates, '[]')) as cambiadas,
  jsonb_array_length(coalesce(s.deletes, '[]')) as quitadas,
  (select count(*) from public.exam_tables t where t.plan_id = s.plan_id) as mesas
from exam_sync s
order by s.plan_id;
