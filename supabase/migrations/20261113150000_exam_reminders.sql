-- "Recordarme" in Finales: a student picks exam tables and gets two emails for each, on the first
-- and on the last day of its enrollment. The scheduled workflow "Recordatorios" (tools/reminders/)
-- sends them as the database owner and sets first_sent_at / last_sent_at.
--
-- exam_tables rows are replaced every morning by the SIU sync (tools/exams/), so their ids are not
-- stable: a reminder points to its table by the same natural key the sync uses to compare rows
-- (plan, SIU subject code, table name, kind and exam date) and keeps a snapshot of what the student
-- saw (subject name, time, enrollment window) for when the table changes or disappears. The bot
-- always re-reads the current table: if the SIU moved the enrollment dates, it uses the new ones.
--
-- * Students read, create and delete only their own reminders, only for an exam table of their
--   plan, at most 50. Nobody updates them from the app: the sent marks belong to the bot.
-- * Deleting the account deletes them (profiles on delete cascade). The bot deletes them after the
--   exam date.

create table public.exam_reminders (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  -- Natural key of the exam table.
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  siu_subject_code text not null check (char_length(siu_subject_code) between 1 and 20),
  table_name text not null check (char_length(table_name) between 1 and 120),
  kind text not null check (char_length(kind) between 1 and 60),
  exam_date date not null,
  -- Snapshot, as the student saw it.
  subject_name text not null check (char_length(subject_name) between 1 and 200),
  start_time time,
  enroll_from timestamp,               -- Buenos Aires time, as exam_tables
  enroll_to timestamp,
  created_at timestamptz not null default now(),
  first_sent_at timestamptz,
  last_sent_at timestamptz,
  unique (user_id, plan_id, siu_subject_code, table_name, kind, exam_date)
);

create index exam_reminders_pending_idx on public.exam_reminders (exam_date) where last_sent_at is null;

alter table public.exam_reminders enable row level security;

-- Column grants: the sent marks and the owner cannot be written from the app (user_id comes from
-- its default, auth.uid()).
grant select, delete on public.exam_reminders to authenticated;
grant insert (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name, start_time, enroll_from, enroll_to)
  on public.exam_reminders to authenticated;

create policy "Students read their exam reminders" on public.exam_reminders
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_member()));

create policy "Students create exam reminders for their plan" on public.exam_reminders
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (select public.is_member())
    and plan_id = (select p.plan_id from public.profiles p where p.id = (select auth.uid()))
    and exists (
      select 1 from public.exam_tables t
      where t.plan_id = exam_reminders.plan_id
        and t.siu_subject_code = exam_reminders.siu_subject_code
        and t.name = exam_reminders.table_name
        and t.kind = exam_reminders.kind
        and t.exam_date = exam_reminders.exam_date
    )
  );

create policy "Students delete their exam reminders" on public.exam_reminders
  for delete to authenticated using (user_id = (select auth.uid()));

-- At most 50 reminders per student.
create function public.exam_reminders_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.exam_reminders r where r.user_id = new.user_id) >= 50 then
    raise exception 'Too many exam reminders' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger exam_reminders_limit
  before insert on public.exam_reminders
  for each row execute function public.exam_reminders_limit();
