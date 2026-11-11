-- Offer sent by students: a student of a plan without this term's offer pastes the SIU text
-- from the Plan screen. It is stored as pending; an admin publishes it with the same import
-- of /admin ("Procesar y publicar") or rejects it. A student never writes the offer itself.
--
-- * A student inserts only for their own plan and the current term, only while that plan has
--   no published offer, and at most 3 pending (and 10 a day). Only the text and the summary
--   numbers: status, author and review columns are not theirs to set.
-- * A student reads only their own submissions. Admins read and review all of them.
-- * The summary numbers come from the parser on the server, but a student could send others
--   through the API: they are a hint, the admin's import parses the text again.

create table public.offer_submissions (
  id bigint generated always as identity primary key,
  term_id text not null references public.terms (id) on update cascade on delete cascade,
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  submitted_by uuid default auth.uid() references public.profiles (id) on delete set null,
  raw_text text not null check (char_length(raw_text) between 1 and 400000),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  subjects integer not null default 0 check (subjects between 0 and 10000),
  courses integer not null default 0 check (courses between 0 and 100000),
  blocks integer not null default 0 check (blocks between 0 and 100000),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null
);

create index offer_submissions_term_plan_idx on public.offer_submissions (term_id, plan_id, status);
create index offer_submissions_submitted_by_idx on public.offer_submissions (submitted_by, created_at);

-- Rate limit and "only while there is no offer": checked here because a student cannot read
-- the other rows nor offer_imports.
create function public.check_offer_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if (select count(*) from public.offer_submissions s
      where s.submitted_by = new.submitted_by and s.status = 'pending') >= 3 then
    raise exception 'too many pending offer submissions' using errcode = 'P0001', hint = 'pending_limit';
  end if;
  if (select count(*) from public.offer_submissions s
      where s.submitted_by = new.submitted_by and s.created_at > now() - interval '1 day') >= 10 then
    raise exception 'too many offer submissions today' using errcode = 'P0001', hint = 'daily_limit';
  end if;
  if exists (select 1 from public.offer_imports i
             where i.term_id = new.term_id and i.plan_id = new.plan_id and i.status = 'published') then
    raise exception 'this plan already has an offer' using errcode = 'P0001', hint = 'already_published';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_offer_submission() from public;

create trigger offer_submissions_check
  before insert on public.offer_submissions
  for each row execute function public.check_offer_submission();

alter table public.offer_submissions enable row level security;

grant select on public.offer_submissions to authenticated;
grant insert (term_id, plan_id, raw_text, subjects, courses, blocks) on public.offer_submissions to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.offer_submissions to authenticated;

create policy "Students read their offer submissions" on public.offer_submissions
  for select to authenticated using (submitted_by = (select auth.uid()) or (select public.is_admin()));

create policy "Students send the offer of their plan" on public.offer_submissions
  for insert to authenticated with check (
    (select public.is_member())
    and submitted_by = (select auth.uid())
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and plan_id = (select p.plan_id from public.profiles p where p.id = (select auth.uid()))
    and term_id = (select t.id from public.terms t where t.is_current)
  );

create policy "Admins review offer submissions" on public.offer_submissions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Administración: pending submissions of the current term with who sent them (name and mail,
-- from auth.users, which the app cannot read). Without the text, which can be long.
create function public.admin_offer_submissions()
returns table (
  id bigint,
  plan_id text,
  subjects integer,
  courses integer,
  blocks integer,
  created_at timestamptz,
  full_name text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;
  return query
  select
    s.id,
    s.plan_id,
    s.subjects,
    s.courses,
    s.blocks,
    s.created_at,
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')::text,
    coalesce(u.email, '')::text
  from public.offer_submissions s
  join public.terms t on t.id = s.term_id and t.is_current
  left join auth.users u on u.id = s.submitted_by
  where s.status = 'pending'
  order by s.created_at;
end;
$$;

revoke execute on function public.admin_offer_submissions() from public;
grant execute on function public.admin_offer_submissions() to authenticated;
