-- =====================================================================
-- Luka — alertas de presupuesto (una por nivel y por mes) e importación desde Excel
-- Ejecutar después de 008_whatsapp.sql (Supabase → SQL Editor → Run)
-- =====================================================================

-- Porcentaje del presupuesto en el que se avisa (además del aviso al 100 %)
alter table families add column if not exists alert_threshold smallint not null default 80
  check (alert_threshold between 50 and 95);

-- Alertas ya enviadas: cada categoría avisa una sola vez por nivel (ej. 80 % y 100 %) en cada mes
create table if not exists budget_alerts (
  family_id   uuid not null references families(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  month       date not null,
  level       smallint not null,
  sent_at     timestamptz not null default now(),
  primary key (family_id, category_id, month, level)
);
alter table budget_alerts enable row level security;
drop policy if exists budget_alerts_select on budget_alerts;
create policy budget_alerts_select on budget_alerts for select using (is_family_member(family_id));
-- Solo el servidor las crea
