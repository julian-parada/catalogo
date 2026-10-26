-- =====================================================================
-- 006 · Panel de la plataforma (plataforma.html) — SOLO para ti
--   Funciones para manejar las tiendas sin entrar a Supabase:
--     · plataforma_tiendas()        → lista de tiendas con días restantes y datos de uso
--     · plataforma_renovar(...)     → suma meses al plan y registra el pago
--     · plataforma_estado(...)      → suspender / reactivar
--     · plataforma_editar(...)      → corregir datos o la fecha de vencimiento
--     · plataforma_pagos(...)       → historial de pagos de una tienda
--     · plataforma_crear_tienda(...)→ dar de alta (el usuario se crea antes en Authentication)
--   Todas revisan es_superadmin(): si otra persona las llama, fallan.
--   Se puede correr más de una vez sin problema.
-- =====================================================================

begin;

-- Fecha de hoy en Colombia (para que "vence hoy" sea hoy en Ocaña, no en Londres)
create or replace function public.hoy_colombia()
returns date language sql stable
as $$ select (now() at time zone 'America/Bogota')::date; $$;

create or replace function public.exigir_superadmin()
returns void language plpgsql stable
set search_path = public as $$
begin
  if not public.es_superadmin() then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Lista de tiendas
-- ---------------------------------------------------------------------
drop function if exists public.plataforma_tiendas();
create function public.plataforma_tiendas()
returns table(
  id uuid, slug text, nombre text, contacto text, telefono text,
  estado text, vence date, dias integer, activa boolean, creada timestamptz,
  admin_email text, productos integer, pedidos_30d integer, ultimo_pedido timestamp,
  ultimo_pago timestamptz, ultimo_monto numeric, total_pagado numeric, pagado_mes numeric
)
language plpgsql stable security definer
set search_path = public as $$
begin
  perform public.exigir_superadmin();
  return query
  select c.id, c.url_pagina, c.nombre_negocio, c.nombre_contacto, c.telefono,
         c.estado, c.fecha_vencimiento, (c.fecha_vencimiento - public.hoy_colombia())::integer,
         public.tienda_activa(c.id), c.created_at,
         (select u.email::text from admins a join auth.users u on u.id = a.user_id where a.tienda_id = c.id limit 1),
         (select count(*)::integer from prendas p where p.tienda_id = c.id),
         (select count(*)::integer from pedidos pe where pe.tienda_id = c.id and pe.creado_en >= now() - interval '30 days'),
         (select max(pe.creado_en) from pedidos pe where pe.tienda_id = c.id),
         (select max(pg.fecha_pago) from pagos pg where pg.cliente_id = c.id),
         (select pg.monto from pagos pg where pg.cliente_id = c.id order by pg.fecha_pago desc limit 1),
         coalesce((select sum(pg.monto) from pagos pg where pg.cliente_id = c.id), 0),
         coalesce((select sum(pg.monto) from pagos pg where pg.cliente_id = c.id
                     and date_trunc('month', pg.fecha_pago at time zone 'America/Bogota')
                       = date_trunc('month', now() at time zone 'America/Bogota')), 0)
  from clientes c
  order by c.fecha_vencimiento asc, c.nombre_negocio;
end;
$$;

-- ---------------------------------------------------------------------
-- Renovar: suma meses desde hoy (si ya venció) o desde la fecha actual (si aún está al día)
-- y deja registrado el pago
-- ---------------------------------------------------------------------
drop function if exists public.plataforma_renovar(uuid, integer, numeric, text);
create function public.plataforma_renovar(p_tienda uuid, p_meses integer, p_monto numeric, p_metodo text)
returns date
language plpgsql security definer
set search_path = public as $$
declare
  v_desde date;
  v_hasta date;
begin
  perform public.exigir_superadmin();
  if p_meses is null or p_meses < 1 or p_meses > 24 then
    raise exception 'Los meses deben estar entre 1 y 24';
  end if;
  if p_monto is not null and p_monto < 0 then
    raise exception 'El monto no puede ser negativo';
  end if;

  select greatest(fecha_vencimiento, public.hoy_colombia()) into v_desde from clientes where id = p_tienda for update;
  if v_desde is null then raise exception 'No existe esa tienda'; end if;
  v_hasta := (v_desde + make_interval(months => p_meses))::date;

  update clientes set fecha_vencimiento = v_hasta, estado = 'activo' where id = p_tienda;

  if coalesce(p_monto, 0) > 0 then
    insert into pagos (cliente_id, monto, metodo_pago, mes_pagado)
    values (p_tienda, p_monto, coalesce(nullif(trim(p_metodo), ''), 'Otro'),
            to_char(v_desde, 'YYYY-MM-DD') || ' a ' || to_char(v_hasta, 'YYYY-MM-DD') || ' (' || p_meses || ' mes' || case when p_meses > 1 then 'es' else '' end || ')');
  end if;

  return v_hasta;
