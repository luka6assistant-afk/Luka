-- =====================================================================
-- Ajustes del PRD: roles, edición desde Telegram, audio, categorías y métricas del MVP
-- Ejecutar DESPUÉS de 003_legal.sql (Supabase → SQL Editor → Run)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Roles: solo el administrador gestiona familia, categorías, presupuestos y metas.
-- Los miembros registran movimientos (incluidos aportes a metas) y consultan.
-- ---------------------------------------------------------------------
create or replace function is_family_admin(fid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid() and role = 'admin');
$$;

drop policy if exists families_update on families;
create policy families_update on families for update using (is_family_admin(id));

-- Miembros: antes cualquiera podía insertarse en cualquier familia conociendo su id.
-- Ahora solo: el creador de la familia se agrega como admin, o un admin agrega/edita.
-- Unirse con código o enlace va por la función join_family (security definer).
drop policy if exists members_all on family_members;
drop policy if exists members_select on family_members;
create policy members_select on family_members for select using (is_family_member(family_id));
drop policy if exists members_insert on family_members;
create policy members_insert on family_members for insert with check (
  is_family_admin(family_id)
  or (user_id = auth.uid() and role = 'admin'
      and exists (select 1 from families f where f.id = family_id and f.created_by = auth.uid()))
);
drop policy if exists members_update on family_members;
create policy members_update on family_members for update using (is_family_admin(family_id));
drop policy if exists members_delete on family_members;
create policy members_delete on family_members for delete using (is_family_admin(family_id));

-- Categorías y metas: todos leen, solo admin escribe
do $$
declare t text;
begin
  foreach t in array array['categories', 'savings_goals', 'debts'] loop
    execute format('drop policy if exists %1$s_all on %1$s', t);
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('drop policy if exists %1$s_write on %1$s', t);
    execute format('create policy %1$s_select on %1$s for select using (is_family_member(family_id))', t);
    execute format(
      'create policy %1$s_write on %1$s for all using (is_family_admin(family_id)) with check (is_family_admin(family_id))', t);
  end loop;
end $$;

-- Un admin no puede quitarse el rol si es el único admin
create or replace function keep_one_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Si se está borrando la familia completa (cascada), no aplica
  if not exists (select 1 from families where id = old.family_id) then return coalesce(new, old); end if;
  if old.role = 'admin' and (tg_op = 'DELETE' or new.role <> 'admin') and
     not exists (select 1 from family_members where family_id = old.family_id and role = 'admin' and id <> old.id) then
    raise exception 'La familia debe tener al menos un administrador';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists family_members_keep_admin on family_members;
create trigger family_members_keep_admin before update or delete on family_members
  for each row execute function keep_one_admin();

-- Enlace de invitación: datos mínimos de la familia a partir del código (sin exponer nada más)
create or replace function family_by_code(code text) returns table (name text)
language sql stable security definer set search_path = public as $$
  select f.name from families f where f.link_code = upper(trim(code));
$$;
grant execute on function family_by_code(text) to authenticated;

-- ---------------------------------------------------------------------
-- Movimientos: audio, edición desde Telegram y tiempo de registro
-- ---------------------------------------------------------------------
alter table transactions drop constraint if exists transactions_source_check;
alter table transactions add constraint transactions_source_check
  check (source in ('telegram_photo', 'telegram_text', 'telegram_audio', 'web'));

-- Mensaje del bot que pide la corrección (para encontrar el movimiento cuando responden)
alter table transactions add column if not exists edit_prompt_message_id bigint;
-- Lo que se transcribió de una nota de voz
alter table transactions add column if not exists transcript text;
-- Milisegundos entre que el usuario envió el mensaje y el bot respondió (métrica "< 10 s")
alter table transactions add column if not exists latency_ms integer;

-- ---------------------------------------------------------------------
-- Categorías iniciales del PRD (aplica a familias nuevas).
-- "Ahorro" no es categoría: es un tipo de movimiento. "Deudas" recoge cuotas y abonos.
-- ---------------------------------------------------------------------
create or replace function seed_family_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into categories (family_id, name, kind, icon) values
    (new.id, 'Mercado',         'expense', '🛒'),
    (new.id, 'Hogar',           'expense', '🏠'),
    (new.id, 'Servicios',       'expense', '💡'),
    (new.id, 'Transporte',      'expense', '🚗'),
    (new.id, 'Salud',           'expense', '🩺'),
    (new.id, 'Educación',       'expense', '🎓'),
    (new.id, 'Entretenimiento', 'expense', '🎬'),
    (new.id, 'Deudas',          'expense', '💳'),
    (new.id, 'Otros',           'expense', '📦'),
    (new.id, 'Salario',         'income',  '💼'),
    (new.id, 'Otros ingresos',  'income',  '💰');
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Métricas del MVP (solo el servidor puede llamarla)
-- ---------------------------------------------------------------------
create or replace function product_metrics() returns jsonb
language sql stable security definer set search_path = public as $$
  with fam as (
    select f.id, f.created_at, f.plan,
           (select count(*) from transactions t where t.family_id = f.id and t.created_at > now() - interval '30 days') as tx30,
           (select max(t.created_at) from transactions t where t.family_id = f.id) as last_tx,
           exists (select 1 from savings_goals g where g.family_id = f.id) as has_goal
    from families f
  ),
  cohort as (select * from fam where created_at <= now() - interval '28 days'),
  lat as (
    select source,
           percentile_cont(0.5) within group (order by latency_ms) as p50,
           percentile_cont(0.9) within group (order by latency_ms) as p90,
           count(*) as n,
           avg((latency_ms < 10000)::int) as under10
    from transactions
    where latency_ms is not null and created_at > now() - interval '30 days'
    group by source
  )
  select jsonb_build_object(
    'families_total', (select count(*) from fam),
    'families_active_7d', (select count(*) from fam where last_tx > now() - interval '7 days'),
    'families_paying', (select count(*) from families where plan <> 'trial' and paid_until > now()),
    'avg_tx_per_family_30d', (select round(avg(tx30), 1) from fam where tx30 > 0),
    'families_over_50_tx_30d', (select count(*) from fam where tx30 > 50),
    'retention_week4', (select case when count(*) = 0 then null
                          else round(avg((last_tx > now() - interval '7 days')::int) * 100, 1) end from cohort),
    'retention_cohort_size', (select count(*) from cohort),
    'families_with_goal_pct', (select case when count(*) = 0 then null
                                 else round(avg(has_goal::int) * 100, 1) end from fam),
    'ai_reads_this_month', (select coalesce(sum(count), 0) from ai_usage
                            where month = date_trunc('month', now() at time zone 'America/Bogota')::date),
    'latency', (select coalesce(jsonb_agg(jsonb_build_object(
                  'source', source, 'n', n, 'p50_ms', round(p50), 'p90_ms', round(p90),
                  'under_10s_pct', round(under10 * 100, 1))), '[]'::jsonb) from lat)
  );
$$;
revoke execute on function product_metrics() from public, anon, authenticated;
