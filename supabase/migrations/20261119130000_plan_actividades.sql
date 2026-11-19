-- Personal activities in the semester plan: things a student does besides their courses
-- (a teaching assistantship, a job, the gym) that they want to see in the weekly timetable of the
-- Plan, with the same overlap warnings as the courses.
--
-- One row per activity and term, with its weekly time blocks in a jsonb array:
--   [{"weekday": 1, "starts_at": 1080, "ends_at": 1200}, ...]
-- weekday 1 = Monday … 7 = Sunday; times in minutes since midnight (as offering_blocks).
-- An activity belongs to the term, not to "Opción A / B": both options show it.
--
-- * Students read, create, edit and delete only their own activities. They create them only for
--   the current term, at most 30 per term. The owner and the term cannot be changed.
-- * Deleting the account deletes them (profiles on delete cascade). Changing career or plan
--   (change_my_plan) keeps them: they do not depend on the study plan.

create function public.plan_activity_blocks_ok(blocks jsonb) returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  b jsonb;
  d int;
  s int;
  e int;
begin
  if blocks is null or jsonb_typeof(blocks) <> 'array' then
    return false;
  end if;
  if jsonb_array_length(blocks) not between 1 and 10 then
    return false;
  end if;
  for b in select value from jsonb_array_elements(blocks) loop
    if jsonb_typeof(b) <> 'object' or (select count(*) from jsonb_object_keys(b)) <> 3 then
      return false;
    end if;
    if jsonb_typeof(b -> 'weekday') is distinct from 'number'
      or jsonb_typeof(b -> 'starts_at') is distinct from 'number'
      or jsonb_typeof(b -> 'ends_at') is distinct from 'number'
      or (b ->> 'weekday') !~ '^[0-9]{1,4}$'
      or (b ->> 'starts_at') !~ '^[0-9]{1,4}$'
      or (b ->> 'ends_at') !~ '^[0-9]{1,4}$' then
      return false;
    end if;
    d := (b ->> 'weekday')::int;
    s := (b ->> 'starts_at')::int;
    e := (b ->> 'ends_at')::int;
    if d not between 1 and 7 or s >= e or e > 1440 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke execute on function public.plan_activity_blocks_ok(jsonb) from public;
grant execute on function public.plan_activity_blocks_ok(jsonb) to authenticated;

create table public.plan_activities (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  term_id text not null references public.terms (id) on update cascade on delete cascade,
  name text not null check (char_length(name) between 1 and 60 and btrim(name) <> ''),
  place text check (place is null or (char_length(place) between 1 and 80 and btrim(place) <> '')),
  color text not null check (color in ('lavender', 'mint', 'butter', 'sky', 'peach', 'pink')),
  blocks jsonb not null check (public.plan_activity_blocks_ok(blocks)),
  created_at timestamptz not null default now()
);

create index plan_activities_user_term_idx on public.plan_activities (user_id, term_id);

alter table public.plan_activities enable row level security;

-- Column grants: user_id comes from its default (auth.uid()) and neither it nor the term change.
grant select, delete on public.plan_activities to authenticated;
grant insert (term_id, name, place, color, blocks) on public.plan_activities to authenticated;
grant update (name, place, color, blocks) on public.plan_activities to authenticated;

create policy "Students read their activities" on public.plan_activities
  for select to authenticated using (user_id = (select auth.uid()) and (select public.is_member()));

create policy "Students create activities in the current term" on public.plan_activities
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (select public.is_member())
    and exists (select 1 from public.terms t where t.id = term_id and t.is_current)
  );

create policy "Students edit their activities" on public.plan_activities
  for update to authenticated
  using (user_id = (select auth.uid()) and (select public.is_member()))
  with check (user_id = (select auth.uid()));

create policy "Students delete their activities" on public.plan_activities
  for delete to authenticated using (user_id = (select auth.uid()));

-- At most 30 activities per student and term.
create function public.plan_activities_limit() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    select count(*) from public.plan_activities a
    where a.user_id = new.user_id and a.term_id = new.term_id
  ) >= 30 then
    raise exception 'Too many activities' using errcode = 'check_violation', hint = 'too_many_activities';
  end if;
  return new;
end;
$$;

create trigger plan_activities_limit
  before insert on public.plan_activities
  for each row execute function public.plan_activities_limit();
