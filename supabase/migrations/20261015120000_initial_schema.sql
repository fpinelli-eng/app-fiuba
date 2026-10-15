-- Initial schema: study plans, student progress, course offer and reviews.
-- Conceptual model: PRODUCTO.md, section 8.
--
-- Security model
-- * Every table has row level security (RLS) on.
-- * Nothing is granted to `anon`: every section of the app requires a session.
-- * Students read the catalog and read/write only their own rows.
-- * Admins (profiles.is_admin) write the catalog, the offer and moderate reviews.
--   Nobody can make themselves admin from the app: is_admin has no update grant.
-- * Review authorship lives in `review_authors`, which no client role can read.
--   Reviews are written through security definer functions. When an account is
--   deleted its review_authors rows go with it and the reviews stay, anonymous.

-- ---------------------------------------------------------------------------
-- Defaults
-- ---------------------------------------------------------------------------

-- Supabase may grant new objects to the API roles by default. Grants here are
-- explicit, so start from nothing.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Study plans (catalog)
-- ---------------------------------------------------------------------------

create table public.careers (
  id text primary key,                 -- 'industrial'
  name text not null,                  -- 'Ingeniería Industrial'
  short_name text not null,            -- 'Ing. Industrial'
  sort smallint not null default 0
);

create table public.plans (
  id text primary key,                 -- 'industrial-2023' (official year, never FIUBA Map's "2020")
  career_id text not null references public.careers (id) on update cascade,
  year smallint not null,
  legacy_name text,                    -- career name when the plan was created, if it changed
  is_current boolean not null default false,
  -- Credits needed to graduate, as in FIUBA Map: { total, electivas, materias: [codes], orientacion }
  credit_rules jsonb not null default '{}'::jsonb,
  fiuba_map_file text,                 -- source file in data/planes
  sort smallint not null default 0,
  unique (career_id, year)
);

create unique index plans_one_current_per_career on public.plans (career_id) where is_current;

-- Requirements that are not subjects, e.g. the English level test.
create table public.plan_requirements (
  id bigint generated always as identity primary key,
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  name text not null,
  short_name text not null,
  sort smallint not null default 0,
  unique (plan_id, name)
);

create table public.subjects (
  id bigint generated always as identity primary key,
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  code text not null,                  -- FIUBA Map id: 'AL', '61.03', 'CBC66', 'CBC'
  name text not null,
  credits smallint not null default 0 check (credits >= 0),
  kind text not null check (kind in (
    'cbc_subject',                     -- one CBC subject
    'cbc',                             -- the node that stands for the whole CBC
    'required',
    'elective',
    'orientation',                     -- subject of an orientation (category holds its name)
    'final_project',                   -- mandatory final work (TIF)
    'final_option'                     -- Tesis / Trabajo Profesional, one of them
  )),
  category text not null,              -- FIUBA Map category, as written there
  level smallint,                      -- suggested term (map column); CBC subjects use -2/-1, the CBC node 0
  required_credits smallint check (required_credits > 0), -- approved credits needed to take it
  requires_cbc boolean not null default false,
  sort smallint not null default 0,    -- order in the source file
  unique (plan_id, code)
);

create index subjects_plan_id_idx on public.subjects (plan_id);

create table public.subject_prerequisites (
  subject_id bigint not null references public.subjects (id) on delete cascade,
  prerequisite_id bigint not null references public.subjects (id) on delete cascade,
  primary key (subject_id, prerequisite_id),
  check (subject_id <> prerequisite_id)
);

create index subject_prerequisites_prerequisite_idx on public.subject_prerequisites (prerequisite_id);

-- FIUBA Map codes are not the SIU ones ('AL' is CB002 in the SIU).
create table public.subject_siu_codes (
  subject_id bigint not null references public.subjects (id) on delete cascade,
  siu_code text not null,
  primary key (subject_id, siu_code)
);

create index subject_siu_codes_siu_code_idx on public.subject_siu_codes (siu_code);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------

-- One row per @fi.uba.ar account. Name, email and Google photo stay in auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  plan_id text references public.plans (id) on update cascade,  -- one career and one plan per account
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.user_subjects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  subject_id bigint not null references public.subjects (id) on delete cascade,
  status text not null check (status in ('approved', 'final_pending', 'in_progress')),
  grade smallint check (grade between 4 and 10),
  updated_at timestamptz not null default now(),
  primary key (user_id, subject_id),
  -- "Aprobada" always has a grade; the other states never do.
  check ((status = 'approved') = (grade is not null))
);

