-- Historical opinions from Dolly FIUBA (github.com/lugfi/dolly, GPL-3.0, by LUGFi): surveys about
-- teachers from 2015 to 2024. They are loaded by the manual workflow "Reseñas de Dolly"
-- (tools/reviews-dolly), only for current courses whose teacher matches the surveyed one.
--
-- Kept apart from public.reviews on purpose: they are not the app's reviews, they do not count for
-- pending reviews nor for the course score, and they can be removed all at once
-- (delete ... where source = 'dolly').
--
-- Members read. Nobody writes from the app: the workflow connects as the database owner. Admins can
-- hide one (hidden_at), like a regular review.

create table public.historical_reviews (
  id bigint generated always as identity primary key,
  source text not null default 'dolly' check (source in ('dolly')),
  course_id bigint not null references public.courses (id) on delete cascade,
  teacher text not null check (char_length(teacher) between 1 and 120), -- as written in the survey
  term_label text not null check (char_length(term_label) between 1 and 20), -- '1C 2018'
  year smallint not null check (year between 2000 and 2100),
  stars smallint not null check (stars between 1 and 5), -- average of the survey's scores, rounded
  comment text check (char_length(comment) between 1 and 500),
  hidden_at timestamptz,
  loaded_at timestamptz not null default now()
);

create index historical_reviews_course_idx on public.historical_reviews (course_id);

alter table public.historical_reviews enable row level security;
grant select on public.historical_reviews to authenticated;
grant update (hidden_at) on public.historical_reviews to authenticated;
create policy "Members read historical reviews" on public.historical_reviews
  for select to authenticated using ((select public.is_member()) and (hidden_at is null or (select public.is_admin())));
create policy "Admins hide historical reviews" on public.historical_reviews
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
