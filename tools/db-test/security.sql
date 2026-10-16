-- Security tests for the migrations: who can read and write what.
-- Run with tools/db-test/run.sh. Any failed check stops with an error.

\set ON_ERROR_STOP 1
\set QUIET 1

-- Helpers ---------------------------------------------------------------------

create schema test;
grant usage on schema test to anon, authenticated;

-- Runs a statement as the current role and fails if it does NOT raise an error.
create function test.fails(stmt text, what text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    return;
  end;
  raise exception 'FAILED: % (expected an error, the statement worked)', what;
end;
$$;

create function test.ok(cond boolean, what text) returns void language plpgsql as $$
begin
  if cond is distinct from true then
    raise exception 'FAILED: %', what;
  end if;
end;
$$;

grant execute on all functions in schema test to anon, authenticated;

-- Fixtures (as the migration owner) ------------------------------------------------

insert into auth.users values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@fi.uba.ar'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'beto@fi.uba.ar'),
  ('cccccccc-0000-0000-0000-000000000003', 'otro@gmail.com');

insert into public.terms (id, year, half) values ('2026-1C', 2026, 1);
insert into public.courses (siu_subject_code) values ('CB002');
insert into public.offerings (term_id, plan_id, course_id, siu_subject_code, siu_subject_name, course_number, label, visible)
values
  ('2026-1C', 'industrial-2023', 1, 'CB002', 'Álgebra Lineal', '01', 'Curso 1', true),
  ('2026-1C', 'industrial-2023', 1, 'CB002', 'Álgebra Lineal', '02', 'Curso 2', false),
  ('2026-1C', 'civil-2023', 1, 'CB002', 'Álgebra Lineal', '03', 'Curso 3', true);
insert into public.offering_blocks (offering_id, weekday, starts_at, ends_at, campus)
values (1, 1, 540, 660, 'PC'), (2, 2, 540, 660, 'PC');

-- Seed ------------------------------------------------------------------------------

select test.ok((select count(*) from public.careers) = 13, '13 careers');
select test.ok((select count(*) from public.plans) = 24, '24 plans');
select test.ok((select count(*) from public.plans where is_current) = 13, 'one current plan per career');
select test.ok((select count(*) from public.subjects where plan_id = 'industrial-2023') = 66, 'Industrial 2023 has 66 subjects');
select test.ok(
  (select count(*) from public.subject_prerequisites sp
   join public.subjects s on s.id = sp.subject_id
   join public.subjects r on r.id = sp.prerequisite_id
   where s.plan_id <> r.plan_id) = 0,
  'prerequisites stay inside their plan');
select test.ok((select count(*) from public.subject_areas where plan_id = 'industrial-2023') = 5, 'Industrial 2023 has 5 elective areas');
select test.ok(
  (select count(*) from public.subjects where plan_id = 'industrial-2023' and kind = 'elective' and area_id is null) = 0,
  'every Industrial 2023 elective has an area');

-- Visitors without a session ------------------------------------------------------

set role anon;
select test.fails('select 1 from public.subjects limit 1', 'anon reads subjects');
select test.fails('select 1 from public.reviews limit 1', 'anon reads reviews');
select test.fails('select public.ensure_profile()', 'anon creates a profile');
select test.fails('select public.review_course(1, 4::smallint, null)', 'anon writes a review');
reset role;

-- An account from another domain --------------------------------------------------

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","email":"otro@gmail.com"}', false);
select test.fails('select public.ensure_profile()', 'gmail account gets a profile');
select test.fails($$insert into public.user_subjects values ('cccccccc-0000-0000-0000-000000000003', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AL'), 'in_progress', null)$$,
  'gmail account saves a subject');
-- A session is not enough to read: it takes a FIUBA account (a profile).
select test.ok((select count(*) from public.careers) = 0, 'gmail account reads careers');
select test.ok((select count(*) from public.subjects) = 0, 'gmail account reads subjects');
select test.ok((select count(*) from public.subject_areas) = 0, 'gmail account reads elective areas');
select test.ok((select count(*) from public.terms) = 0, 'gmail account reads terms');
select test.ok((select count(*) from public.offerings) = 0, 'gmail account reads offerings');
select test.ok((select count(*) from public.offering_blocks) = 0, 'gmail account reads schedules');
reset role;

-- A student -------------------------------------------------------------------------

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"Ana@FI.UBA.AR"}', false);
select public.ensure_profile();
select public.ensure_profile();  -- twice is fine
select test.ok((select count(*) from public.profiles) = 1, 'student sees only their profile');
select test.ok((select plan_id from public.profiles) is null, 'new profile has no plan');

update public.profiles set plan_id = 'industrial-2023';
select test.ok((select plan_id from public.profiles) = 'industrial-2023', 'student picks a plan');
select test.fails('update public.profiles set is_admin = true', 'student makes themselves admin');
select test.fails($$update public.profiles set plan_id = 'no-existe'$$, 'student picks a plan that does not exist');

insert into public.user_subjects (user_id, subject_id, status, grade)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AL'), 'approved', 8);
-- Upsert as the Supabase client sends it.
insert into public.user_subjects (user_id, subject_id, status, grade)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AL'), 'approved', 9)
on conflict (user_id, subject_id) do update
set user_id = excluded.user_id, subject_id = excluded.subject_id, status = excluded.status, grade = excluded.grade;
select test.ok((select grade from public.user_subjects) = 9, 'student edits a grade');

select test.fails($$insert into public.user_subjects values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AMII'), 'approved', null)$$,
  'approved without a grade');
select test.fails($$insert into public.user_subjects values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AMII'), 'in_progress', 7)$$,
  'in progress with a grade');
select test.fails($$insert into public.user_subjects values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.subjects where plan_id = 'civil-2023' and code = 'AL'), 'in_progress', null)$$,
  'subject of another plan');
