-- 010 · Intensidad de la sombra (velo) sobre la foto de portada
-- normal = como siempre · suave = se ve más la foto · minimo = casi sin sombra
alter table public.configuracion
  add column if not exists portada_velo text not null default 'normal';

do $$ begin
  alter table public.configuracion
    add constraint configuracion_portada_velo_chk check (portada_velo in ('normal', 'suave', 'minimo'));
exception when duplicate_object then null; end $$;
