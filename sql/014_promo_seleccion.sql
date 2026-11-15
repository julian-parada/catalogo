-- =====================================================================
-- 014 · Ventana de promociones: el botón puede llevar a VARIOS productos
--       que la dueña elige a mano (boton_destino = 'seleccion').
--
-- Seguro de correr en tiendas vendidas: solo agrega una columna opcional
-- (vacía) y amplía la lista de destinos permitidos. No toca datos.
-- Correr DESPUÉS de 013_promociones.sql. Se puede correr dos veces.
-- =====================================================================

alter table public.promociones add column if not exists destino_ids bigint[];

alter table public.promociones drop constraint if exists promociones_destino;
alter table public.promociones add constraint promociones_destino
  check (boton_destino in ('ofertas', 'categoria', 'producto', 'seleccion', 'cerrar'));

do $$ begin
  alter table public.promociones add constraint promociones_destino_ids
    check (destino_ids is null or cardinality(destino_ids) <= 40);
exception when duplicate_object then null; end $$;
