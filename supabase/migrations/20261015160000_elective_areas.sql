-- Areas that group the electives in the map panel ("Energía", "Gestión y negocios"…).
-- FIUBA Map does not have them: they are defined per plan in data/planes/areas.json.

create table public.subject_areas (
  id bigint generated always as identity primary key,
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  name text not null,
  sort smallint not null default 0,
  unique (plan_id, name)
);

alter table public.subjects
  add column area_id bigint references public.subject_areas (id) on delete set null;

create index subjects_area_id_idx on public.subjects (area_id);

alter table public.subject_areas enable row level security;
grant select, insert, update, delete on public.subject_areas to authenticated;
create policy "Signed-in users read" on public.subject_areas for select to authenticated using (true);
create policy "Admins insert" on public.subject_areas for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update" on public.subject_areas for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete" on public.subject_areas for delete to authenticated using ((select public.is_admin()));
