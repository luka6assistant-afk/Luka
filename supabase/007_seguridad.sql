-- =====================================================================
-- Luka — refuerzo de seguridad (revisión del 6 de noviembre de 2026)
-- Ejecutar DESPUÉS de 006_crecimiento.sql (Supabase → SQL Editor → Run)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Códigos de familia imposibles de adivinar
--    Antes: 6 caracteres hexadecimales (16 millones de combinaciones: se podían probar todos).
--    Ahora: 10 caracteres de un alfabeto sin letras confusas (≈ 1.000 billones de combinaciones),
--    más un límite de intentos fallidos por persona.
-- ---------------------------------------------------------------------
create or replace function new_link_code() returns text
language plpgsql volatile as $$
declare alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
declare code text := '';
-- 16 bytes aleatorios de gen_random_uuid (núcleo de Postgres, sin extensiones)
declare bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
begin
  for i in 0..9 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return code;
end $$;

update families set link_code = new_link_code();
alter table families alter column link_code set default new_link_code();

-- Intentos fallidos de unirse con un código (para frenar a quien pruebe códigos al azar)
create table if not exists code_attempts (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists code_attempts_user_idx on code_attempts (user_id, at desc);
alter table code_attempts enable row level security; -- sin políticas: solo las funciones de abajo la usan

create or replace function too_many_code_attempts() returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) >= 10 from code_attempts where user_id = auth.uid() and at > now() - interval '1 hour'
$$;
revoke execute on function too_many_code_attempts() from public, anon, authenticated;

create or replace function join_family(code text, member_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if too_many_code_attempts() then raise exception 'Demasiados intentos. Espera una hora e inténtalo de nuevo.'; end if;
  select id into fid from families where link_code = upper(trim(code));
  if fid is null then
    insert into code_attempts (user_id) values (auth.uid());
    raise exception 'Código no válido';
  end if;
  insert into family_members (family_id, user_id, display_name)
  values (fid, auth.uid(), left(coalesce(nullif(trim(member_name), ''), 'Miembro'), 60))
  on conflict (family_id, user_id) do nothing;
  return fid;
end $$;

create or replace function family_by_code(code text) returns table (name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or too_many_code_attempts() then return; end if;
  return query select f.name from families f where f.link_code = upper(trim(code));
end $$;
revoke execute on function join_family(text, text) from public, anon;
grant execute on function join_family(text, text) to authenticated;
revoke execute on function family_by_code(text) from public, anon;
grant execute on function family_by_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Desde el navegador nadie cambia el chat vinculado, el código ni el creador de la familia
--    (antes un administrador podía apuntar su familia al chat de otra y bloquearla).
--    Esos cambios solo los hace el servidor.
-- ---------------------------------------------------------------------
create or replace function protect_family_billing() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() in ('anon', 'authenticated') then
      new.plan := 'trial';
      new.trial_ends_at := now() + interval '30 days';
      new.paid_until := null;
      new.last_reminder_at := null;
      new.founder := false;
      new.founder_since := null;
      new.referred_by := null;
      new.referral_rewarded_at := null;
      new.referral_code := new_referral_code();
      new.onboarding_sent := '{}';
      new.telegram_chat_id := null;
      new.link_code := new_link_code();
      new.created_by := auth.uid();
    end if;
    return new;
  end if;
  if auth.role() in ('anon', 'authenticated') and (
       new.plan is distinct from old.plan
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.paid_until is distinct from old.paid_until
    or new.last_reminder_at is distinct from old.last_reminder_at
    or new.founder is distinct from old.founder
    or new.founder_since is distinct from old.founder_since
    or new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.referral_rewarded_at is distinct from old.referral_rewarded_at
    or new.onboarding_sent is distinct from old.onboarding_sent
    or new.telegram_chat_id is distinct from old.telegram_chat_id
    or new.link_code is distinct from old.link_code
    or new.created_by is distinct from old.created_by
    or new.last_report_month is distinct from old.last_report_month) then
    raise exception 'No autorizado para cambiar estos datos de la familia';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Un movimiento solo puede apuntar a categorías, metas, deudas y miembros de SU familia
--    (antes se podía sumar o restar plata a la meta de ahorro de otra familia).
-- ---------------------------------------------------------------------
create or replace function check_transaction_refs() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.family_id is distinct from old.family_id then
    raise exception 'Un movimiento no puede cambiar de familia';
  end if;
  if new.category_id is not null and not exists (select 1 from categories where id = new.category_id and family_id = new.family_id) then
    raise exception 'Categoría no válida';
  end if;
  if new.savings_goal_id is not null and not exists (select 1 from savings_goals where id = new.savings_goal_id and family_id = new.family_id) then
    raise exception 'Meta no válida';
  end if;
  if new.debt_id is not null and not exists (select 1 from debts where id = new.debt_id and family_id = new.family_id) then
    raise exception 'Deuda no válida';
  end if;
  if new.member_id is not null and not exists (select 1 from family_members where id = new.member_id and family_id = new.family_id) then
    raise exception 'Miembro no válido';
  end if;
  return new;
end $$;
drop trigger if exists transactions_check_refs on transactions;
create trigger transactions_check_refs before insert or update on transactions
  for each row execute function check_transaction_refs();

-- Lo mismo para categorías/metas/deudas: no se pueden pasar a otra familia
create or replace function block_family_change() returns trigger
language plpgsql as $$
begin
  if new.family_id is distinct from old.family_id then raise exception 'No se puede cambiar de familia'; end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['categories', 'savings_goals', 'debts', 'family_members'] loop
    execute format('drop trigger if exists %1$s_block_family_change on %1$s', t);
    execute format('create trigger %1$s_block_family_change before update on %1$s for each row execute function block_family_change()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Los pagos solo los crea el servidor (antes un miembro podía crear un pago con el valor que quisiera)
-- ---------------------------------------------------------------------
drop policy if exists payments_insert on payments;

-- ---------------------------------------------------------------------
-- 5. "Soy yo" con verificación: para unir tu Telegram a tu cuenta web hay que escribir en el grupo
--    un código que solo ve el dueño de la cuenta (antes cualquiera podía reclamar a otro miembro).
-- ---------------------------------------------------------------------
create table if not exists telegram_link_codes (
  member_id  uuid primary key references family_members(id) on delete cascade,
  code       text not null unique,
  expires_at timestamptz not null
);
alter table telegram_link_codes enable row level security; -- sin políticas: solo el servidor la lee y escribe

-- Las funciones con permisos elevados que no deben llamarse desde el navegador
revoke execute on function product_metrics() from public, anon, authenticated;
