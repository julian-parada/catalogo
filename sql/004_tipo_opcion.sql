-- =====================================================================
-- 004_tipo_opcion.sql — cada tienda elige cómo se llaman las opciones
-- de sus productos: Talla, Tamaño, Color, Presentación, Modelo u Opción.
--
-- Correr UNA vez en Supabase → SQL Editor. No hay nada que cambiar.
-- Las tiendas que ya existen quedan con "Talla" (como venían);
-- las nuevas arrancan con "Opción". Cada una lo cambia en "Mi tienda".
-- Si se corre otra vez, no cambia nada.
-- =====================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'configuracion' and column_name = 'tipo_opcion') then
    raise notice 'La columna tipo_opcion ya existe. No se cambió nada.';
    return;
  end if;

  alter table public.configuracion
    add column tipo_opcion text not null default 'opcion'
    check (tipo_opcion in ('talla', 'tamano', 'color', 'presentacion', 'modelo', 'opcion'));

  -- Las tiendas que ya existían venían usando "Talla"
  update public.configuracion set tipo_opcion = 'talla';
end $$;
