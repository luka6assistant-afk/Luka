-- =====================================================================
-- Luka — canal de WhatsApp (chat privado de cada miembro con el número de Luka)
-- Ejecutar después de 007_seguridad.sql (Supabase → SQL Editor → Run)
-- =====================================================================

-- Número de WhatsApp de cada miembro (formato internacional sin "+", ej. 573001234567).
-- Un número pertenece a una sola familia, para saber a quién corresponde cada mensaje.
alter table family_members add column if not exists whatsapp_phone text;
create unique index if not exists family_members_whatsapp_phone_idx on family_members (whatsapp_phone) where whatsapp_phone is not null;

-- Corrección pendiente: después de tocar «✏️ Editar», el siguiente mensaje de esa persona es la corrección
alter table family_members add column if not exists wa_edit_tx uuid references transactions(id) on delete set null;
alter table family_members add column if not exists wa_edit_at timestamptz;

-- Origen de los movimientos registrados por WhatsApp
alter table transactions drop constraint if exists transactions_source_check;
alter table transactions add constraint transactions_source_check
  check (source in ('telegram_photo', 'telegram_text', 'telegram_audio', 'whatsapp_photo', 'whatsapp_text', 'whatsapp_audio', 'web'));

-- Mensajes ya atendidos (Meta puede reenviar el mismo mensaje; cada uno se procesa una sola vez)
create table if not exists wa_processed (
  message_id text primary key,
  at         timestamptz not null default now()
);
alter table wa_processed enable row level security; -- sin políticas: solo el servidor

-- Enlaces de un solo uso para entrar al panel desde WhatsApp (se guarda el hash, no el enlace)
create table if not exists wa_login_tokens (
  token_hash text primary key,
  member_id  uuid not null references family_members(id) on delete cascade,
  expires_at timestamptz not null
);
alter table wa_login_tokens enable row level security; -- sin políticas: solo el servidor
