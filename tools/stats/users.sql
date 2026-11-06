-- "Relevamiento de usuarios" (.github/workflows/stats.yml): only counts, never mails or names.
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

select '';
select '| Carrera y plan | Usuarios | Nuevos 7 días |';
select '|---|---|---|';
select '| ' || coalesce(c.name || ' ' || pl.year, 'Sin elegir') || ' | ' || count(*) || ' | '
       || count(*) filter (where p.created_at > now() - interval '7 days') || ' |'
from public.profiles p
left join public.plans pl on pl.id = p.plan_id
left join public.careers c on c.id = pl.career_id
group by c.name, pl.year
order by count(*) desc;

select '';
select '| Día | Altas |';
select '|---|---|';
select '| ' || to_char(d, 'DD/MM') || ' | ' || count(p.id) || ' |'
from generate_series((now() at time zone 'America/Argentina/Buenos_Aires')::date - 13,
                     (now() at time zone 'America/Argentina/Buenos_Aires')::date, interval '1 day') d
left join public.profiles p on (p.created_at at time zone 'America/Argentina/Buenos_Aires')::date = d::date
group by d
order by d desc;
