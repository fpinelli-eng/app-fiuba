-- Courses a student picks in the semester plan, in two alternatives ("Opción A / B").
-- One row per chosen offering; the term is the offering's. Prototype 07-plan.
--
-- * Only the student reads and changes their rows.
-- * Only visible offerings of the student's own plan can be picked.
-- * Deleting the account (profiles) deletes the choices; so does an admin deleting
--   the offering when the offer of a plan is replaced.

create table public.plan_choices (
  user_id uuid not null references public.profiles (id) on delete cascade,
  option text not null check (option in ('A', 'B')),
  offering_id bigint not null references public.offerings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, option, offering_id)
);

create index plan_choices_offering_idx on public.plan_choices (offering_id);

alter table public.plan_choices enable row level security;

grant select, insert, delete on public.plan_choices to authenticated;

create policy "Students read their plan" on public.plan_choices
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Students pick courses of their plan" on public.plan_choices
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.offerings o
      join public.profiles p on p.plan_id = o.plan_id
      where o.id = offering_id and o.visible and p.id = (select auth.uid())
    )
  );

create policy "Students remove courses from their plan" on public.plan_choices
  for delete to authenticated using (user_id = (select auth.uid()));
