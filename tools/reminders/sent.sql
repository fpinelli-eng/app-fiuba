-- Marks as sent the reminders whose email went out: psql -v ids="[1,2,3]" (JSON from send.mjs).
update public.reminders set sent_at = now()
where sent_at is null and id in (select jsonb_array_elements_text(:'ids'::jsonb)::bigint);
