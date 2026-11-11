-- Career and plan change only through the app's flows (security review, 11 November 2026).
--
-- Until now a student could run `update profiles set plan_id = ...` through the API
-- (column grant of the initial schema). That skipped change_my_plan(), which deletes the
-- subjects, requirements and semester plan of the old plan: a student could end up with
-- subjects of one plan on another.
--
-- * The column grant goes. intro_seen_at and failed_finals keep theirs.
-- * The first choice (onboarding, /carrera) goes through choose_my_plan(): only while the
--   student has no plan. Choosing the same plan again does nothing (a double submit);
--   a different one is a change, and changes go through change_my_plan().
-- * Any plan in public.plans can be picked: the picker lists them all (older plans too).

revoke update (plan_id) on public.profiles from authenticated;

create function public.choose_my_plan(new_plan_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  current_plan text;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select p.plan_id into current_plan from public.profiles p where p.id = me for update;
  if not found then
    raise exception 'no profile' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plans pl where pl.id = new_plan_id) then
    raise exception 'unknown plan %', new_plan_id using errcode = '22023';
  end if;
  if current_plan is not null then
    if current_plan = new_plan_id then
      return;  -- already chosen: nothing to do
    end if;
    raise exception 'plan already chosen, use change_my_plan' using errcode = '42501';
  end if;

  update public.profiles set plan_id = new_plan_id where id = me;
end;
$$;

revoke execute on function public.choose_my_plan(text) from public;
grant execute on function public.choose_my_plan(text) to authenticated;
