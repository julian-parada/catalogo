-- 016_pago_datafono.sql — Forma de pago "Datáfono" (tarjeta débito/crédito al entregar o en la tienda).
--
-- Qué hace:
--   1. Agrega a "configuracion" el interruptor pago_datafono (APAGADO por defecto:
--      ninguna tienda vendida cambia hasta que la active en Mi tienda).
--   2. Permite guardar 'datafono' como forma de pago del pedido.
--   3. crear_pedido acepta 'datafono' solo si la tienda lo tiene activo
--      (es la misma función de 013, con cupones, solo se agrega datáfono).
--
-- Correr DESPUÉS de 013. Se puede correr más de una vez.

begin;

alter table public.configuracion
  add column if not exists pago_datafono boolean not null default false;

alter table public.pedidos drop constraint if exists pedidos_pago_check;
alter table public.pedidos
  add constraint pedidos_pago_check
  check (pago in ('efectivo', 'nequi', 'transferencia', 'datafono', 'addi', 'sistecredito'));

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
  v_pers       text;
  v_cupon_cod  text := upper(left(nullif(btrim(p_cliente->>'cupon'), ''), 20));
  v_cupon      record;
  v_desc       numeric := 0;
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
  if v_pago is null or v_pago not in ('efectivo', 'nequi', 'transferencia', 'datafono', 'addi', 'sistecredito') then
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

  -- Crédito (Addi / Sistecrédito) y datáfono: solo si esta tienda los acepta
  if v_pago in ('addi', 'sistecredito', 'datafono') and not exists (
       select 1 from configuracion c where c.tienda_id = v_tienda
          and case v_pago when 'addi' then c.pago_addi
                          when 'sistecredito' then c.pago_sistecredito
                          else c.pago_datafono end) then
    raise exception 'Elige la forma de pago';
  end if;

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

    -- La oferta solo cuenta mientras no haya vencido (oferta_hasta)
    v_precio := case
      when nullif(v_prenda.precio_oferta, 0) is not null
       and (v_prenda.oferta_hasta is null or v_prenda.oferta_hasta > now())
      then v_prenda.precio_oferta
      else v_prenda.precio
    end;
    v_total  := v_total + v_precio * v_cant;

    -- Bajo pedido: lo que el cliente pide distinto (color, tamaño...), solo si el producto es por encargo
    v_pers := case when v_prenda.por_encargo
                   then left(nullif(btrim(v_item->>'personalizacion'), ''), 150) end;

    insert into detalle_pedido
      (pedido_id, tienda_id, prenda_id, nombre, talla, precio_unitario, cantidad, imagen, personalizacion)
    values
      (v_pedido_id, v_tienda, v_prenda.id, v_prenda.nombre, v_talla.talla,
       v_precio, v_cant, coalesce(v_prenda.imagen, ''), v_pers);
  end loop;

  -- Cupón: se valida aquí (no en el navegador) y se cuenta el uso
  if v_cupon_cod is not null then
    if not public.funcion_activa(v_tienda, 'cupones') then
      raise exception 'El cupón ya no es válido';
    end if;
    select * into v_cupon from cupones
     where tienda_id = v_tienda and codigo = v_cupon_cod
     for update;
    if not found or not v_cupon.activo
       or (v_cupon.vence is not null and v_cupon.vence < public.hoy_colombia())
       or (v_cupon.max_usos is not null and v_cupon.usos >= v_cupon.max_usos) then
      raise exception 'El cupón ya no es válido';
    end if;
    if v_cupon.minimo is not null and v_total < v_cupon.minimo then
      raise exception 'El cupón es para compras desde $%', replace(to_char(v_cupon.minimo, 'FM999,999,999'), ',', '.');
    end if;
    v_desc := case when v_cupon.tipo = 'pct' then round(v_total * v_cupon.valor / 100)
                   else least(v_cupon.valor, v_total) end;
    update cupones set usos = usos + 1 where id = v_cupon.id;
  end if;

  update pedidos
     set total = v_total - v_desc,
         cupon = case when v_desc > 0 or v_cupon_cod is not null then v_cupon_cod end,
         descuento = v_desc
   where id = v_pedido_id;
  return v_codigo;
end;
$$;

commit;