create index user_subjects_subject_idx on public.user_subjects (subject_id);

create trigger user_subjects_set_updated_at
  before update on public.user_subjects
  for each row execute function public.set_updated_at();

-- A row means the requirement is approved.
create table public.user_requirements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  requirement_id bigint not null references public.plan_requirements (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, requirement_id)
);

create index user_requirements_requirement_idx on public.user_requirements (requirement_id);

-- ---------------------------------------------------------------------------
-- Course offer
-- ---------------------------------------------------------------------------

create table public.terms (
  id text primary key,                 -- '2026-2C'
  year smallint not null,
  half smallint not null check (half in (1, 2)),
  reviews_open_on date,                -- pending reviews show up from this date
  is_current boolean not null default false,
  unique (year, half)
);

create unique index terms_one_current on public.terms (is_current) where is_current;

-- Admin dashboard: one row per term and plan once its SIU text was processed.
-- No row = "sin cargar".
create table public.offer_imports (
  term_id text not null references public.terms (id) on update cascade on delete cascade,
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  status text not null check (status in ('processed', 'published')),
  raw_text text not null,
  parsed jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (term_id, plan_id)
);

create trigger offer_imports_set_updated_at
  before update on public.offer_imports
  for each row execute function public.set_updated_at();

-- A course keeps its identity across terms (same subject and teachers), so its
-- reviews follow it from one offer to the next. PRODUCTO.md, section 8.
create table public.courses (
  id bigint generated always as identity primary key,
  siu_subject_code text not null,
  created_at timestamptz not null default now()
);

create index courses_siu_subject_code_idx on public.courses (siu_subject_code);

-- One commission (or practice subcommission) in one term, as published for one plan.
create table public.offerings (
  id bigint generated always as identity primary key,
  term_id text not null references public.terms (id) on update cascade on delete cascade,
  plan_id text not null references public.plans (id) on update cascade on delete cascade,
  course_id bigint not null references public.courses (id),
  siu_subject_code text not null,
  siu_subject_name text not null,
  course_number text,                  -- '02'; null only for odd SIU names
  practice text,                       -- 'A' for "CURSO 01A"; null when there are no subcommissions
  label text not null,                 -- 'Curso 2' / 'Curso 1 · práctica A'
  modality text,                       -- 'Promoción' | 'Regularidad'
  teachers jsonb not null default '[]'::jsonb, -- [{ "nombre": "...", "rol": "..." }]
  quota integer,
  enrolled integer,
  visible boolean not null default true, -- admin "Quitar" / "Volver a mostrar"
  created_at timestamptz not null default now(),
  unique nulls not distinct (term_id, plan_id, siu_subject_code, course_number, practice)
);

create index offerings_course_idx on public.offerings (course_id);
create index offerings_plan_term_idx on public.offerings (plan_id, term_id);

create table public.offering_blocks (
  id bigint generated always as identity primary key,
  offering_id bigint not null references public.offerings (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = Monday
  starts_at smallint not null check (starts_at between 0 and 1440), -- minutes since midnight
  ends_at smallint not null check (ends_at between 0 and 1440),
  class_type text,                     -- 'Teórico', 'Práctica'…
  room text,
  campus text check (campus in ('PC', 'LH', 'CU')),
  is_async boolean not null default false,
  check (ends_at > starts_at)
);

create index offering_blocks_offering_idx on public.offering_blocks (offering_id);

-- Courses a student took ("cursadas"). They drive pending reviews.
create table public.user_courses (
  user_id uuid not null references public.profiles (id) on delete cascade,
  offering_id bigint not null references public.offerings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, offering_id)
);

