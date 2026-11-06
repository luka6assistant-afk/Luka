-- =====================================================================
-- Luka — prueba de 30 días, precio de fundador, referidos y mensajes de la prueba
-- Ejecutar después de 005_reportes.sql (Supabase → SQL Editor → Run)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Prueba gratis de 30 días
-- ---------------------------------------------------------------------
alter table families alter column trial_ends_at set default now() + interval '30 days';

-- Las familias que están en prueba también reciben los 30 días (contados desde que se crearon)
update families
   set trial_ends_at = created_at + interval '30 days'
 where plan = 'trial' and trial_ends_at < created_at + interval '30 days';

-- ---------------------------------------------------------------------
-- 2. Fundadores, referidos y mensajes de la prueba
-- ---------------------------------------------------------------------
alter table families add column if not exists founder boolean not null default false;
alter table families add column if not exists founder_since timestamptz;
alter table families add column if not exists referral_code text;
alter table families add column if not exists referred_by uuid references families(id) on delete set null;
alter table families add column if not exists referral_rewarded_at timestamptz;
alter table families add column if not exists onboarding_sent text[] not null default '{}';

-- Código para invitar a otras familias (distinto del código para unirse a la familia)
create or replace function new_referral_code() returns text
language sql volatile as $$
  select upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 7))
$$;
update families set referral_code = new_referral_code() where referral_code is null;
alter table families alter column referral_code set default new_referral_code();
alter table families alter column referral_code set not null;
create unique index if not exists families_referral_code_idx on families (referral_code);

-- Precio con el que se creó cada pago (estándar o fundador)
alter table payments add column if not exists tier text not null default 'standard'
  check (tier in ('standard', 'founder'));

-- ---------------------------------------------------------------------
-- 3. Protección: desde el navegador nadie se marca fundador, se asigna un referido ni cambia su plan
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
    or new.onboarding_sent is distinct from old.onboarding_sent) then
    raise exception 'No autorizado para cambiar el plan';
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. Días gratis (referidos): se suman a la prueba o al plan pagado, según corresponda
-- ---------------------------------------------------------------------
create or replace function grant_free_days(fid uuid, days integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  update families
     set trial_ends_at = case when plan = 'trial' then greatest(trial_ends_at, now()) + make_interval(days => days) else trial_ends_at end,
         paid_until    = case when plan <> 'trial' then greatest(coalesce(paid_until, now()), now()) + make_interval(days => days) else paid_until end,
         last_reminder_at = null
   where id = fid;
end $$;

-- ---------------------------------------------------------------------
-- 5. Aplicar un pago aprobado (una sola vez)
--    · Si paga durante la prueba, no pierde los días que le quedaban.
--    · Si el pago es con precio de fundador, la familia queda marcada como fundadora.
--    · Si es su primer pago y llegó invitada, las dos familias reciben 30 días gratis.
--    Devuelve 'applied' o 'applied_referral' (cuando además se entregó la recompensa).
-- ---------------------------------------------------------------------
create or replace function apply_payment(ref text, tx_id text, tx_status text, tx_amount bigint, tx_method text)
returns text
language plpgsql security definer set search_path = public as $$
declare p payments%rowtype;
declare f families%rowtype;
declare base timestamptz;
declare first_payment boolean;
begin
  select * into p from payments where reference = ref for update;
  if not found then return 'not_found'; end if;

  update payments set status = tx_status, wompi_transaction_id = tx_id,
         payment_method = coalesce(tx_method, payment_method), updated_at = now()
   where id = p.id and applied_at is null;

  if p.applied_at is not null then return 'already_applied'; end if;
  if tx_status <> 'APPROVED' then return 'not_approved'; end if;
  if tx_amount <> p.amount_in_cents then return 'amount_mismatch'; end if;
  if p.family_id is null then return 'not_found'; end if;

  select * into f from families where id = p.family_id for update;
  select not exists (select 1 from payments where family_id = p.family_id and applied_at is not null) into first_payment;

  base := greatest(now(), coalesce(f.paid_until, now()), case when f.plan = 'trial' then f.trial_ends_at else now() end);
  update families
     set plan = p.plan,
         paid_until = base + case when p.period = 'yearly' then interval '12 months' else interval '1 month' end,
         last_reminder_at = null,
         founder = founder or p.tier = 'founder',
         founder_since = case when p.tier = 'founder' and not founder then now() else founder_since end
   where id = p.family_id;
  update payments set applied_at = now() where id = p.id;

  if first_payment and f.referred_by is not null and f.referral_rewarded_at is null then
    perform grant_free_days(p.family_id, 30);
    perform grant_free_days(f.referred_by, 30);
    update families set referral_rewarded_at = now() where id = p.family_id;
    return 'applied_referral';
  end if;
  return 'applied';
end $$;

-- Solo el servidor las llama
revoke execute on function apply_payment(text, text, text, bigint, text) from public, anon, authenticated;
revoke execute on function grant_free_days(uuid, integer) from public, anon, authenticated;
