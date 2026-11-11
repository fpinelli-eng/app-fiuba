-- Prints the exam tables now in the database as one JSON array, for sync.mjs --current to compare
-- with the SIU. Run with psql -At (one line, no headers). Dates and times in the parser's formats.
select coalesce(json_agg(json_build_object(
  'plan_id', plan_id,
  'siu_subject_code', siu_subject_code,
  'siu_subject_name', siu_subject_name,
  'name', name,
  'exam_date', to_char(exam_date, 'YYYY-MM-DD'),
  'kind', kind,
  'enroll_from', to_char(enroll_from, 'YYYY-MM-DD"T"HH24:MI'),
  'enroll_to', to_char(enroll_to, 'YYYY-MM-DD"T"HH24:MI'),
  'start_time', to_char(start_time, 'HH24:MI'),
  'end_time', to_char(end_time, 'HH24:MI'),
  'room', room,
  'drop_until', to_char(drop_until, 'YYYY-MM-DD"T"HH24:MI'),
  'teachers', teachers
) order by id), '[]'::json)
from public.exam_tables;
