-- Mapa: "Aprobada por equivalencia". Al cambiarse de carrera, el SIU da la materia por aprobada
-- y suma sus créditos, pero sin nota: no cuenta para el promedio.
--
-- Una materia aprobada tiene nota o es por equivalencia (nunca las dos); las otras, ninguna.
-- Permisos: user_subjects ya da insert/update de la tabla entera a authenticated, con políticas
-- que limitan a las filas propias y a materias del plan; la columna nueva queda cubierta igual.

alter table public.user_subjects add column by_equivalence boolean not null default false;

-- Reemplaza el check del esquema inicial: ((status = 'approved') = (grade is not null)).
alter table public.user_subjects drop constraint user_subjects_check;
alter table public.user_subjects add constraint user_subjects_grade_or_equivalence check (
  case
    when status = 'approved' then (grade is not null) <> by_equivalence
    else grade is null and not by_equivalence
  end
);

comment on column public.user_subjects.by_equivalence is
  'Aprobada por equivalencia: suma créditos y destraba correlativas, pero no tiene nota ni cuenta para el promedio.';
