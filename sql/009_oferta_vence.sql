-- 009_oferta_vence.sql — Las promociones duran 10 días y se vencen solas.
--
-- Qué hace:
--   1. Agrega a "prendas" la columna oferta_hasta (hasta cuándo vale el precio de oferta).
--   2. Un trigger la llena solo: cuando se pone o se cambia el precio de oferta, vale 10 días
--      desde ese momento. Si se quita la oferta, queda vacía.
--   3. Las ofertas que ya existen arrancan sus 10 días desde hoy.
--   4. crear_pedido cobra el precio normal si la oferta ya venció (nadie puede pedir con
--      un descuento vencido aunque tenga la página abierta desde antes).
--
-- Cómo usarlo: Supabase → SQL Editor → pegar todo → Run. Se puede correr más de una vez.

begin;

alter table public.prendas add column if not exists oferta_hasta timestamptz;

create or replace function public.fijar_oferta_hasta()
returns trigger language plpgsql
set search_path = public as $$
declare
  dias constant integer := 10;   -- días que dura una promoción
begin
  if nullif(new.precio_oferta, 0) is null then
    new.oferta_hasta := null;
  elsif tg_op = 'INSERT'
     or old.precio_oferta is distinct from new.precio_oferta
     or old.oferta_hasta is null
     or old.oferta_hasta <= now() then
    -- oferta nueva, cambiada, o una vencida que se vuelve a guardar: 10 días desde ahora
    new.oferta_hasta := now() + make_interval(days => dias);
  else
    new.oferta_hasta := old.oferta_hasta;   -- nadie la estira a mano
  end if;
  return new;
end;
$$;

drop trigger if exists prendas_oferta_hasta on public.prendas;
create trigger prendas_oferta_hasta
  before insert or update of precio_oferta, oferta_hasta on public.prendas
  for each row execute function public.fijar_oferta_hasta();

-- Ofertas que ya estaban puestas: 10 días desde hoy
update public.prendas
   set oferta_hasta = now() + interval '10 days'
 where nullif(precio_oferta, 0) is not null and oferta_hasta is null;

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

    -- La oferta solo cuenta mientras no haya vencido (oferta_hasta)
    v_precio := case
      when nullif(v_prenda.precio_oferta, 0) is not null
       and (v_prenda.oferta_hasta is null or v_prenda.oferta_hasta > now())
      then v_prenda.precio_oferta
      else v_prenda.precio
    end;
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

commit;