end;
$$;

-- ---------------------------------------------------------------------
-- Suspender / reactivar
-- ---------------------------------------------------------------------
drop function if exists public.plataforma_estado(uuid, text);
create function public.plataforma_estado(p_tienda uuid, p_estado text)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  perform public.exigir_superadmin();
  if p_estado not in ('activo', 'suspendido') then
    raise exception 'Estado no válido: %', p_estado;
  end if;
  update clientes set estado = p_estado where id = p_tienda;
  if not found then raise exception 'No existe esa tienda'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Editar datos (y corregir la fecha a mano si hace falta)
-- ---------------------------------------------------------------------
drop function if exists public.plataforma_editar(uuid, text, text, text, date);
create function public.plataforma_editar(p_tienda uuid, p_nombre text, p_contacto text, p_telefono text, p_vence date)
returns void
language plpgsql security definer
set search_path = public as $$
begin
  perform public.exigir_superadmin();
  if coalesce(trim(p_nombre), '') = '' or coalesce(trim(p_contacto), '') = '' or coalesce(trim(p_telefono), '') = '' or p_vence is null then
    raise exception 'Nombre, contacto, teléfono y fecha son obligatorios';
  end if;
  update clientes
     set nombre_negocio = left(trim(p_nombre), 80),
         nombre_contacto = left(trim(p_contacto), 80),
         telefono = left(trim(p_telefono), 20),
         fecha_vencimiento = p_vence
   where id = p_tienda;
  if not found then raise exception 'No existe esa tienda'; end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Historial de pagos
-- ---------------------------------------------------------------------
drop function if exists public.plataforma_pagos(uuid);
create function public.plataforma_pagos(p_tienda uuid)
returns table(id uuid, fecha timestamptz, monto numeric, metodo text, periodo text)
language plpgsql stable security definer
set search_path = public as $$
begin
  perform public.exigir_superadmin();
  return query
  select pg.id, pg.fecha_pago, pg.monto, pg.metodo_pago, pg.mes_pagado
  from pagos pg where pg.cliente_id = p_tienda
  order by pg.fecha_pago desc;
end;
$$;

-- ---------------------------------------------------------------------
-- Crear tienda desde el panel (usa crear_tienda, que nadie más puede llamar)
-- ---------------------------------------------------------------------
drop function if exists public.plataforma_crear_tienda(text, text, text, text, date, text);
create function public.plataforma_crear_tienda(
  p_slug text, p_nombre text, p_contacto text, p_telefono text, p_vence date, p_email text
)
returns uuid
language plpgsql security definer
set search_path = public as $$
begin
  perform public.exigir_superadmin();
  return public.crear_tienda(p_slug, p_nombre, p_contacto, p_telefono, p_vence, p_email);
end;
$$;

-- Solo usuarios con sesión pueden llamarlas (y adentro se revisa que seas tú)
revoke execute on function public.plataforma_tiendas() from public, anon;
revoke execute on function public.plataforma_renovar(uuid, integer, numeric, text) from public, anon;
revoke execute on function public.plataforma_estado(uuid, text) from public, anon;
revoke execute on function public.plataforma_editar(uuid, text, text, text, date) from public, anon;
revoke execute on function public.plataforma_pagos(uuid) from public, anon;
revoke execute on function public.plataforma_crear_tienda(text, text, text, text, date, text) from public, anon;
grant execute on function public.plataforma_tiendas() to authenticated;
grant execute on function public.plataforma_renovar(uuid, integer, numeric, text) to authenticated;
grant execute on function public.plataforma_estado(uuid, text) to authenticated;
grant execute on function public.plataforma_editar(uuid, text, text, text, date) to authenticated;
grant execute on function public.plataforma_pagos(uuid) to authenticated;
grant execute on function public.plataforma_crear_tienda(text, text, text, text, date, text) to authenticated;

-- El panel del cliente muestra la cuenta regresiva: mi_tienda_info ahora también dice el estado
drop function if exists public.mi_tienda_info();
create function public.mi_tienda_info()
returns table(id uuid, slug text, nombre text, activa boolean, vence date, estado text, dias integer)
language sql stable security definer
set search_path = public as $$
  select c.id, c.url_pagina, c.nombre_negocio, public.tienda_activa(c.id), c.fecha_vencimiento,
         c.estado, (c.fecha_vencimiento - public.hoy_colombia())::integer
  from public.clientes c
  where c.id = public.mi_tienda();
$$;
revoke execute on function public.mi_tienda_info() from public, anon;
grant execute on function public.mi_tienda_info() to authenticated;

commit;
