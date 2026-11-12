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
insert into public.exam_tables (plan_id, siu_subject_code, siu_subject_name, name, exam_date, kind, enroll_from, enroll_to, start_time, end_time)
values ('industrial-2023', 'CB002', 'ÁLGEBRA LINEAL', 'MESA 01', '2026-12-09', 'Regular', '2026-11-30 14:00', '2026-12-07 14:00', '17:00', '20:00');
insert into public.news (title, body) values ('Inscripción a cursos de verano', 'Del 9 al 14 de noviembre.');
insert into public.fiuba_news (id, title, url, published_at) values (1, 'La FIUBA lanza la Credencial Estudiantil', 'https://www.fi.uba.ar/noticias/la-fiuba-lanza-la-credencial-estudiantil', '2026-11-02 12:30+00');
insert into public.historical_reviews (course_id, teacher, term_label, year, stars, comment) values (1, 'Pérez', '2C 2021', 2021, 4, 'Explica muy bien.');

-- Seed ------------------------------------------------------------------------------

select test.ok((select count(*) from public.careers) = 13, '13 careers');
select test.ok((select count(*) from public.plans) = 25, '25 plans');
select test.ok((select count(*) from public.plans where is_current) = 13, 'one current plan per career');
-- Added later (20261113145000_sistemas_2014.sql): Sistemas 2014 replaces 1986 as the current plan.
select test.ok((select count(*) from public.subjects where plan_id = 'sistemas-2014') = 58, 'Sistemas 2014 has 58 subjects');
select test.ok((select id from public.plans where career_id = 'sistemas' and is_current) = 'sistemas-2014', 'Sistemas 2014 is current');
select test.ok((select count(*) from public.subjects where plan_id = 'industrial-2023') = 66, 'Industrial 2023 has 66 subjects');
select test.ok(
  (select count(*) from public.subject_prerequisites sp
   join public.subjects s on s.id = sp.subject_id
   join public.subjects r on r.id = sp.prerequisite_id
   where s.plan_id <> r.plan_id) = 0,
  'prerequisites stay inside their plan');
select test.ok((select count(*) from public.subject_areas where plan_id = 'industrial-2023') = 5, 'Industrial 2023 has 5 elective areas');
-- Fixes from the official plans (20261016180000_verified_plans_fixes.sql).
select test.ok((select name from public.subjects where plan_id = 'quimica-2023' and code = 'CM1') = 'Conocimiento de Materiales Metálicos', 'Química: Materiales Metálicos');
select test.ok(
  (select count(*) from public.subject_prerequisites sp
   join public.subjects s on s.id = sp.subject_id
   join public.subjects p on p.id = sp.prerequisite_id
   where s.plan_id = 'quimica-2023' and s.code = 'MI' and p.code in ('QO', 'IBP')) = 2,
  'Química: Microbiología Industrial needs Química Orgánica and Ingeniería de Bioprocesos');
select test.ok(
  (select count(*) from public.subjects where plan_id = 'industrial-2023' and kind = 'elective' and area_id is null) = 0,
  'every Industrial 2023 elective has an area');
select test.ok((select count(*) from public.academic_events where calendar = '2026-2027') = 70, 'academic calendar 2026-2027 has 70 events');

-- Visitors without a session ------------------------------------------------------

set role anon;
select test.fails('select 1 from public.subjects limit 1', 'anon reads subjects');
select test.fails('select 1 from public.reviews limit 1', 'anon reads reviews');
select test.fails('select public.ensure_profile()', 'anon creates a profile');
select test.fails('select public.review_course(1, 4::smallint, null)', 'anon writes a review');
select test.fails($$select public.choose_my_plan('industrial-2023')$$, 'anon picks a plan');
reset role;

