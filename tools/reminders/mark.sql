-- After send.mjs: marks the mails that went out and deletes the reminders whose exam already
-- happened. psql -v payload='[{"id":1,"which":"first"},…]' (only ids, never mails).
-- A "last" mail also counts as the first one (short windows send only the last).

begin;

create temp table reminder_sent on commit drop as
select x.id, x.which
from jsonb_to_recordset(:'payload'::jsonb) as x(id bigint, which text)
where x.which in ('first', 'last');

update public.exam_reminders r
set first_sent_at = coalesce(r.first_sent_at, now()),
    last_sent_at = case when s.which = 'last' then now() else r.last_sent_at end
from reminder_sent s
where r.id = s.id;

delete from public.exam_reminders
where exam_date < (now() at time zone 'America/Argentina/Buenos_Aires')::date;

commit;
