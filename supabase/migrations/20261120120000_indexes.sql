-- Indexes for the queries that were still missing one (19/11/2026, after the database ran out of
-- memory). Almost every hot query already had its index: offerings (plan_id, term_id) and
-- (course_id), offering_blocks (offering_id), exam_tables (plan_id, exam_date), subjects
-- (plan_id), subject_areas and plan_requirements (unique (plan_id, name)), user_subjects,
-- user_courses and plan_choices (primary keys starting with user_id), review_authors
-- (author_id, course_id) and usage_slots (slot). Only additions: nothing changes for code that
-- does not know about them, and `if not exists` makes the migration safe to run twice.

-- course_star_counts() (Reseñas search, course page and Plan) counts the Dolly opinions of each
-- course by stars, without hidden ones. There are thousands of rows: with this index the counts
-- come from the index alone instead of visiting every row of the table.
create index if not exists historical_reviews_course_stars_idx
  on public.historical_reviews (course_id, stars)
  where hidden_at is null;

-- Same for the app's own reviews.
create index if not exists reviews_course_stars_idx
  on public.reviews (course_id, stars)
  where hidden_at is null;

-- Publishing an offer looks up the earlier offerings of the same SIU subjects (any term and plan)
-- to keep each course and its reviews: offerings filtered by siu_subject_code alone.
create index if not exists offerings_siu_subject_code_idx
  on public.offerings (siu_subject_code);
