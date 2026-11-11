-- "Relevamiento de usuarios" (.github/workflows/stats.yml): only counts, never mails or names.
-- Only global totals: the repo is public and so is the run summary. With few users a breakdown
-- by career or by day could point to a person; admins see the details in /admin/usuarios.
-- Output is a Markdown table that the workflow puts in the job summary.
\pset format unaligned
\pset tuples_only on
\pset fieldsep '|'

select '| Dato | Cantidad |';
select '|---|---|';
select '| Usuarios en total | ' || count(*) || ' |' from public.profiles;
select '| Nuevos en las últimas 24 h | ' || count(*) || ' |' from public.profiles where created_at > now() - interval '24 hours';
select '| Nuevos en los últimos 7 días | ' || count(*) || ' |' from public.profiles where created_at > now() - interval '7 days';
select '| Sin carrera elegida todavía | ' || count(*) || ' |' from public.profiles where plan_id is null;
select '| Vieron las historias | ' || count(*) || ' |' from public.profiles where intro_seen_at is not null;
select '| Cargaron al menos una materia | ' || count(distinct user_id) || ' |' from public.user_subjects;
select '| Armaron algo en el Plan | ' || count(distinct user_id) || ' |' from public.plan_choices;
select '| Reseñas escritas | ' || count(*) || ' |' from public.reviews where hidden_at is null;
