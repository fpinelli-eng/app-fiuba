-- Free reviews (decided on 16 October): any student can review any course, whether they
-- took it or not, from the course page. Pending reviews stay as they are: they ask for
-- the courses of the student's last term and unlock the next plan.
--
-- One review per student and course (not per term): reviewing again edits it, also
-- across both paths. A pending course that was already reviewed counts as done.
-- Bad reviews are handled by admin moderation (hidden_at).

-- Enforce one review per student and course. The old (author, course, term) rule stays.
create unique index review_authors_one_per_course on public.review_authors (author_id, course_id);

-- Pending reviews: same checks as before, but an existing review of the course
-- (from any term or from a free review) is edited instead of adding another one.
create or replace function public.submit_review(p_offering_id bigint, p_stars smallint, p_comment text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_course_id bigint;
  v_term_id text;
  v_opens date;
  v_comment text := nullif(btrim(p_comment), '');
  v_review_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select o.course_id, o.term_id, t.reviews_open_on
    into v_course_id, v_term_id, v_opens
  from public.user_courses uc
  join public.offerings o on o.id = uc.offering_id
  join public.terms t on t.id = o.term_id
  where uc.user_id = v_uid and uc.offering_id = p_offering_id;

  if v_course_id is null then
    raise exception 'you did not take this course' using errcode = '42501';
  end if;
  if v_opens is null or v_opens > current_date then
    raise exception 'reviews for this term are not open yet' using errcode = '42501';
  end if;

  select ra.review_id into v_review_id
  from public.review_authors ra
  where ra.author_id = v_uid and ra.course_id = v_course_id;

  if v_review_id is null then
    insert into public.reviews (course_id, term_id, stars, comment)
    values (v_course_id, v_term_id, p_stars, v_comment)
    returning id into v_review_id;

    insert into public.review_authors (review_id, author_id, course_id, term_id)
    values (v_review_id, v_uid, v_course_id, v_term_id);
  else
    update public.reviews
    set stars = p_stars, comment = v_comment
    where id = v_review_id;
  end if;

  return v_review_id;
end;
$$;

-- Free review of a course from its page. The course must have a visible offering (a
-- course an admin removed cannot be reviewed). A new review is filed under the term of
-- the course's latest visible offering, which is the term shown next to its comment.
create function public.review_course(p_course_id bigint, p_stars smallint, p_comment text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_term_id text;
  v_comment text := nullif(btrim(p_comment), '');
  v_review_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  -- A Google session is not enough: it takes a FIUBA account (a profile).
  if not public.is_member() then
    raise exception 'not a member' using errcode = '42501';
  end if;

  select o.term_id into v_term_id
  from public.offerings o
  where o.course_id = p_course_id and o.visible
  order by o.term_id desc
  limit 1;

  if v_term_id is null then
    raise exception 'course not found' using errcode = '42501';
  end if;

  select ra.review_id into v_review_id
  from public.review_authors ra
  where ra.author_id = v_uid and ra.course_id = p_course_id;

  if v_review_id is null then
    insert into public.reviews (course_id, term_id, stars, comment)
    values (p_course_id, v_term_id, p_stars, v_comment)
    returning id into v_review_id;

    insert into public.review_authors (review_id, author_id, course_id, term_id)
    values (v_review_id, v_uid, p_course_id, v_term_id);
  else
    update public.reviews
    set stars = p_stars, comment = v_comment
    where id = v_review_id;
  end if;

  return v_review_id;
end;
$$;

revoke execute on function public.review_course(bigint, smallint, text) from public;
grant execute on function public.review_course(bigint, smallint, text) to authenticated;
