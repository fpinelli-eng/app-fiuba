-- Incident history and latency of the health monitor, for Administración → Estado.
--
-- The Apps Script monitor (tools/reminders/apps-script/Salud.gs) runs every hour. Until now it
-- only mailed when something broke; what happened (when the database went down, for how long, how
-- slow it was) was lost. Now, after salud(), it calls salud_registrar() once per run:
--
-- * latency: the last 72 hourly samples ({at, ms}: how long the slowest database call of that run
--   took) in one jsonb column of monitor_state. One small update per hour, no new rows.
-- * monitor_incidents: one row per problem (database down, database slow, site down, other check),
--   written only when it starts, gets worse (max_ms) or ends. While the database does not answer
--   the script can't write: it keeps the start in its Script Properties and sends the incident with
--   its real start and end once the database answers again. Idempotent: (kind, title, started_at)
--   identifies an incident, so sending it twice only updates it.
--
-- Only kinds, fixed titles, short details (times and HTTP codes, never data of a student) and dates.
-- Nobody reads the table from the API: admins through admin_monitor(), the script through
-- salud_registrar() with the same token as salud() (avisos_check_token()).

alter table public.monitor_state add column latency jsonb not null default '[]'::jsonb
  check (jsonb_typeof(latency) = 'array');

create table public.monitor_incidents (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('db_down', 'db_slow', 'site_down', 'other')),
  title text not null check (char_length(title) between 1 and 120),
  detail text check (char_length(detail) <= 300),
  started_at timestamptz not null,
  ended_at timestamptz check (ended_at >= started_at),
  max_ms integer check (max_ms >= 0),
  unique (kind, title, started_at)
);

create index monitor_incidents_started_at on public.monitor_incidents (started_at desc);

alter table public.monitor_incidents enable row level security;
-- No grants and no policies: only the database owner (and the security definer functions) read it.

-- For the Apps Script (role anon, with its token). p_ms: this run's latency sample (null: none).
-- p_incidents: the incidents that started, changed or ended since the last call, as
-- [{kind, title, detail, started_at, ended_at, max_ms}]. Returns how many incidents it wrote.
create function public.salud_registrar(p_token text, p_ms integer, p_incidents jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_item jsonb;
  v_started timestamptz;
  v_ended timestamptz;
  v_max integer;
begin
  perform public.avisos_check_token(p_token);

  if p_ms is not null then
    if p_ms < 0 or p_ms > 600000 then
      raise exception 'invalid latency' using errcode = '22023';
    end if;
    insert into public.monitor_state (id, last_health_check_at, latency)
    values (true, now(), jsonb_build_array(jsonb_build_object('at', now(), 'ms', p_ms)))
    on conflict (id) do update set latency = (
      -- Append and keep the newest 72 (three days of hourly runs).
      select coalesce(jsonb_agg(s.e order by s.n), '[]'::jsonb)
      from (
        select t.e, t.n
        from jsonb_array_elements(public.monitor_state.latency || excluded.latency) with ordinality as t(e, n)
        order by t.n desc
        limit 72
      ) s
    );
  end if;

  if p_incidents is null or jsonb_typeof(p_incidents) <> 'array' then
    return 0;
  end if;
  if jsonb_array_length(p_incidents) > 20 then
    raise exception 'too many incidents' using errcode = '22023';
  end if;

  for v_item in select e from jsonb_array_elements(p_incidents) as t(e) loop
    v_started := (v_item ->> 'started_at')::timestamptz;
    v_ended := (v_item ->> 'ended_at')::timestamptz;
    v_max := (v_item ->> 'max_ms')::integer;
    -- Dates of the script's clock: a few minutes ahead of the database are tolerated.
    if v_started is null or v_started > now() + interval '10 minutes' or v_ended > now() + interval '10 minutes' then
      raise exception 'invalid incident dates' using errcode = '22023';
    end if;
    insert into public.monitor_incidents (kind, title, detail, started_at, ended_at, max_ms)
    values (v_item ->> 'kind', left(v_item ->> 'title', 120), left(v_item ->> 'detail', 300), v_started, v_ended, v_max)
    on conflict (kind, title, started_at) do update set
      detail = coalesce(excluded.detail, public.monitor_incidents.detail),
      ended_at = excluded.ended_at,
      max_ms = greatest(public.monitor_incidents.max_ms, excluded.max_ms);
    v_count := v_count + 1;
  end loop;

  -- Only written when something happened: also the moment to forget incidents older than a year.
  if v_count > 0 then
    delete from public.monitor_incidents where started_at < now() - interval '365 days';
  end if;
  return v_count;
end;
$$;

-- For Administración → Estado: the latency samples and the incidents of the last 30 days (plus any
-- still open), newest first. Writes nothing.
create function public.admin_monitor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'only admins' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'checked_at', now(),
    'latency', coalesce((select m.latency from public.monitor_state m), '[]'::jsonb),
    'incidents', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', i.id, 'kind', i.kind, 'title', i.title, 'detail', i.detail,
          'started_at', i.started_at, 'ended_at', i.ended_at, 'max_ms', i.max_ms)
        order by i.started_at desc)
      from (
        select * from public.monitor_incidents
        where ended_at is null or ended_at >= now() - interval '30 days' or started_at >= now() - interval '30 days'
        order by started_at desc
        limit 200
      ) i
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on public.monitor_incidents from public, anon, authenticated;
revoke execute on function public.salud_registrar(text, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_monitor() from public, anon, authenticated;
grant execute on function public.salud_registrar(text, integer, jsonb) to anon;
grant execute on function public.admin_monitor() to authenticated;