select test.fails($$insert into public.user_subjects values ('bbbbbbbb-0000-0000-0000-000000000002', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'QB'), 'in_progress', null)$$,
  'subject for another student');

insert into public.user_requirements (user_id, requirement_id)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.plan_requirements where plan_id = 'industrial-2023'));

select test.fails($$insert into public.careers values ('x', 'x', 'x', 0)$$, 'student edits the catalog');
select test.fails($$insert into public.subject_areas (plan_id, name) values ('industrial-2023', 'x')$$, 'student adds an elective area');
select test.ok((select count(*) from public.subject_areas) > 0, 'students read the elective areas');
-- RLS turns a forbidden update into "0 rows".
update public.subjects set credits = 99 where code = 'AL';
select test.ok((select count(*) from public.subjects where credits = 99) = 0, 'student edits a subject');
select test.ok((select count(*) from public.offer_imports) = 0, 'student reads SIU imports');

select test.ok((select count(*) from public.offerings) = 2, 'student sees only visible offerings');
select test.ok((select count(*) from public.offering_blocks) = 1, 'student sees only schedules of visible offerings');
insert into public.user_courses values ('aaaaaaaa-0000-0000-0000-000000000001', 1);
select test.fails($$insert into public.user_courses values ('aaaaaaaa-0000-0000-0000-000000000001', 2)$$, 'student adds a hidden offering');
select test.fails($$insert into public.user_courses values ('aaaaaaaa-0000-0000-0000-000000000001', 3)$$, 'student adds an offering of another plan');

-- Reviews ---------------------------------------------------------------------------

select test.fails('select public.submit_review(1, 5::smallint, null)', 'review before the review date');
reset role;
update public.terms set reviews_open_on = current_date where id = '2026-1C';
set role authenticated;

select test.ok(public.submit_review(1, 5::smallint, '  Muy bueno  ') = 1, 'student writes a review');
select test.ok((select comment from public.reviews) = 'Muy bueno', 'comment is trimmed');
select test.ok(public.submit_review(1, 4::smallint, '   ') = 1, 'second submit edits the same review');
select test.ok((select stars = 4 and comment is null from public.reviews), 'review edited, empty comment saved as null');
select test.fails('select public.submit_review(1, 6::smallint, null)', '6 stars');
select test.fails($$select public.submit_review(1, 3::smallint, repeat('a', 501))$$, 'comment over 500 characters');
select test.fails('select public.submit_review(2, 3::smallint, null)', 'review of a course not taken');

select test.fails('select 1 from public.review_authors', 'student reads review_authors');
select test.ok(
  (select count(*) from information_schema.columns
   where table_schema = 'public' and table_name = 'reviews' and column_name ilike '%author%') = 0,
  'reviews has no author column');
