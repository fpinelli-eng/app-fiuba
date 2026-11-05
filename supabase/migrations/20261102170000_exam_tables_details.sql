-- The "Ver" details of each exam table, which the SIU page has when the admin pastes its link
-- (the copied text does not bring them). All optional: the SIU often shows "-".
-- Times are Buenos Aires time, as the SIU shows them. RLS and grants of exam_tables cover them.

alter table public.exam_tables
  add column start_time time,          -- '17:00'
  add column end_time time,
  add column room text,
  add column drop_until timestamp,     -- last moment to drop out
  add column teachers text;            -- 'SURACE PABLO ESTEBAN (Profesor/a), …'
