-- =====================================================================
-- 005 · Resumen del pedido con el nombre del cliente + paleta personalizada
--   · obtener_pedido ahora devuelve también cliente_nombre
--     (la dirección, el barrio y la referencia siguen sin mostrarse:
--      ese link lo puede abrir cualquiera que lo tenga)
--   · configuracion.paleta acepta cualquier texto (para guardar
--     "personal:#color:#color:oscuro" cuando la tienda arma sus colores)
-- Se puede correr más de una vez sin problema.
-- =====================================================================

begin;

-- Paleta: que sea texto libre y sin restricciones de valores fijos
alter table public.configuracion alter column paleta type text;

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace ns on ns.oid = cl.relnamespace
    where ns.nspname = 'public' and cl.relname = 'configuracion'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%paleta%'
  loop
    execute format('alter table public.configuracion drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.configuracion
  add constraint configuracion_paleta_largo check (paleta is null or length(paleta) <= 60) not valid;

-- Página pública del pedido: ahora con el nombre de quien pidió
create or replace function public.obtener_pedido(p_codigo uuid)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'creado_en',      p.creado_en,
    'total',          p.total,
    'cliente_nombre', p.cliente_nombre,
    'entrega',        p.entrega,
    'pago',           p.pago,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', d.nombre, 'talla', d.talla,
        'precio_unitario', d.precio_unitario,
        'cantidad', d.cantidad, 'imagen', d.imagen
      ) order by d.id)
      from detalle_pedido d where d.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from pedidos p where p.codigo = p_codigo;
$$;

commit;
