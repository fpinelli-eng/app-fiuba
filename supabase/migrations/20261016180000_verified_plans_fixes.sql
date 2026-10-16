-- Fixes after checking the beta plans against the official resolutions (16 October 2026).
-- The seed comes from FIUBA Map (data/planes); these are the differences found.
--
--   Industrial 2023:  RESCS-2023-1216, texto ordenado RCS-2024-63. No differences.
--   Informática 2023: RESCS-2023-1215.
--   Química 2023:     RESCS-2023-1927.
--
-- Each fix checks that it touched exactly what it expected, so a code that does not
-- match stops the migration instead of doing nothing.

do $$
declare
  n bigint;
begin
  -- Química 2023: the elective is "Conocimiento de Materiales Metálicos" (also its SIU name, TB099).
  update public.subjects set name = 'Conocimiento de Materiales Metálicos'
  where plan_id = 'quimica-2023' and code = 'CM1';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'plan fix "quimica CM1 name": expected 1, got %', n; end if;

  -- Química 2023: Microbiología Industrial also needs Ingeniería de Bioprocesos.
  insert into public.subject_prerequisites (subject_id, prerequisite_id)
  select s.id, p.id
  from public.subjects s
  join public.subjects p on p.plan_id = s.plan_id and p.code = 'IBP'
  where s.plan_id = 'quimica-2023' and s.code = 'MI'
  on conflict do nothing;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'plan fix "quimica MI needs IBP": expected 1, got %', n; end if;

  -- Química 2023: Emisiones de Contaminantes and Legislación are in the 11th term (map column 9).
  update public.subjects set level = 9
  where plan_id = 'quimica-2023' and code in ('ECQB', 'LEP');
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'plan fix "quimica ECQB and LEP in term 9": expected 2, got %', n; end if;

  -- Informática 2023: Empresas de Base Tecnológica II is in the 10th term (map column 8).
  update public.subjects set level = 8
  where plan_id = 'informatica-2023' and code = 'EBTII';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'plan fix "informatica EBTII in term 8": expected 1, got %', n; end if;
end;
$$;
