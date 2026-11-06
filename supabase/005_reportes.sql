-- ---------------------------------------------------------------------
-- Luka — resumen mensual automático y borrado de datos por el titular
-- Ejecutar después de 004_prd.sql
-- ---------------------------------------------------------------------

-- Último mes cuyo resumen se envió al grupo (evita duplicados si el cron se repite)
alter table families add column if not exists last_report_month date;

-- La familia solo la puede borrar su administrador (con todos sus datos, en cascada)
drop policy if exists families_delete_admin on families;
create policy families_delete_admin on families for delete using (is_family_admin(id));

-- Los pagos se conservan por obligación contable aunque se borre la familia (quedan sin vínculo)
alter table payments alter column family_id drop not null;
alter table payments drop constraint if exists payments_family_id_fkey;
alter table payments add constraint payments_family_id_fkey
  foreign key (family_id) references families(id) on delete set null;