create index user_courses_offering_idx on public.user_courses (offering_id);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

-- No author column on purpose: a client can never read who wrote a review.
create table public.reviews (
  id bigint generated always as identity primary key,
  course_id bigint not null references public.courses (id),
  term_id text not null references public.terms (id) on update cascade,
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) between 1 and 500),
  pinned boolean not null default false,  -- "Destacada"
  hidden_at timestamptz,                  -- deleted by an admin (kept for "Deshacer")
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_course_idx on public.reviews (course_id);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- Who wrote each review: only to prevent duplicates and to let the author edit it.
-- No grants at all; only the security definer functions below use it.
create table public.review_authors (
  review_id bigint primary key references public.reviews (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  course_id bigint not null references public.courses (id),
  term_id text not null references public.terms (id) on update cascade,
  unique (author_id, course_id, term_id)  -- one review per student, course and term
);

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- Creates the caller's profile if it is missing. Only @fi.uba.ar accounts get one,
-- so any other account can't write anything (every student policy needs a profile).
create function public.ensure_profile()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_email not like '%@fi.uba.ar' then
    raise exception 'only @fi.uba.ar accounts' using errcode = '42501';
  end if;
  insert into public.profiles (id) values (auth.uid()) on conflict (id) do nothing;
end;
$$;

-- Creates or edits the caller's review of a course they took.
-- Returns the review id. The comment is trimmed; an empty comment is stored as null.
create function public.submit_review(p_offering_id bigint, p_stars smallint, p_comment text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course_id bigint;
  v_term_id text;
  v_opens date;
  v_comment text := nullif(btrim(p_comment), '');
  v_review_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select o.course_id, o.term_id, t.reviews_open_on
    into v_course_id, v_term_id, v_opens
  from public.user_courses uc
  join public.offerings o on o.id = uc.offering_id
  join public.terms t on t.id = o.term_id
  where uc.user_id = v_uid and uc.offering_id = p_offering_id;

  if v_course_id is null then
    raise exception 'you did not take this course' using errcode = '42501';
  end if;
  if v_opens is null or v_opens > current_date then
    raise exception 'reviews for this term are not open yet' using errcode = '42501';
  end if;

  select ra.review_id into v_review_id
  from public.review_authors ra
  where ra.author_id = v_uid and ra.course_id = v_course_id and ra.term_id = v_term_id;

  if v_review_id is null then
    insert into public.reviews (course_id, term_id, stars, comment)
    values (v_course_id, v_term_id, p_stars, v_comment)
    returning id into v_review_id;

    insert into public.review_authors (review_id, author_id, course_id, term_id)
    values (v_review_id, v_uid, v_course_id, v_term_id);
  else
    update public.reviews
    set stars = p_stars, comment = v_comment
    where id = v_review_id;
  end if;

  return v_review_id;
end;
$$;

-- The caller's own reviews ("Mis reseñas"), including any an admin hid.
create function public.my_reviews()
returns table (
  review_id bigint,
  course_id bigint,
  term_id text,
  stars smallint,
  comment text,
  hidden boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.course_id, r.term_id, r.stars, r.comment, r.hidden_at is not null, r.created_at, r.updated_at
  from public.review_authors ra
  join public.reviews r on r.id = ra.review_id
  where ra.author_id = auth.uid()
  order by r.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.careers enable row level security;
alter table public.plans enable row level security;
alter table public.plan_requirements enable row level security;
alter table public.subjects enable row level security;
alter table public.subject_prerequisites enable row level security;
alter table public.subject_siu_codes enable row level security;
alter table public.profiles enable row level security;
alter table public.user_subjects enable row level security;
alter table public.user_requirements enable row level security;
alter table public.terms enable row level security;
alter table public.offer_imports enable row level security;
alter table public.courses enable row level security;
alter table public.offerings enable row level security;
alter table public.offering_blocks enable row level security;
alter table public.user_courses enable row level security;
alter table public.reviews enable row level security;
alter table public.review_authors enable row level security;

-- Catalog and offer: every signed-in user reads; only admins write.
do $$
declare
  t text;
begin
  foreach t in array array[
    'careers', 'plans', 'plan_requirements', 'subjects', 'subject_prerequisites',
    'subject_siu_codes', 'terms', 'courses', 'offering_blocks'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "Signed-in users read" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "Admins insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "Admins update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "Admins delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- Offerings: hidden ones ("Quitar") only for admins.
grant select, insert, update, delete on public.offerings to authenticated;
create policy "Signed-in users read visible offerings" on public.offerings
  for select to authenticated using (visible or (select public.is_admin()));
create policy "Admins insert" on public.offerings
  for insert to authenticated with check ((select public.is_admin()));
create policy "Admins update" on public.offerings
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete" on public.offerings
  for delete to authenticated using ((select public.is_admin()));

-- SIU imports: admins only.
grant select, insert, update, delete on public.offer_imports to authenticated;
create policy "Admins manage imports" on public.offer_imports
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- Profiles: each student reads theirs and can only change their plan.
grant select on public.profiles to authenticated;
grant update (plan_id) on public.profiles to authenticated;
create policy "Students read their profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Students update their profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Subjects of the student: only their own, and only subjects of their plan.
grant select, insert, update, delete on public.user_subjects to authenticated;
create policy "Students read their subjects" on public.user_subjects
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Students add subjects of their plan" on public.user_subjects
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.subjects s
      join public.profiles p on p.plan_id = s.plan_id
      where s.id = subject_id and p.id = (select auth.uid())
    )
  );
create policy "Students update their subjects" on public.user_subjects
  for update to authenticated using (user_id = (select auth.uid())) with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.subjects s
      join public.profiles p on p.plan_id = s.plan_id
      where s.id = subject_id and p.id = (select auth.uid())
    )
  );
