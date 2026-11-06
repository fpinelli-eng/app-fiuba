-- "Recordarme": a student asks for one email when something opens.
--   kind 'exam'     → when the enrollment of a final opens in the SIU (exam_tables of their plan
--                     with one of siu_codes and enroll_from after the reminder was created).
--   kind 'calendar' → the morning an academic calendar date starts (academic_events.starts_on).
-- The scheduled workflow "Recordatorios" (tools/reminders/) sends them and sets sent_at: each
-- reminder sends one email. Students read, create and delete only their own; nobody updates
-- them from the app. Deleting the account deletes them (profiles on delete cascade).

create table public.reminders (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('exam', 'calendar')),
  subject_name text check (char_length(subject_name) <= 200),
  siu_codes text[],
  academic_event_id bigint references public.academic_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check (
    (kind = 'exam' and subject_name is not null and cardinality(siu_codes) between 1 and 10 and academic_event_id is null)
    or (kind = 'calendar' and academic_event_id is not null and siu_codes is null)
  )
);

-- One pending reminder per final and per calendar date.
create unique index reminders_one_exam on public.reminders (user_id, subject_name) where kind = 'exam' and sent_at is null;
create unique index reminders_one_event on public.reminders (user_id, academic_event_id) where kind = 'calendar';
create index reminders_pending on public.reminders (kind) where sent_at is null;

alter table public.reminders enable row level security;
grant select, insert, delete on public.reminders to authenticated;

create policy "Students read their reminders" on public.reminders
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_member()));
create policy "Students create their reminders" on public.reminders
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_member()) and sent_at is null);
create policy "Students delete their reminders" on public.reminders
  for delete to authenticated using (user_id = (select auth.uid()));
