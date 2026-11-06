-- =====================================================================
-- Luka — de dónde llega cada familia (campañas, redes, referidos) y conteos anónimos de visitas
-- Ejecutar después de 011_cuota_mes.sql
-- =====================================================================

-- Fuente con la que se registró quien creó la familia: { source, campaign }
alter table families add column if not exists acquisition jsonb;

-- Conteos diarios anónimos por fuente (sin datos personales): visitas a la portada y descargas de la plantilla
create table if not exists landing_stats (
  day    date not null default (now() at time zone 'America/Bogota')::date,
  source text not null,
  kind   text not null check (kind in ('visita', 'plantilla')),
  count  integer not null default 0,
  primary key (day, source, kind)
);
alter table landing_stats enable row level security; -- sin políticas: solo el servidor

create or replace function bump_landing_stat(src text, k text) returns void
language sql security definer set search_path = public as $$
  insert into landing_stats (source, kind, count) values (left(src, 40), k, 1)
  on conflict (day, source, kind) do update set count = landing_stats.count + 1
$$;
revoke execute on function bump_landing_stat(text, text) from public, anon, authenticated;