select test.fails($$insert into public.reviews (course_id, term_id, stars) values (1, '2026-1C', 5)$$, 'student inserts a review directly');
update public.reviews set pinned = true;
select test.ok((select not pinned from public.reviews), 'student pins a review');
select test.ok((select count(*) from public.my_reviews()) = 1, 'student sees their review in my_reviews');

-- Free reviews: any course with a visible offering, taken or not; one per student and course.
reset role;
insert into public.courses (siu_subject_code) values ('CB001'), ('CB001');
insert into public.offerings (term_id, plan_id, course_id, siu_subject_code, siu_subject_name, course_number, label, visible)
values
  ('2026-1C', 'industrial-2023', 2, 'CB001', 'Análisis Matemático II', '01', 'Curso 1', true),
  ('2026-1C', 'industrial-2023', 3, 'CB001', 'Análisis Matemático II', '02', 'Curso 2', false);
set role authenticated;
select test.ok(public.review_course(2, 3::smallint, '  Bien  ') = 2, 'student reviews a course she did not take');
select test.ok((select comment from public.reviews where id = 2) = 'Bien', 'free review comment is trimmed');
select test.ok(public.review_course(2, 5::smallint, null) = 2, 'reviewing again edits the same review');
select test.ok((select stars = 5 and comment is null from public.reviews where id = 2), 'free review edited');
select test.ok(public.review_course(1, 2::smallint, null) = 1, 'free review of a taken course edits the pending one');
select test.ok(public.submit_review(1, 4::smallint, null) = 1, 'pending review edits the existing one');
select test.ok((select count(*) from public.my_reviews()) = 2, 'one review per student and course');
select test.fails('select public.review_course(3, 4::smallint, null)', 'review of a removed course');
select test.fails('select public.review_course(999, 4::smallint, null)', 'review of a course that does not exist');
select test.fails('select public.review_course(2, 0::smallint, null)', '0 stars');
select test.fails($$select public.review_course(2, 3::smallint, repeat('a', 501))$$, 'free review over 500 characters');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","email":"otro@gmail.com"}', false);
select test.ok((select count(*) from public.reviews) = 0, 'gmail account reads reviews');
select test.fails('select public.review_course(2, 4::smallint, null)', 'gmail account writes a review');
reset role;

-- Another student, admin ------------------------------------------------------------

insert into public.profiles (id, is_admin) values ('bbbbbbbb-0000-0000-0000-000000000002', true);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","email":"beto@fi.uba.ar"}', false);
select test.ok((select count(*) from public.user_subjects) = 0, 'another student does not see her subjects');
select test.ok((select count(*) from public.user_requirements) = 0, 'another student does not see her requirements');
select test.ok((select count(*) from public.user_courses) = 0, 'another student does not see her courses');
select test.ok((select count(*) from public.my_reviews()) = 0, 'another student does not get her review in my_reviews');
select test.fails('select 1 from public.review_authors', 'admin reads review_authors');

update public.reviews set pinned = true, hidden_at = now();
select test.ok((select bool_and(pinned and hidden_at is not null) from public.reviews), 'admin pins and hides reviews');
select test.fails('update public.reviews set stars = 1', 'admin edits the stars of a review');
select test.ok((select count(*) from public.offerings) = 5, 'admin sees hidden offerings');
select test.ok((select count(*) from public.offering_blocks) = 2, 'admin sees schedules of hidden offerings');
insert into public.subjects (plan_id, code, name, kind, category) values ('industrial-2023', 'ZZ', 'Prueba', 'elective', 'Materias Electivas');
delete from public.subjects where code = 'ZZ';
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"ana@fi.uba.ar"}', false);
select test.ok((select count(*) from public.reviews) = 0, 'students do not see hidden reviews');
select test.ok((select bool_and(hidden) from public.my_reviews()), 'the author sees them as hidden');
reset role;

-- Deleting the account keeps the review, without author ---------------------------

set role anon;
select test.fails('select public.delete_my_account()', 'anon deletes an account');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"ana@fi.uba.ar"}', false);
select public.delete_my_account();
reset role;
select test.ok((select count(*) from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'student deletes their account');
select test.ok((select count(*) from auth.users where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 1, 'deleting an account leaves the others');
select test.ok((select count(*) from public.reviews) = 2, 'reviews stay after deleting the account');
select test.ok((select count(*) from public.review_authors) = 0, 'authorship is deleted with the account');
select test.ok((select count(*) from public.user_subjects) = 0, 'subjects are deleted with the account');

\echo 'All security checks passed.'