-- An account from another domain --------------------------------------------------

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","email":"otro@gmail.com"}', false);
select test.fails('select public.ensure_profile()', 'gmail account gets a profile');
select test.fails($$select public.choose_my_plan('industrial-2023')$$, 'gmail account picks a plan');
select test.fails($$insert into public.user_subjects values ('cccccccc-0000-0000-0000-000000000003', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AL'), 'in_progress', null)$$,
  'gmail account saves a subject');
-- A session is not enough to read: it takes a FIUBA account (a profile).
select test.ok((select count(*) from public.careers) = 0, 'gmail account reads careers');
select test.ok((select count(*) from public.subjects) = 0, 'gmail account reads subjects');
select test.ok((select count(*) from public.subject_areas) = 0, 'gmail account reads elective areas');
select test.ok((select count(*) from public.terms) = 0, 'gmail account reads terms');
select test.ok((select count(*) from public.offerings) = 0, 'gmail account reads offerings');
select test.ok((select count(*) from public.offering_blocks) = 0, 'gmail account reads schedules');
select test.ok((select count(*) from public.exam_tables) = 0, 'gmail account reads exam tables');
select test.ok((select count(*) from public.academic_events) = 0, 'gmail account reads the academic calendar');
select test.ok((select count(*) from public.news) = 0, 'gmail account reads news');
select test.ok((select count(*) from public.academic_date_confirmations) = 0, 'gmail account reads confirmed dates');
select test.ok((select count(*) from public.fiuba_news) = 0, 'gmail account reads FIUBA news');
select test.ok((select count(*) from public.historical_reviews) = 0, 'gmail account reads Dolly opinions');
select test.ok((select count(*) from public.course_star_counts(array[1::bigint])) = 0, 'gmail account reads course scores');
select test.fails($$insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name) values ('industrial-2023', 'CB002', 'MESA 01', 'Regular', '2026-12-09', 'Álgebra Lineal')$$, 'gmail account creates an exam reminder');
reset role;

-- A student -------------------------------------------------------------------------

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"Ana@FI.UBA.AR"}', false);
select public.ensure_profile();
select public.ensure_profile();  -- twice is fine
select test.ok((select count(*) from public.profiles) = 1, 'student sees only their profile');
select test.ok((select plan_id from public.profiles) is null, 'new profile has no plan');

-- The plan is chosen only with choose_my_plan() (once) and changed with change_my_plan().
select test.fails($$update public.profiles set plan_id = 'industrial-2023'$$, 'student sets their plan directly');
select test.fails($$select public.choose_my_plan('no-existe')$$, 'student picks a plan that does not exist');
select public.choose_my_plan('industrial-2023');
select test.ok((select plan_id from public.profiles) = 'industrial-2023', 'student picks a plan');
select public.choose_my_plan('industrial-2023');  -- twice (double submit) is fine
select test.fails($$select public.choose_my_plan('civil-2023')$$, 'student changes plan with choose_my_plan, skipping the cleanup');
select test.fails($$update public.profiles set plan_id = 'civil-2023'$$, 'student changes their plan directly, skipping the cleanup');
select test.ok((select plan_id from public.profiles) = 'industrial-2023', 'the plan stays after the failed changes');
select test.fails('update public.profiles set is_admin = true', 'student makes themselves admin');

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

