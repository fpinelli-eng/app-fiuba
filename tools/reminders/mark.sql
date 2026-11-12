-- After send.mjs: marks the mails that went out and deletes the reminders whose exam already
-- happened. psql -v payload='[{"id":1,"which":"first"},…]' (only ids, never mails).
-- Only the opening mail ("first") exists; last_sent_at is left as it is (first version).

begin;

create temp table reminder_sent on commit drop as
select x.id, x.which
from jsonb_to_recordset(:'payload'::jsonb) as x(id bigint, which text)
where x.which = 'first';

update public.exam_reminders r
set first_sent_at = coalesce(r.first_sent_at, now())
from reminder_sent s
where r.id = s.id;

delete from public.exam_reminders
where exam_date < (now() at time zone 'America/Argentina/Buenos_Aires')::date;

commit;
