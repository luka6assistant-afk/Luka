-- =====================================================================
-- Luka — mes de la cuota en los abonos a deudas
-- Un pago hecho el 30 de octubre puede ser la cuota de noviembre. Si queda vacío, cuenta en el mes de la fecha.
-- Ejecutar después de 010_deudas.sql
-- =====================================================================
alter table transactions add column if not exists applies_to_month date
  check (applies_to_month is null or extract(day from applies_to_month) = 1);
