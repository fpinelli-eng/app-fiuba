-- Exam tables ("mesas de examen") of each plan, from the public "Fechas de examen" page of
-- the SIU, pasted by an admin. They are not tied to a term: one copy brings December,
-- February and March exams. Publishing a plan's exam dates replaces the previous ones
-- (nothing depends on these rows).
--
-- * Members (FIUBA accounts) read; only admins write.
-- * exam_imports keeps when each plan was last loaded, for the admin screen.

create table public.exam_tables (
  id bigint generated always as identity primary key,
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  siu_subject_code text not null,
  siu_subject_name text not null,
  name text not null,                  -- 'MESA 01', 'Mesa 1 Surace', 'LLAMADO 2'
  exam_date date not null,
  kind text not null,                  -- 'Regular', 'Libre', 'Reválida de Cursada'…
  enroll_from timestamp,               -- Buenos Aires time, as the SIU shows it
  enroll_to timestamp,
  created_at timestamptz not null default now()
);

create index exam_tables_plan_date_idx on public.exam_tables (plan_id, exam_date);
create index exam_tables_siu_code_idx on public.exam_tables (siu_subject_code);

create table public.exam_imports (
  plan_id text primary key references public.plans (id) on update cascade on delete cascade,
  stats jsonb not null default '{}'::jsonb,  -- { subjects, tables, from, to }
  published_at timestamptz not null default now()
);

alter table public.exam_tables enable row level security;
alter table public.exam_imports enable row level security;

grant select, insert, update, delete on public.exam_tables to authenticated;
create policy "Members read exam tables" on public.exam_tables
  for select to authenticated using ((select public.is_member()));
create policy "Admins insert" on public.exam_tables
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update" on public.exam_tables
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete" on public.exam_tables
  for delete to authenticated using ((select public.is_admin()));

grant select, insert, update, delete on public.exam_imports to authenticated;
create policy "Admins manage exam imports" on public.exam_imports
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
