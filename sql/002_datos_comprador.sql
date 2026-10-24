-- =====================================================================
-- 002_datos_comprador.sql — el pedido guarda los datos del comprador
--
-- Correr UNA vez en Supabase → SQL Editor (después de 001_multitienda.sql).
--
--   · pedidos: nombre, entrega (domicilio / recoger), dirección, barrio,
--     referencia, forma de pago y nota
--   · crear_pedido(p_items, p_cliente) valida esos datos en el servidor
--   · obtener_pedido (la página pública del pedido) NO devuelve la dirección:
--     esa solo la ve el vendedor por WhatsApp y en su panel
-- =====================================================================

begin;

do $$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'pedidos' and column_name = 'cliente_nombre') then
    raise exception 'Esta migración ya se corrió antes. No se cambió nada.';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'pedidos' and column_name = 'tienda_id') then
    raise exception 'Primero hay que correr 001_multitienda.sql. No se cambió nada.';
  end if;
end $$;

alter table public.pedidos
  add column cliente_nombre text,
  add column entrega        text check (entrega in ('domicilio', 'recoger')),
  add column direccion      text,
  add column barrio         text,
  add column referencia     text,
  add column pago           text check (pago in ('efectivo', 'nequi', 'transferencia')),
  add column nota           text;

-- La versión vieja (solo p_items) se reemplaza por una con p_cliente opcional
drop function if exists public.crear_pedido(jsonb);

create or replace function public.crear_pedido(p_items jsonb, p_cliente jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_pedido_id  integer;
  v_codigo     uuid;
  v_total      numeric := 0;
  v_item       jsonb;
  v_prenda     record;
  v_talla      record;
  v_cant       integer;
  v_precio     numeric;
  v_tienda     uuid;
  -- datos del comprador (limpios y con largo máximo)
  v_nombre     text := left(nullif(btrim(p_cliente->>'nombre'), ''), 80);
  v_entrega    text := nullif(btrim(p_cliente->>'entrega'), '');
  v_direccion  text := left(nullif(btrim(p_cliente->>'direccion'), ''), 150);
  v_barrio     text := left(nullif(btrim(p_cliente->>'barrio'), ''), 80);
  v_referencia text := left(nullif(btrim(p_cliente->>'referencia'), ''), 150);
  v_pago       text := nullif(btrim(p_cliente->>'pago'), '');
  v_nota       text := left(nullif(btrim(p_cliente->>'nota'), ''), 300);
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Pedido invalido';
  end if;

  -- Validación del comprador
  if p_cliente is null or jsonb_typeof(p_cliente) <> 'object' then
    raise exception 'Faltan tus datos';
  end if;
  if v_nombre is null or length(v_nombre) < 2 then
    raise exception 'Escribe tu nombre';
  end if;
  if v_entrega is null or v_entrega not in ('domicilio', 'recoger') then
    raise exception 'Elige si es a domicilio o si lo recoges';
  end if;
  if v_entrega = 'domicilio' and (v_direccion is null or v_barrio is null) then
    raise exception 'Escribe la dirección y el barrio';
  end if;
  if v_pago is null or v_pago not in ('efectivo', 'nequi', 'transferencia') then
    raise exception 'Elige la forma de pago';
  end if;
  if v_entrega = 'recoger' then
    v_direccion := null; v_barrio := null; v_referencia := null;
  end if;

  -- La tienda sale de la primera prenda; todas las demás deben ser de la misma
  select tienda_id into v_tienda from prendas
  where id = (p_items->0->>'prenda_id')::bigint;
  if v_tienda is null then raise exception 'Prenda no existe'; end if;
  if not public.tienda_activa(v_tienda) then raise exception 'Tienda no disponible'; end if;

  insert into pedidos (total, tienda_id, cliente_nombre, entrega, direccion, barrio, referencia, pago, nota)
  values (0, v_tienda, v_nombre, v_entrega, v_direccion, v_barrio, v_referencia, v_pago, v_nota)
  returning id, codigo into v_pedido_id, v_codigo;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_cant := (v_item->>'cantidad')::integer;
    if v_cant is null or v_cant < 1 or v_cant > 50 then
      raise exception 'Cantidad invalida';
    end if;

    select * into v_prenda from prendas
    where id = (v_item->>'prenda_id')::bigint and tienda_id = v_tienda;
    if not found then raise exception 'Prenda no existe'; end if;

    select * into v_talla from tallas
    where id = (v_item->>'talla_id')::bigint
      and prenda_id = v_prenda.id and disponible;
    if not found then raise exception 'Talla no disponible'; end if;

    v_precio := coalesce(nullif(v_prenda.precio_oferta, 0), v_prenda.precio);
    v_total  := v_total + v_precio * v_cant;

    insert into detalle_pedido
      (pedido_id, tienda_id, prenda_id, nombre, talla, precio_unitario, cantidad, imagen)
    values
      (v_pedido_id, v_tienda, v_prenda.id, v_prenda.nombre, v_talla.talla,
       v_precio, v_cant, coalesce(v_prenda.imagen, ''));
  end loop;

  update pedidos set total = v_total where id = v_pedido_id;
  return v_codigo;
end;
$$;

-- Página pública del pedido: agrega cómo se entrega y cómo se paga (sin dirección ni nombre)
create or replace function public.obtener_pedido(p_codigo uuid)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'creado_en', p.creado_en,
    'total',     p.total,
    'entrega',   p.entrega,
    'pago',      p.pago,
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