create policy "Students delete their subjects" on public.user_subjects
  for delete to authenticated using (user_id = (select auth.uid()));

-- Non-subject requirements: same rule.
grant select, insert, delete on public.user_requirements to authenticated;
create policy "Students read their requirements" on public.user_requirements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Students add requirements of their plan" on public.user_requirements
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.plan_requirements r
      join public.profiles p on p.plan_id = r.plan_id
      where r.id = requirement_id and p.id = (select auth.uid())
    )
  );
create policy "Students delete their requirements" on public.user_requirements
  for delete to authenticated using (user_id = (select auth.uid()));

-- Courses the student took: their own, and only offerings they can see.
grant select, insert, delete on public.user_courses to authenticated;
create policy "Students read their courses" on public.user_courses
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Students add their courses" on public.user_courses
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()))
    and exists (select 1 from public.offerings o where o.id = offering_id and o.visible)
  );
create policy "Students delete their courses" on public.user_courses
  for delete to authenticated using (user_id = (select auth.uid()));

-- Reviews: everyone reads the visible ones; admins also see hidden ones and can
-- pin, hide and unhide. Students write only through submit_review().
grant select on public.reviews to authenticated;
grant update (pinned, hidden_at) on public.reviews to authenticated;
create policy "Signed-in users read visible reviews" on public.reviews
  for select to authenticated using (hidden_at is null or (select public.is_admin()));
create policy "Admins moderate reviews" on public.reviews
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- review_authors: RLS on, no policies and no grants. Unreadable from the API.

-- Functions callable by signed-in users.
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.ensure_profile() from public;
revoke execute on function public.submit_review(bigint, smallint, text) from public;
revoke execute on function public.my_reviews() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.ensure_profile() to authenticated;
grant execute on function public.submit_review(bigint, smallint, text) to authenticated;
grant execute on function public.my_reviews() to authenticated;
