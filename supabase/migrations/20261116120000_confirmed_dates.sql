-- Fechas importantes: dates confirmed by the Secretaría (usually by mail) that replace the
-- tentative ones of the academic calendar in Novedades.
--
-- The academic calendar (academic_events) comes from a PDF drawn as a grid of weeks, made at the
-- start of the year: its dates are weeks and tentative. When the Secretaría announces the real
-- dates, an admin confirms them from /admin/novedades:
-- * replaces: the calendar row it replaces (null: a date the calendar does not have). One
--   confirmation per row. If a calendar is reloaded with a migration its rows get new ids and
--   the confirmation stays as a date of its own (on delete set null).
-- * note: where it comes from, shown next to the date ("Mail de la Secretaría del 29/10").
--
-- Members (FIUBA accounts) read; only admins write, like academic_events and news.

create table public.academic_date_confirmations (
  id bigint generated always as identity primary key,
  calendar text not null,
  title text not null check (char_length(title) between 1 and 140),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  note text not null check (char_length(note) between 1 and 140),
  replaces bigint references public.academic_events (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index academic_date_confirmations_replaces_idx
  on public.academic_date_confirmations (replaces) where replaces is not null;
create index academic_date_confirmations_dates_idx on public.academic_date_confirmations (calendar, starts_on);

alter table public.academic_date_confirmations enable row level security;

grant select, insert, update, delete on public.academic_date_confirmations to authenticated;
create policy "Members read date confirmations" on public.academic_date_confirmations
  for select to authenticated using ((select public.is_member()));
create policy "Admins insert" on public.academic_date_confirmations
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update" on public.academic_date_confirmations
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete" on public.academic_date_confirmations
  for delete to authenticated using ((select public.is_admin()));

-- Cursos de verano 2027, from the Secretaría de Gestión Académica's mail of 29 Oct 2026.
insert into public.academic_date_confirmations (calendar, title, starts_on, ends_on, note, replaces)
select '2026-2027', c.title, c.starts_on::date, c.ends_on::date, 'Mail de la Secretaría del 29/10',
       (select e.id from public.academic_events e
         where e.calendar = '2026-2027' and e.title = c.title and e.starts_on = c.was::date)
from (values
  ('Publicación de oferta horaria de cursos de verano', '2026-11-02', '2026-11-12', '2026-11-12'),
  ('Inscripción para Cursos de Verano 2027', '2026-11-09', '2026-11-17', '2026-11-18'),
  ('Desinscripción de Cursos de Verano', '2026-11-16', '2026-11-23', '2026-12-11'),
  ('Inicio de los Cursos de Verano', '2027-01-04', '2027-01-04', '2027-02-26')
) as c (title, was, starts_on, ends_on);
