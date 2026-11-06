-- FIUBA news shown in Novedades, copied from the featured news of www.fi.uba.ar by the scheduled
-- workflow "Noticias de la FIUBA" (tools/news/sync.mjs). Only the title, the lead, the cover image
-- and the link: the article itself stays on fi.uba.ar (the site is Creative Commons Attribution;
-- the app always shows the source and links to it).
--
-- Members read. Nobody writes from the app: the workflow connects as the database owner.

create table public.fiuba_news (
  id integer primary key,                 -- FIUBA's own id
  title text not null check (char_length(title) between 1 and 300),
  summary text check (char_length(summary) <= 2000),
  url text not null check (url like 'https://www.fi.uba.ar/noticias/%'),
  image_url text check (image_url like 'https://cms.fi.uba.ar/%'),
  published_at timestamptz not null,
  fetched_at timestamptz not null default now()
);

create index fiuba_news_published on public.fiuba_news (published_at desc);

alter table public.fiuba_news enable row level security;
grant select on public.fiuba_news to authenticated;
create policy "Members read FIUBA news" on public.fiuba_news
  for select to authenticated using ((select public.is_member()));
