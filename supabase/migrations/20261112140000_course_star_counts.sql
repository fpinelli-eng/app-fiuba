-- Course scores mix the app's reviews with the historical Dolly opinions (decided on 11 November
-- 2026): the Reseñas search, the course page and the Plan show one score per course. This replaces
-- the note in 20261108120000_historical_reviews.sql that Dolly opinions do not count for the score
-- (they still do not count for pending reviews).
--
-- There are thousands of Dolly opinions and the API returns at most 1000 rows per request, so the
-- app asks for the counts instead of every row: one row per course, with how many reviews gave it
-- 1, 2, 3, 4 and 5 stars, for each source (position 1 of the array = 1 star).
--
-- security invoker: the row policies of reviews and historical_reviews still apply (only members
-- read). Hidden ones are left out always, also for admins, like on every student screen.

create function public.course_star_counts(course_ids bigint[])
returns table (course_id bigint, app integer[], dolly integer[])
language sql
stable
security invoker
set search_path = ''
as $$
  select
    x.course_id,
    array[
      count(*) filter (where x.source = 'app' and x.stars = 1),
      count(*) filter (where x.source = 'app' and x.stars = 2),
      count(*) filter (where x.source = 'app' and x.stars = 3),
      count(*) filter (where x.source = 'app' and x.stars = 4),
      count(*) filter (where x.source = 'app' and x.stars = 5)
    ]::integer[],
    array[
      count(*) filter (where x.source = 'dolly' and x.stars = 1),
      count(*) filter (where x.source = 'dolly' and x.stars = 2),
      count(*) filter (where x.source = 'dolly' and x.stars = 3),
      count(*) filter (where x.source = 'dolly' and x.stars = 4),
      count(*) filter (where x.source = 'dolly' and x.stars = 5)
    ]::integer[]
  from (
    select r.course_id, 'app' as source, r.stars
    from public.reviews r
    where r.course_id = any (course_ids) and r.hidden_at is null
    union all
    select h.course_id, 'dolly', h.stars
    from public.historical_reviews h
    where h.course_id = any (course_ids) and h.hidden_at is null
  ) x
  group by x.course_id;
$$;

revoke execute on function public.course_star_counts(bigint[]) from public;
grant execute on function public.course_star_counts(bigint[]) to authenticated;