insert into public.user_extra_credits (name, credits) values ('FIUBATÓN 2025', 2);
select test.ok((select count(*) from public.user_extra_credits where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 1, 'student adds extra credits');
select test.fails($$insert into public.user_extra_credits (user_id, name, credits) values ('bbbbbbbb-0000-0000-0000-000000000002', 'x', 2)$$, 'extra credits for another student');
select test.fails($$select * from public.admin_users()$$, 'student lists the users');
select public.touch_last_seen();
select test.ok((select last_seen_at from public.profiles) is not null, 'student marks her last visit');
select test.fails('update public.profiles set last_seen_at = null', 'student edits her last visit directly');
update public.profiles set failed_finals = 3;
select test.ok((select failed_finals from public.profiles) = 3, 'student sets her aplazos');

select test.fails($$insert into public.careers values ('x', 'x', 'x', 0)$$, 'student edits the catalog');
select test.fails($$insert into public.subject_areas (plan_id, name) values ('industrial-2023', 'x')$$, 'student adds an elective area');
select test.ok((select count(*) from public.subject_areas) > 0, 'students read the elective areas');
select test.ok((select count(*) from public.exam_tables) = 1, 'students read exam tables');
select test.ok((select start_time from public.exam_tables) = '17:00', 'students read exam times');
select test.fails($$insert into public.exam_tables (plan_id, siu_subject_code, siu_subject_name, name, exam_date, kind) values ('industrial-2023', 'X', 'X', 'X', '2026-12-01', 'Regular')$$, 'student adds an exam table');
select test.ok((select count(*) from public.exam_imports) = 0, 'student reads exam imports');
select test.ok((select count(*) from public.academic_events) = 70, 'students read the academic calendar');
select test.ok((select count(*) from public.news) = 1, 'students read news');
select test.fails($$insert into public.news (title) values ('x')$$, 'student publishes news');
select test.ok((select count(*) from public.fiuba_news) = 1, 'students read FIUBA news');
select test.fails($$insert into public.fiuba_news (id, title, url, published_at) values (2, 'x', 'https://www.fi.uba.ar/noticias/x', now())$$, 'student adds a FIUBA news item');
select test.ok((select count(*) from public.historical_reviews) = 1, 'students read Dolly opinions');
select test.ok((select dolly from public.course_star_counts(array[1::bigint])) = array[0, 0, 0, 1, 0], 'course scores include Dolly opinions');
select test.fails($$insert into public.historical_reviews (course_id, teacher, term_label, year, stars) values (1, 'x', '1C 2020', 2020, 5)$$, 'student adds a Dolly opinion');
update public.historical_reviews set hidden_at = now();
select test.ok((select count(*) from public.historical_reviews where hidden_at is not null) = 0, 'student hides a Dolly opinion');
select test.fails($$insert into public.academic_events (calendar, title, starts_on, ends_on) values ('2026-2027', 'x', '2026-11-02', '2026-11-07')$$, 'student adds an academic event');
select test.ok((select count(*) from public.academic_date_confirmations) = 4, 'students read the confirmed dates');
select test.fails($$insert into public.academic_date_confirmations (calendar, title, starts_on, ends_on, note) values ('2026-2027', 'x', '2026-11-02', '2026-11-07', 'x')$$, 'student confirms a date');
update public.academic_date_confirmations set note = 'x';
select test.ok((select count(*) from public.academic_date_confirmations where note = 'x') = 0, 'student edits a confirmed date');
delete from public.academic_date_confirmations;  -- RLS: deletes nothing
select test.ok((select count(*) from public.academic_date_confirmations) = 4, 'student deletes confirmed dates');
update public.news set pinned = true;
select test.ok((select not pinned from public.news), 'student pins news');
delete from public.news;  -- RLS: deletes nothing
-- RLS turns a forbidden update into "0 rows".
update public.subjects set credits = 99 where code = 'AL';
select test.ok((select count(*) from public.subjects where credits = 99) = 0, 'student edits a subject');
select test.ok((select count(*) from public.offer_imports) = 0, 'student reads SIU imports');

select test.ok((select count(*) from public.offerings) = 2, 'student sees only visible offerings');
select test.ok((select count(*) from public.offering_blocks) = 1, 'student sees only schedules of visible offerings');
insert into public.user_courses values ('aaaaaaaa-0000-0000-0000-000000000001', 1);
select test.fails($$insert into public.user_courses values ('aaaaaaaa-0000-0000-0000-000000000001', 2)$$, 'student adds a hidden offering');
select test.fails($$insert into public.user_courses values ('aaaaaaaa-0000-0000-0000-000000000001', 3)$$, 'student adds an offering of another plan');

-- Semester plan (Opción A / B).
insert into public.plan_choices (user_id, option, offering_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 1), ('aaaaaaaa-0000-0000-0000-000000000001', 'B', 1);
select test.ok((select count(*) from public.plan_choices) = 2, 'student saves a course in both options');
select test.fails($$insert into public.plan_choices (user_id, option, offering_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 2)$$, 'student plans a hidden offering');
select test.fails($$insert into public.plan_choices (user_id, option, offering_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 3)$$, 'student plans an offering of another plan');
select test.fails($$insert into public.plan_choices (user_id, option, offering_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'C', 1)$$, 'student uses an option that is not A or B');
select test.fails($$insert into public.plan_choices (user_id, option, offering_id) values ('bbbbbbbb-0000-0000-0000-000000000002', 'A', 1)$$, 'student writes the plan of another student');
delete from public.plan_choices where option = 'B';
select test.ok((select count(*) from public.plan_choices) = 1, 'student removes a course from an option');

-- Exam reminders ("Recordarme" in Finales).
insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name, start_time, enroll_from, enroll_to)
values ('industrial-2023', 'CB002', 'MESA 01', 'Regular', '2026-12-09', 'Álgebra Lineal', '17:00', '2026-11-30 14:00', '2026-12-07 14:00');
select test.ok((select count(*) from public.exam_reminders) = 1, 'student creates an exam reminder');
select test.ok((select user_id from public.exam_reminders) = 'aaaaaaaa-0000-0000-0000-000000000001', 'the reminder is hers');
select test.fails($$insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name) values ('industrial-2023', 'CB002', 'MESA 01', 'Regular', '2026-12-09', 'Álgebra Lineal')$$, 'student repeats an exam reminder');
select test.fails($$insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name) values ('industrial-2023', 'CB002', 'MESA 02', 'Regular', '2026-12-09', 'Álgebra Lineal')$$, 'student creates a reminder for a table that does not exist');
select test.fails($$insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name) values ('civil-2023', 'CB002', 'MESA 01', 'Regular', '2026-12-09', 'Álgebra Lineal')$$, 'student creates a reminder for another plan');
select test.fails($$insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name, user_id) values ('industrial-2023', 'CB002', 'MESA 01', 'Regular', '2026-12-09', 'Álgebra Lineal', 'bbbbbbbb-0000-0000-0000-000000000002')$$, 'student creates a reminder for another student');
select test.fails($$insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name, first_sent_at) values ('industrial-2023', 'CB002', 'MESA 01', 'Regular', '2026-12-10', 'Álgebra Lineal', now())$$, 'student creates a reminder already sent');
select test.fails($$update public.exam_reminders set first_sent_at = now(), last_sent_at = now()$$, 'student marks a reminder as sent');
select test.fails($$update public.exam_reminders set exam_date = '2026-12-10'$$, 'student edits a reminder');
-- At most 50 per student.
reset role;
insert into public.exam_tables (plan_id, siu_subject_code, siu_subject_name, name, exam_date, kind)
select 'industrial-2023', 'CB002', 'ÁLGEBRA LINEAL', 'LIMITE ' || n, '2026-12-11', 'Regular' from generate_series(1, 50) n;
set role authenticated;
insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name) select 'industrial-2023', 'CB002', 'LIMITE ' || n, 'Regular', '2026-12-11', 'Álgebra Lineal' from generate_series(1, 49) n;
select test.ok((select count(*) from public.exam_reminders) = 50, 'student creates 50 exam reminders');
select test.fails($$insert into public.exam_reminders (plan_id, siu_subject_code, table_name, kind, exam_date, subject_name) values ('industrial-2023', 'CB002', 'LIMITE 50', 'Regular', '2026-12-11', 'Álgebra Lineal')$$, 'student creates more than 50 exam reminders');
delete from public.exam_reminders where table_name like 'LIMITE %';
select test.ok((select count(*) from public.exam_reminders) = 1, 'student deletes exam reminders');
reset role;
delete from public.exam_tables where name like 'LIMITE %';
set role authenticated;

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
select test.ok((select count(*) from public.user_extra_credits) = 0, 'another student does not see her extra credits');
delete from public.user_extra_credits;  -- RLS: deletes nothing of hers
select test.ok((select count(*) from public.user_courses) = 0, 'another student does not see her courses');
select test.ok((select count(*) from public.plan_choices) = 0, 'another student does not see her plan');
delete from public.plan_choices;  -- RLS: deletes nothing
select test.ok((select count(*) from public.exam_reminders) = 0, 'another student does not see her exam reminders');
delete from public.exam_reminders;  -- RLS: deletes nothing
select test.ok((select count(*) from public.my_reviews()) = 0, 'another student does not get her review in my_reviews');
select test.fails('select 1 from public.review_authors', 'admin reads review_authors');

