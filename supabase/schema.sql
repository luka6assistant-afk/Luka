-- =====================================================================
-- Luka — esquema de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Familias: una por chat de Telegram
-- ---------------------------------------------------------------------
create table if not exists families (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  currency         text not null default 'COP',
  telegram_chat_id bigint unique,
  link_code        text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Miembros: pueden tener cuenta web (user_id), Telegram (telegram_user_id) o ambos
create table if not exists family_members (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families(id) on delete cascade,
  user_id          uuid references auth.users(id) on delete set null,
  telegram_user_id bigint,
  display_name     text not null,
  role             text not null default 'member' check (role in ('admin', 'member')),
  created_at       timestamptz not null default now(),
  unique (family_id, user_id),
  unique (family_id, telegram_user_id)
);

-- Categorías con presupuesto mensual
create table if not exists categories (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  name           text not null,
  kind           text not null default 'expense' check (kind in ('expense', 'income')),
  icon           text not null default '•',
  monthly_budget numeric(14,2) not null default 0,
  created_at     timestamptz not null default now(),
  unique (family_id, name)
);

-- Deudas (tarjetas, créditos, préstamos)
create table if not exists debts (
  id                   uuid primary key default gen_random_uuid(),
  family_id            uuid not null references families(id) on delete cascade,
  name                 text not null,
  creditor             text,
  original_amount      numeric(14,2) not null default 0,
  balance              numeric(14,2) not null default 0,
  annual_rate          numeric(7,4) not null default 0,   -- tasa efectiva anual, ej 0.28 = 28% E.A.
  monthly_payment      numeric(14,2) not null default 0,
  due_day              smallint check (due_day between 1 and 31),
  active               boolean not null default true,
  created_at           timestamptz not null default now()
);

-- Metas de ahorro
create table if not exists savings_goals (
  id             uuid primary key default gen_random_uuid(),
  family_id      uuid not null references families(id) on delete cascade,
  name           text not null,
  target_amount  numeric(14,2) not null default 0,
  current_amount numeric(14,2) not null default 0,
  target_date    date,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- Movimientos
create table if not exists transactions (
  id                  uuid primary key default gen_random_uuid(),
  family_id           uuid not null references families(id) on delete cascade,
  kind                text not null check (kind in ('expense', 'income', 'debt_payment', 'saving')),
  status              text not null default 'confirmed' check (status in ('pending', 'confirmed')),
  amount              numeric(14,2) not null check (amount >= 0),
  occurred_on         date not null default current_date,
  merchant            text,
  description         text,
  category_id         uuid references categories(id) on delete set null,
  debt_id             uuid references debts(id) on delete set null,
  savings_goal_id     uuid references savings_goals(id) on delete set null,
  member_id           uuid references family_members(id) on delete set null,
  payment_method      text,
  source              text not null default 'web' check (source in ('telegram_photo', 'telegram_text', 'web')),
  receipt_path        text,
  raw_extraction      jsonb,
  telegram_chat_id    bigint,
  telegram_message_id bigint,
  created_at          timestamptz not null default now()
);

create index if not exists transactions_family_date_idx on transactions (family_id, occurred_on desc);
create index if not exists transactions_family_status_idx on transactions (family_id, status);

-- ---------------------------------------------------------------------
-- Aplicar abonos/ahorros a saldos cuando un movimiento queda confirmado
-- ---------------------------------------------------------------------
create or replace function apply_transaction_effects() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  old_effect boolean := (tg_op in ('UPDATE', 'DELETE')) and old.status = 'confirmed';
  new_effect boolean := (tg_op in ('INSERT', 'UPDATE')) and new.status = 'confirmed';
begin
  if old_effect then
    if old.kind = 'debt_payment' and old.debt_id is not null then
      update debts set balance = balance + old.amount where id = old.debt_id;
    elsif old.kind = 'saving' and old.savings_goal_id is not null then
      update savings_goals set current_amount = current_amount - old.amount where id = old.savings_goal_id;
    end if;
  end if;
  if new_effect then
    if new.kind = 'debt_payment' and new.debt_id is not null then
      update debts set balance = greatest(balance - new.amount, 0) where id = new.debt_id;
    elsif new.kind = 'saving' and new.savings_goal_id is not null then
      update savings_goals set current_amount = current_amount + new.amount where id = new.savings_goal_id;
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists transactions_effects on transactions;
create trigger transactions_effects
  after insert or update or delete on transactions
  for each row execute function apply_transaction_effects();

-- ---------------------------------------------------------------------
-- Categorías por defecto al crear una familia
-- ---------------------------------------------------------------------
create or replace function seed_family_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into categories (family_id, name, kind, icon) values
    (new.id, 'Mercado',            'expense', '🛒'),
    (new.id, 'Restaurantes',       'expense', '🍽️'),
    (new.id, 'Servicios públicos', 'expense', '💡'),
    (new.id, 'Arriendo / Hogar',   'expense', '🏠'),
    (new.id, 'Transporte',         'expense', '🚗'),
    (new.id, 'Salud',              'expense', '🩺'),
    (new.id, 'Educación',          'expense', '🎓'),
    (new.id, 'Internet y celular', 'expense', '📱'),
    (new.id, 'Entretenimiento',    'expense', '🎬'),
    (new.id, 'Ropa',               'expense', '👕'),
    (new.id, 'Mascotas',           'expense', '🐾'),
    (new.id, 'Otros gastos',       'expense', '📦'),
    (new.id, 'Salario',            'income',  '💼'),
    (new.id, 'Otros ingresos',     'income',  '💰');
  return new;
end $$;

drop trigger if exists families_seed_categories on families;
create trigger families_seed_categories
  after insert on families
  for each row execute function seed_family_categories();

-- ---------------------------------------------------------------------
-- Seguridad (RLS): cada usuario web ve solo los datos de sus familias.
-- El bot de Telegram usa la service role key y no pasa por RLS.
-- ---------------------------------------------------------------------
create or replace function is_family_member(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid());
$$;

-- Unirse a una familia existente desde la web con su código
create or replace function join_family(code text, member_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select id into fid from families where link_code = upper(trim(code));
  if fid is null then raise exception 'Código no válido'; end if;
  insert into family_members (family_id, user_id, display_name)
  values (fid, auth.uid(), member_name)
  on conflict (family_id, user_id) do nothing;
  return fid;
end $$;

alter table families       enable row level security;
alter table family_members enable row level security;
alter table categories     enable row level security;
alter table debts          enable row level security;
alter table savings_goals  enable row level security;
alter table transactions   enable row level security;

drop policy if exists families_select on families;
create policy families_select on families for select using (is_family_member(id) or created_by = auth.uid());
drop policy if exists families_insert on families;
create policy families_insert on families for insert with check (created_by = auth.uid());
drop policy if exists families_update on families;
create policy families_update on families for update using (is_family_member(id));

drop policy if exists members_all on family_members;
create policy members_all on family_members for all
  using (is_family_member(family_id))
  with check (is_family_member(family_id) or user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['categories', 'debts', 'savings_goals', 'transactions'] loop
    execute format('drop policy if exists %1$s_all on %1$s', t);
    execute format(
      'create policy %1$s_all on %1$s for all using (is_family_member(family_id)) with check (is_family_member(family_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Almacenamiento privado para las fotos de recibos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('recibos', 'recibos', false)
on conflict (id) do nothing;

-- Las fotos se guardan como recibos/<family_id>/<archivo>
drop policy if exists recibos_read on storage.objects;
create policy recibos_read on storage.objects for select
  using (bucket_id = 'recibos' and is_family_member(((storage.foldername(name))[1])::uuid));
