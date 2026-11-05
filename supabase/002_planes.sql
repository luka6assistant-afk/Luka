-- =====================================================================
-- Luka — planes, límites de uso y pagos con Wompi
-- Ejecutar DESPUÉS de schema.sql (Supabase → SQL Editor → Run)
-- =====================================================================

-- Plan de cada familia. Prueba gratis de 14 días al crearla.
alter table families add column if not exists plan text not null default 'trial'
  check (plan in ('trial', 'familia', 'plus'));
alter table families add column if not exists trial_ends_at timestamptz not null default now() + interval '14 days';
alter table families add column if not exists paid_until timestamptz;
alter table families add column if not exists last_reminder_at timestamptz;

-- Conteo mensual de lecturas con IA (cada foto, PDF o mensaje enviado a Claude)
create table if not exists ai_usage (
  family_id uuid not null references families(id) on delete cascade,
  month     date not null,
  count     integer not null default 0,
  primary key (family_id, month)
);

-- Pagos con Wompi
create table if not exists payments (
  id               uuid primary key default gen_random_uuid(),
  family_id        uuid not null references families(id) on delete cascade,
  reference        text not null unique,
  plan             text not null check (plan in ('familia', 'plus')),
  period           text not null check (period in ('monthly', 'yearly')),
  amount_in_cents  bigint not null,
  status           text not null default 'PENDING',   -- PENDING, APPROVED, DECLINED, VOIDED, ERROR
  wompi_transaction_id text,
  payment_method   text,
  applied_at       timestamptz,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists payments_family_idx on payments (family_id, created_at desc);

alter table ai_usage enable row level security;
alter table payments enable row level security;

drop policy if exists ai_usage_select on ai_usage;
create policy ai_usage_select on ai_usage for select using (is_family_member(family_id));
drop policy if exists payments_select on payments;
create policy payments_select on payments for select using (is_family_member(family_id));
drop policy if exists payments_insert on payments;
create policy payments_insert on payments for insert
  with check (is_family_member(family_id) and status = 'PENDING' and applied_at is null);

-- Los miembros no pueden cambiarse el plan ni las fechas desde el navegador:
-- solo el servidor (service role) modifica esas columnas.
create or replace function protect_family_billing() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() in ('anon', 'authenticated') then
      new.plan := 'trial';
      new.trial_ends_at := now() + interval '14 days';
      new.paid_until := null;
      new.last_reminder_at := null;
    end if;
    return new;
  end if;
  if auth.role() in ('anon', 'authenticated') and (
       new.plan is distinct from old.plan
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.paid_until is distinct from old.paid_until
    or new.last_reminder_at is distinct from old.last_reminder_at) then
    raise exception 'No autorizado para cambiar el plan';
  end if;
  return new;
end $$;

drop trigger if exists families_protect_billing on families;
create trigger families_protect_billing before insert or update on families
  for each row execute function protect_family_billing();

-- Suma una lectura de IA al mes actual (hora Colombia) y devuelve el total
create or replace function increment_ai_usage(fid uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', (now() at time zone 'America/Bogota'))::date;
declare c integer;
begin
  insert into ai_usage (family_id, month, count) values (fid, m, 1)
  on conflict (family_id, month) do update set count = ai_usage.count + 1
  returning count into c;
  return c;
end $$;

-- Aplica un pago aprobado una sola vez (idempotente).
-- Extiende el plan desde hoy o desde el vencimiento actual, lo que sea mayor.
create or replace function apply_payment(ref text, tx_id text, tx_status text, tx_amount bigint, tx_method text)
returns text
language plpgsql security definer set search_path = public as $$
declare p payments%rowtype;
declare base timestamptz;
begin
  select * into p from payments where reference = ref for update;
  if not found then return 'not_found'; end if;

  update payments set status = tx_status, wompi_transaction_id = tx_id,
         payment_method = coalesce(tx_method, payment_method), updated_at = now()
   where id = p.id and applied_at is null;

  if p.applied_at is not null then return 'already_applied'; end if;
  if tx_status <> 'APPROVED' then return 'not_approved'; end if;
  if tx_amount <> p.amount_in_cents then return 'amount_mismatch'; end if;

  select greatest(now(), coalesce(paid_until, now())) into base from families where id = p.family_id;
  update families
     set plan = p.plan,
         paid_until = base + case when p.period = 'yearly' then interval '12 months' else interval '1 month' end,
         last_reminder_at = null
   where id = p.family_id;
  update payments set applied_at = now() where id = p.id;
  return 'applied';
end $$;

-- Estas dos funciones solo las llama el servidor
revoke execute on function increment_ai_usage(uuid) from public, anon, authenticated;
revoke execute on function apply_payment(text, text, text, bigint, text) from public, anon, authenticated;