update public.reviews set pinned = true, hidden_at = now();
select test.ok((select bool_and(pinned and hidden_at is not null) from public.reviews), 'admin pins and hides reviews');
select test.fails('update public.reviews set stars = 1', 'admin edits the stars of a review');
select test.fails($$update public.historical_reviews set stars = 1$$, 'admin edits the stars of a Dolly opinion');
update public.historical_reviews set hidden_at = now();
select test.ok((select count(*) from public.historical_reviews where hidden_at is not null) = 1, 'admin hides a Dolly opinion');
select test.ok((select count(*) from public.course_star_counts(array[1::bigint])) = 0, 'course scores leave out hidden reviews, also for admins');
select test.ok((select count(*) from public.admin_users()) >= 2, 'admin lists the users');
select test.ok((select email from public.admin_users() where email = 'ana@fi.uba.ar') is not null, 'admin sees the mails');
select test.ok((select reviews from public.admin_users() where email = 'ana@fi.uba.ar') >= 0, 'admin sees how many reviews (not which)');
select test.ok((select last_seen_at from public.admin_users() where email = 'ana@fi.uba.ar') is not null, 'admin sees when each student last used the app');
reset role;
insert into public.user_subjects values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AMII'), 'in_progress', null);
set role authenticated;
select test.ok((select subjects from public.admin_users() where email = 'ana@fi.uba.ar') = 1, 'admin counts only approved subjects');
reset role;
delete from public.user_subjects where status = 'in_progress' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
set role authenticated;
select test.ok((select count(*) from public.offerings) = 5, 'admin sees hidden offerings');
select test.ok((select count(*) from public.offering_blocks) = 2, 'admin sees schedules of hidden offerings');
insert into public.exam_tables (plan_id, siu_subject_code, siu_subject_name, name, exam_date, kind) values ('industrial-2023', 'CB001', 'ANÁLISIS MATEMÁTICO II', 'MESA 01', '2026-12-10', 'Regular');
insert into public.exam_imports (plan_id, stats) values ('industrial-2023', '{"tables": 2}');
delete from public.exam_tables where siu_subject_code = 'CB001';
select test.ok((select count(*) from public.exam_imports) = 1, 'admin manages exam imports');
insert into public.news (title, url) values ('Charla de ingresantes', 'https://www.ingenieria.uba.ar');
update public.news set pinned = true where title = 'Charla de ingresantes';
select test.ok((select count(*) from public.news where pinned) = 1, 'admin publishes and pins news');
select test.fails($$insert into public.news (title) values ('')$$, 'news with an empty title');
select test.fails($$insert into public.news (title) values (repeat('a', 141))$$, 'news title over 140 characters');
delete from public.news where title = 'Charla de ingresantes';
select test.ok((select count(*) from public.news) = 1, 'admin deletes news');
insert into public.academic_date_confirmations (calendar, title, starts_on, ends_on, note) values ('2026-2027', 'Charla de ingresantes', '2027-03-02', '2027-03-02', 'Mail de la Secretaría del 1/3');
select test.fails($$insert into public.academic_date_confirmations (calendar, title, starts_on, ends_on, note) values ('2026-2027', 'x', '2027-03-02', '2027-03-01', 'x')$$, 'confirmed date that ends before it starts');
select test.fails($$insert into public.academic_date_confirmations (calendar, title, starts_on, ends_on, note, replaces) select '2026-2027', 'x', '2026-11-17', '2026-11-18', 'x', replaces from public.academic_date_confirmations where replaces is not null limit 1$$, 'two confirmations of the same calendar date');
delete from public.academic_date_confirmations where title = 'Charla de ingresantes';
select test.ok((select count(*) from public.academic_date_confirmations) = 4, 'admin confirms and deletes dates');
insert into public.subjects (plan_id, code, name, kind, category) values ('industrial-2023', 'ZZ', 'Prueba', 'elective', 'Materias Electivas');
delete from public.subjects where code = 'ZZ';
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"ana@fi.uba.ar"}', false);
select test.ok((select count(*) from public.reviews) = 0, 'students do not see hidden reviews');
select test.ok((select bool_and(hidden) from public.my_reviews()), 'the author sees them as hidden');
select test.ok((select count(*) from public.exam_reminders) = 1, 'another student cannot delete her exam reminders');
reset role;

