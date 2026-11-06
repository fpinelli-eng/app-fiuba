-- Run by the workflow with psql -v payload="<json from sync.mjs>". The JSON goes in as one quoted
-- literal (:'payload'), so nothing in it can break out of the statement.
insert into public.fiuba_news (id, title, summary, url, image_url, published_at)
select id, title, summary, url, "imageUrl", "publishedAt"
from jsonb_to_recordset(:'payload'::jsonb)
  as x(id integer, title text, summary text, url text, "imageUrl" text, "publishedAt" timestamptz)
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  url = excluded.url,
  image_url = excluded.image_url,
  published_at = excluded.published_at,
  fetched_at = now();

-- Only the 12 newest stay: when the FIUBA publishes a new one, the oldest goes away.
delete from public.fiuba_news
where id not in (select id from public.fiuba_news order by published_at desc, id desc limit 12);
