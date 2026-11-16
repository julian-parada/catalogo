-- 015 · Encuadre de la foto de portada: qué parte de la foto se ve
-- arriba = se ven las cabezas/la parte de arriba · centro = como siempre · abajo = la parte de abajo
-- Seguro en tiendas vendidas: todas quedan en 'centro' (igual que hoy). Se puede correr dos veces.
alter table public.configuracion
  add column if not exists portada_encuadre text not null default 'centro';

do $$ begin
  alter table public.configuracion
    add constraint configuracion_portada_encuadre_chk check (portada_encuadre in ('arriba', 'centro', 'abajo'));
exception when duplicate_object then null; end $$;