select test.ok((select count(*) from public.plan_choices) = 1, 'another student cannot delete her plan');

-- Offer sent by students (Plan without offer → paste the SIU text) ---------------------

update public.terms set is_current = true where id = '2026-1C';
insert into public.terms (id, year, half) values ('2026-2C', 2026, 2);
insert into auth.users values ('dddddddd-0000-0000-0000-000000000004', 'caro@fi.uba.ar');
insert into public.profiles (id, plan_id) values ('dddddddd-0000-0000-0000-000000000004', 'industrial-2023');

set role anon;
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', 'x')$$, 'anon sends an offer');
select test.fails('select 1 from public.offer_submissions limit 1', 'anon reads offer submissions');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000003","email":"otro@gmail.com"}', false);
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', 'x')$$, 'gmail account sends an offer');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"ana@fi.uba.ar"}', false);
insert into public.offer_submissions (term_id, plan_id, raw_text, subjects, courses, blocks) values ('2026-1C', 'industrial-2023', 'Actividad: ...', 34, 120, 300);
select test.ok((select count(*) from public.offer_submissions) = 1, 'student sends the offer of her plan');
select test.ok((select status = 'pending' and submitted_by = 'aaaaaaaa-0000-0000-0000-000000000001' from public.offer_submissions), 'the submission is pending and hers');
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'civil-2023', 'x')$$, 'student sends the offer of another plan');
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-2C', 'industrial-2023', 'x')$$, 'student sends the offer of a term that is not the current one');
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text, status) values ('2026-1C', 'industrial-2023', 'x', 'published')$$, 'student sends an offer already published');
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text, submitted_by) values ('2026-1C', 'industrial-2023', 'x', 'dddddddd-0000-0000-0000-000000000004')$$, 'student sends an offer in the name of another');
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', repeat('a', 400001))$$, 'offer text over the size limit');
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', '')$$, 'empty offer text');
update public.offer_submissions set status = 'published';
select test.ok((select status from public.offer_submissions) = 'pending', 'student publishes her own submission');
select test.fails('delete from public.offer_submissions', 'student deletes a submission');
select test.fails('select * from public.admin_offer_submissions()', 'student lists the submissions');
select test.fails($$insert into public.offerings (term_id, plan_id, course_id, siu_subject_code, siu_subject_name, label) values ('2026-1C', 'industrial-2023', 1, 'CB002', 'x', 'x')$$, 'student publishes the offer directly');
insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', 'otra');
insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', 'otra más');
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', 'una cuarta')$$, 'more than 3 pending submissions');
reset role;

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004","email":"caro@fi.uba.ar"}', false);
select test.ok((select count(*) from public.offer_submissions) = 0, 'another student does not see her submissions');
update public.offer_submissions set status = 'rejected';
reset role;
select test.ok((select count(*) from public.offer_submissions where status = 'pending') = 3, 'another student cannot reject submissions');
insert into public.offer_imports (term_id, plan_id, status, raw_text) values ('2026-1C', 'industrial-2023', 'published', 'x');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000004","email":"caro@fi.uba.ar"}', false);
select test.fails($$insert into public.offer_submissions (term_id, plan_id, raw_text) values ('2026-1C', 'industrial-2023', 'x')$$, 'student sends an offer for a plan that already has one');
reset role;
delete from public.offer_imports where term_id = '2026-1C' and plan_id = 'industrial-2023';

