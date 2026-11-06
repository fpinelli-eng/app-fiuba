-- Welcome stories (src/components/WelcomeStories.tsx): shown the first time a student enters the
-- app, until they finish or skip them. Each student marks only their own row (existing RLS policy
-- "Students update their profile"), and only this column.

alter table public.profiles add column intro_seen_at timestamptz;

grant update (intro_seen_at) on public.profiles to authenticated;
