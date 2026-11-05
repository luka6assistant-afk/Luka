-- =====================================================================
-- Luka — prueba de la autorización de tratamiento de datos (Ley 1581 de 2012)
-- Ejecutar DESPUÉS de 002_planes.sql (Supabase → SQL Editor → Run)
-- =====================================================================

-- Cada aceptación queda guardada (quién, qué documento, qué versión, cuándo y desde dónde).
-- Es la prueba de la autorización que exige el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).
create table if not exists legal_consents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document    text not null check (document in ('terminos', 'privacidad')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  ip          text,
  user_agent  text,
  unique (user_id, document, version)
);

alter table legal_consents enable row level security;
drop policy if exists consents_own_select on legal_consents;
create policy consents_own_select on legal_consents for select using (user_id = auth.uid());
drop policy if exists consents_own_insert on legal_consents;
create policy consents_own_insert on legal_consents for insert with check (user_id = auth.uid());

-- Miembros que solo usan Telegram: cuándo se les mostró el aviso de privacidad.
-- Seguir usando el bot después del aviso es una conducta inequívoca de autorización.
alter table family_members add column if not exists privacy_notice_at timestamptz;
