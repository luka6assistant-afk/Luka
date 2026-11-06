-- =====================================================================
-- Luka — con el módulo de deudas activo, las familias nuevas ya no reciben la categoría de gasto "Deudas"
-- (las cuotas y abonos se registran en cada deuda). Ejecutar después de 009_presupuesto.sql
-- =====================================================================
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
    (new.id, 'Otros',           'expense', '📦'),
    (new.id, 'Salario',         'income',  '💼'),
    (new.id, 'Otros ingresos',  'income',  '💰');
  return new;
end $$;