set role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","email":"beto@fi.uba.ar"}', false);
select test.ok((select count(*) from public.offer_submissions) = 3, 'admin reads every submission');
select test.ok((select count(*) from public.admin_offer_submissions() where email = 'ana@fi.uba.ar') = 3, 'admin lists the pending submissions with who sent them');
update public.offer_submissions set status = 'rejected', reviewed_at = now(), reviewed_by = 'bbbbbbbb-0000-0000-0000-000000000002'
where id = (select min(id) from public.offer_submissions);
select test.ok((select count(*) from public.admin_offer_submissions()) = 2, 'admin rejects a submission');
select test.fails($$update public.offer_submissions set raw_text = 'x'$$, 'admin edits the text of a submission');
reset role;

update public.terms set is_current = false where id = '2026-1C';

-- Changing career or plan: subjects and the semester plan go, cursadas and reviews stay ------

set role anon;
select test.fails($$select public.change_my_plan('civil-2023')$$, 'anon changes a plan');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","email":"ana@fi.uba.ar"}', false);
select test.fails($$select public.change_my_plan('no-existe')$$, 'student changes to a plan that does not exist');
create temp table ana_reviews as select count(*) as n from public.my_reviews();
select public.change_my_plan('industrial-2023');  -- same plan: nothing changes
select test.ok((select count(*) from public.user_subjects) = 1, 'same plan keeps the subjects');
select public.change_my_plan('civil-2023');
select test.ok((select plan_id from public.profiles) = 'civil-2023', 'student changes plan');
select test.ok((select count(*) from public.user_subjects) = 0, 'changing plan deletes the subjects');
select test.ok((select count(*) from public.user_requirements) = 0, 'changing plan deletes the requirements');
select test.ok((select count(*) from public.plan_choices) = 0, 'changing plan deletes the semester plan');
select test.ok((select count(*) from public.user_courses) = 1, 'changing plan keeps the cursadas');
select test.ok((select count(*) from public.my_reviews()) = (select n from ana_reviews) and (select n from ana_reviews) > 0, 'changing plan keeps the reviews');
-- Back to Industrial, with a subject and a plan choice, for the checks below.
select public.change_my_plan('industrial-2023');
insert into public.user_subjects (user_id, subject_id, status, grade)
values ('aaaaaaaa-0000-0000-0000-000000000001', (select id from public.subjects where plan_id = 'industrial-2023' and code = 'AL'), 'approved', 9);
insert into public.plan_choices (user_id, option, offering_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', 1);
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
select test.ok((select count(*) from public.plan_choices) = 0, 'the plan is deleted with the account');
select test.ok((select count(*) from public.exam_reminders) = 0, 'exam reminders are deleted with the account');

\echo 'All security checks passed.'
