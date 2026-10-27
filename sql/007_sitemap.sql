-- =====================================================================
-- 007 · Lista pública de tiendas activas (para el sitemap de Google)
--   Solo devuelve el link (slug) de las tiendas activas y al día:
--   esas tiendas ya son públicas, así que no expone nada nuevo.
-- Se puede correr más de una vez sin problema.
-- =====================================================================
begin;

drop function if exists public.tiendas_publicas();
create function public.tiendas_publicas()
returns table(slug text)
language sql stable security definer
set search_path = public as $$
  select c.url_pagina
  from public.clientes c
  where public.tienda_activa(c.id)
  order by c.url_pagina;
$$;
grant execute on function public.tiendas_publicas() to anon, authenticated;

commit;
