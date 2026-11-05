-- "Cambiar" carrera o plan (perfil). Decided on 16 October: no equivalences. The student's
-- subjects, requirements and semester plan (Opción A / B) belong to the old plan, so they are
-- deleted, and the student loads their subjects again on the new plan.
--
-- * Kept: the courses the student took (user_courses) and their reviews. They are real
--   cursadas: pending reviews still ask for them, so changing career is not a way around them.
-- * One function, so the plan never changes without the cleanup (or the other way around).

create function public.change_my_plan(new_plan_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = me) then
    raise exception 'no profile' using errcode = '42501';
  end if;
  if not exists (select 1 from public.plans pl where pl.id = new_plan_id) then
    raise exception 'unknown plan %', new_plan_id using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where p.id = me and p.plan_id = new_plan_id) then
    return;  -- same plan: nothing to do
  end if;

  delete from public.user_subjects where user_id = me;
  delete from public.user_requirements where user_id = me;
  delete from public.plan_choices where user_id = me;
  update public.profiles set plan_id = new_plan_id where id = me;
end;
$$;

revoke execute on function public.change_my_plan(text) from public;
grant execute on function public.change_my_plan(text) to authenticated;
