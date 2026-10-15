-- Reads require a FIUBA account, not just a session.
--
-- Any Google account can get a Supabase session (the app signs it out, but the API
-- key is public). Those accounts never get a profile (ensure_profile only accepts
-- @fi.uba.ar), so read policies now ask for one. Also:
-- * schedule blocks of a hidden offering are hidden too, like the offering;
-- * a student can only mark as taken an offering of their own plan.

create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

revoke execute on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- Catalog and offer (the loop of the initial schema, plus subject_areas).
do $$
declare
  t text;
begin
  foreach t in array array[
    'careers', 'plans', 'plan_requirements', 'subjects', 'subject_prerequisites',
    'subject_siu_codes', 'terms', 'courses', 'subject_areas'
  ] loop
    execute format('drop policy "Signed-in users read" on public.%I', t);
    execute format('create policy "Members read" on public.%I for select to authenticated using ((select public.is_member()))', t);
  end loop;
end;
$$;

drop policy "Signed-in users read" on public.offering_blocks;
-- The subquery goes through the offerings policy: students only reach visible ones.
create policy "Members read blocks of visible offerings" on public.offering_blocks
  for select to authenticated using (
    (select public.is_member())
    and exists (select 1 from public.offerings o where o.id = offering_id)
  );

drop policy "Signed-in users read visible offerings" on public.offerings;
create policy "Members read visible offerings" on public.offerings
  for select to authenticated using (
    (select public.is_member()) and (visible or (select public.is_admin()))
  );

drop policy "Signed-in users read visible reviews" on public.reviews;
create policy "Members read visible reviews" on public.reviews
  for select to authenticated using (
    (select public.is_member()) and (hidden_at is null or (select public.is_admin()))
  );

drop policy "Students add their courses" on public.user_courses;
create policy "Students add courses of their plan" on public.user_courses
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.offerings o
      join public.profiles p on p.plan_id = o.plan_id
      where o.id = offering_id and o.visible and p.id = (select auth.uid())
    )
  );
