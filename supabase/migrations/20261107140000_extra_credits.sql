-- Map → "Créditos y extras": credits that do not come from a subject of the plan (FIUBATÓN and other
-- activities, subjects of an old plan that were recognized with credits) and the number of failed
-- finals (aplazos). Extra credits add to the approved credits and to the electives. The aplazos are
-- only stored for now: the average will use them later.
--
-- Each student reads and writes only their own.

create table public.user_extra_credits (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  credits smallint not null check (credits between 1 and 60),
  kind text not null default 'activity' check (kind in ('activity', 'old_plan', 'other')),
  created_at timestamptz not null default now()
);

create index user_extra_credits_user_idx on public.user_extra_credits (user_id);

alter table public.user_extra_credits enable row level security;
grant select, insert, delete on public.user_extra_credits to authenticated;
create policy "Students read their extra credits" on public.user_extra_credits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Students add their extra credits" on public.user_extra_credits
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_member()));
create policy "Students delete their extra credits" on public.user_extra_credits
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.profiles add column failed_finals smallint not null default 0 check (failed_finals between 0 and 99);
grant update (failed_finals) on public.profiles to authenticated;
