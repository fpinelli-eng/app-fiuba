-- Quita el historial de caídas y la latencia de Administración → Estado (20261121120000_incidentes.sql):
-- no era lo que se necesitaba. Lo que se quiere ver son las métricas de Supabase (memoria, swap, CPU),
-- que se resolverá aparte. El monitor de la planilla vuelve a la versión anterior (Salud.gs).

drop function if exists public.admin_monitor();
drop function if exists public.salud_registrar(text, integer, jsonb);
drop table if exists public.monitor_incidents;
alter table public.monitor_state drop column if exists latency;
