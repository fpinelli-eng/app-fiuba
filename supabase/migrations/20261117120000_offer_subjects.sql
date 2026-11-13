-- Electives added from the offer: subjects that the SIU offers to a plan but the plan JSON
-- (data/planes, FIUBA Map) does not list, usually new electives.
--
-- An admin adds them from Administración ("Materias que no están en el plan" → "Agregar al plan"):
-- the app inserts the subjects row (kind 'elective', name from the SIU, credits chosen by the
-- admin) and its subject_siu_codes link, with the admin policies of the catalog (RLS: only
-- admins write subjects). From then on the offer import matches them like any plan subject, so
-- their courses reach the Plan del cuatrimestre and they show in the Mapa among the electives.
-- The seed migrations do not change: these are rows of the database only.
--
-- * subjects.added_from_offer: marks them, so the admin screen lists them and can undo.
-- * remove_offer_subject(): the undo. Deleting a subject cascades to the students' rows
--   (user_subjects), which an admin cannot see (RLS), so the check runs here: it only removes a
--   subject added from the offer that no student marked yet.

alter table public.subjects
  add column added_from_offer boolean not null default false;

create function public.remove_offer_subject(p_subject_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins remove subjects' using errcode = '42501';
  end if;
  if not exists (select 1 from public.subjects s where s.id = p_subject_id and s.added_from_offer) then
    raise exception 'not a subject added from the offer' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.user_subjects u where u.subject_id = p_subject_id) then
    raise exception 'students already use this subject' using errcode = 'P0003';
  end if;
  delete from public.subjects s where s.id = p_subject_id;
end;
$$;

revoke execute on function public.remove_offer_subject(bigint) from public, anon;
grant execute on function public.remove_offer_subject(bigint) to authenticated;
