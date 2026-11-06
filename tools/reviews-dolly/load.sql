-- Included by the SQL that build.mjs writes, after it sets 'dolly.payload' to
-- { targets: [{ old, plan, code }], rows: [{ i, old, teacher, key, term, year, stars, comment }] }.
-- Replaces every Dolly opinion in one transaction (running it again gives the same result).
--
-- A survey goes to a course when, among the courses of the current term of the plan subjects its
-- old subject maps to, exactly ONE has a teacher whose name contains every word of the surveyed
-- teacher's name ("Pérez" or "Juan Pérez" → "PEREZ JUAN"). No match or more than one: left out.

begin;

create temp table dolly_targets on commit drop as
select * from jsonb_to_recordset(current_setting('dolly.payload')::jsonb -> 'targets')
  as x(old text, plan text, code text);

create temp table dolly_rows on commit drop as
select * from jsonb_to_recordset(current_setting('dolly.payload')::jsonb -> 'rows')
  as x(i integer, old text, teacher text, key text[], term text, year smallint, stars smallint, comment text);

-- Courses of the current term for each old subject, with the words of each teacher's name.
create temp table dolly_courses on commit drop as
select distinct t.old, o.course_id,
  regexp_split_to_array(
    upper(translate(teacher ->> 'nombre', 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z]+'
  ) as words
from dolly_targets t
join public.subjects s on s.plan_id = t.plan and s.code = t.code
join public.offerings o on o.plan_id = t.plan and o.visible
join public.terms term on term.id = o.term_id and term.is_current
cross join lateral jsonb_array_elements(o.teachers) teacher
where o.siu_subject_code in (select sc.siu_code from public.subject_siu_codes sc where sc.subject_id = s.id)
   or upper(translate(o.siu_subject_name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))
    = upper(translate(s.name, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'));

create temp table dolly_matches on commit drop as
select r.i, min(c.course_id) as course_id
from dolly_rows r
join dolly_courses c on c.old = r.old and r.key <@ c.words
group by r.i
having count(distinct c.course_id) = 1;

delete from public.historical_reviews where source = 'dolly';

insert into public.historical_reviews (source, course_id, teacher, term_label, year, stars, comment)
select 'dolly', m.course_id, r.teacher, r.term, r.year, r.stars, r.comment
from dolly_rows r
join dolly_matches m using (i);

select
  (select count(*) from dolly_rows) as encuestas,
  (select count(*) from public.historical_reviews where source = 'dolly') as cargadas,
  (select count(*) from public.historical_reviews where source = 'dolly' and comment is not null) as con_comentario,
  (select count(distinct course_id) from public.historical_reviews where source = 'dolly') as cursos;

commit;
