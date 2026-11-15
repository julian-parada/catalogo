-- 013_promociones.sql — Funciones extra por tienda: ventana de promociones,
-- cupones de descuento y cuenta regresiva en las ofertas.
--
-- Cuidado con lo que ya funciona:
--   · Todo va en TABLAS NUEVAS. Las existentes no cambian, salvo dos columnas
--     opcionales en "pedidos" (cupon, descuento) con valor por defecto.
--   · Por defecto NINGUNA tienda tiene estas funciones: solo el superadmin las
--     activa, por tienda y por fechas (desde / hasta). Al pasar "hasta" se apagan.
--   · La dueña administra sus láminas y cupones, pero no puede activarse el paquete.
--   · El cupón se valida en el servidor al crear el pedido.
--
-- Se puede correr más de una vez. Requiere 006 (hoy_colombia, exigir_superadmin) y 012.

begin;

-- =====================================================================
-- 1. FUNCIONES ACTIVADAS POR TIENDA (solo el superadmin las escribe)
-- =====================================================================
create table if not exists public.funciones_tienda (
  tienda_id   uuid not null references public.clientes(id) on delete cascade,
  funcion     text not null,
  desde       date not null,
  hasta       date not null,
  actualizado timestamptz not null default now(),
  primary key (tienda_id, funcion),
  constraint funciones_tienda_funcion check (funcion in ('promos', 'cupones', 'cuenta')),
  constraint funciones_tienda_fechas  check (hasta >= desde)
);
alter table public.funciones_tienda enable row level security;
revoke all on public.funciones_tienda from anon, authenticated;   -- solo por las funciones de abajo

-- ¿La función está activa hoy (hora de Colombia) para esa tienda?
create or replace function public.funcion_activa(p_tienda uuid, p_funcion text)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.funciones_tienda f
     where f.tienda_id = p_tienda and f.funcion = p_funcion
       and public.hoy_colombia() between f.desde and f.hasta);
$$;

-- Para la tienda y el panel: { "promos": "2026-11-30", ... } con las activas hoy
create or replace function public.funciones_activas(p_tienda uuid)
returns jsonb language sql stable security definer
set search_path = public as $$
  select coalesce(jsonb_object_agg(f.funcion, f.hasta), '{}'::jsonb)
    from public.funciones_tienda f
   where f.tienda_id = p_tienda
     and public.hoy_colombia() between f.desde and f.hasta
     and public.tienda_activa(p_tienda);
$$;

-- Superadmin: ver las funciones (activas o no) de una tienda
create or replace function public.plataforma_funciones(p_tienda uuid)
returns table(funcion text, desde date, hasta date)
language plpgsql stable security definer
set search_path = public as $$
begin
  perform public.exigir_superadmin();
  return query select f.funcion, f.desde, f.hasta from public.funciones_tienda f where f.tienda_id = p_tienda;
end;
$$;

-- Superadmin: activar (con fechas) o quitar (p_desde null) una función
create or replace function public.plataforma_funcion_guardar(p_tienda uuid, p_funcion text, p_desde date, p_hasta date)
returns void language plpgsql security definer
set search_path = public as $$
begin
  perform public.exigir_superadmin();
  if p_funcion not in ('promos', 'cupones', 'cuenta') then raise exception 'Función desconocida'; end if;
  if not exists (select 1 from public.clientes where id = p_tienda) then raise exception 'No existe esa tienda'; end if;
  if p_desde is null then
    delete from public.funciones_tienda where tienda_id = p_tienda and funcion = p_funcion;
    return;
  end if;
  if p_hasta is null or p_hasta < p_desde then raise exception 'La fecha «hasta» debe ser igual o posterior a «desde»'; end if;
  insert into public.funciones_tienda (tienda_id, funcion, desde, hasta)
  values (p_tienda, p_funcion, p_desde, p_hasta)
  on conflict (tienda_id, funcion) do update set desde = excluded.desde, hasta = excluded.hasta, actualizado = now();
end;
$$;

revoke execute on function public.funcion_activa(uuid, text) from public;
revoke execute on function public.funciones_activas(uuid) from public;
revoke execute on function public.plataforma_funciones(uuid) from public, anon;
revoke execute on function public.plataforma_funcion_guardar(uuid, text, date, date) from public, anon;
grant execute on function public.funcion_activa(uuid, text) to anon, authenticated;
grant execute on function public.funciones_activas(uuid) to anon, authenticated;
grant execute on function public.plataforma_funciones(uuid) to authenticated;
grant execute on function public.plataforma_funcion_guardar(uuid, text, date, date) to authenticated;

-- =====================================================================
-- 2. VENTANA DE PROMOCIONES
-- =====================================================================
create table if not exists public.promo_ajustes (
  tienda_id      uuid primary key references public.clientes(id) on delete cascade,
  encendida      boolean not null default true,
  desde          date,
  hasta          date,
  frecuencia     text not null default 'dia',
  mostrar_cuenta boolean not null default true,
  actualizado    timestamptz not null default now(),
  constraint promo_ajustes_frecuencia check (frecuencia in ('dia', 'siempre')),
  constraint promo_ajustes_fechas     check (desde is null or hasta is null or hasta >= desde)
);

create table if not exists public.promociones (
  id            bigint generated by default as identity primary key,
  tienda_id     uuid not null references public.clientes(id) on delete cascade,
  orden         smallint not null default 0,
  tipo          text not null,
  url           text not null,
  titulo        text,
  boton_texto   text,
  boton_destino text not null default 'ofertas',
  destino_id    bigint,
  creado        timestamptz not null default now(),
  constraint promociones_tipo    check (tipo in ('imagen', 'video')),
  constraint promociones_url     check (url ~ '^https://' and char_length(url) <= 1000),
  constraint promociones_titulo  check (titulo is null or char_length(titulo) <= 80),
  constraint promociones_boton   check (boton_texto is null or char_length(boton_texto) <= 40),
  constraint promociones_destino check (boton_destino in ('ofertas', 'categoria', 'producto', 'cerrar')),
  constraint promociones_orden   check (orden between 0 and 99)
);
create index if not exists promociones_tienda_idx on public.promociones (tienda_id, orden);

-- Máximo 5 láminas por tienda
create or replace function public.promociones_maximo()
returns trigger language plpgsql
set search_path = public as $$
begin
  if (select count(*) from public.promociones where tienda_id = new.tienda_id) >= 5 then
    raise exception 'Máximo 5 láminas';
  end if;
  return new;
end;
$$;
drop trigger if exists promociones_maximo on public.promociones;
create trigger promociones_maximo before insert on public.promociones
  for each row execute function public.promociones_maximo();

alter table public.promo_ajustes enable row level security;
alter table public.promociones   enable row level security;

drop policy if exists "promo_ajustes leer"     on public.promo_ajustes;
drop policy if exists "promo_ajustes escribir" on public.promo_ajustes;
drop policy if exists "promociones leer"       on public.promociones;
drop policy if exists "promociones escribir"   on public.promociones;

-- Leer: el público solo si la tienda tiene la función activa; la dueña siempre lo suyo
create policy "promo_ajustes leer" on public.promo_ajustes for select to anon, authenticated
  using ((select public.funcion_activa(tienda_id, 'promos')) or tienda_id = (select public.mi_tienda()));
create policy "promociones leer" on public.promociones for select to anon, authenticated
  using ((select public.funcion_activa(tienda_id, 'promos')) or tienda_id = (select public.mi_tienda()));
-- Escribir: la dueña, en su tienda y solo con el paquete activo
create policy "promo_ajustes escribir" on public.promo_ajustes for all to authenticated
  using (tienda_id = (select public.mi_tienda()) and (select public.funcion_activa(tienda_id, 'promos')))
  with check (tienda_id = (select public.mi_tienda()) and (select public.funcion_activa(tienda_id, 'promos')));
create policy "promociones escribir" on public.promociones for all to authenticated
  using (tienda_id = (select public.mi_tienda()) and (select public.funcion_activa(tienda_id, 'promos')))
  with check (tienda_id = (select public.mi_tienda()) and (select public.funcion_activa(tienda_id, 'promos')));

revoke all on public.promo_ajustes, public.promociones from anon, authenticated;
grant select on public.promo_ajustes, public.promociones to anon;
grant select, insert, update, delete on public.promo_ajustes, public.promociones to authenticated;

-- Fotos y videos de las promociones: bucket propio (máx. 15 MB, solo imagen/video)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promos', 'promos', true, 15728640,
        array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "promos subir"  on storage.objects;
drop policy if exists "promos leer"   on storage.objects;
drop policy if exists "promos borrar" on storage.objects;
create policy "promos leer" on storage.objects for select to authenticated
  using (bucket_id = 'promos' and (storage.foldername(name))[1] = (select public.mi_tienda())::text);
create policy "promos subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'promos'
              and (storage.foldername(name))[1] = (select public.mi_tienda())::text
              and (select public.funcion_activa(public.mi_tienda(), 'promos')));
create policy "promos borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'promos' and (storage.foldername(name))[1] = (select public.mi_tienda())::text);

-- =====================================================================
-- 3. CUPONES
-- =====================================================================
create table if not exists public.cupones (
  id        bigint generated by default as identity primary key,
  tienda_id uuid not null references public.clientes(id) on delete cascade,
  codigo    text not null,
  tipo      text not null,
  valor     numeric not null,
  minimo    numeric,
  max_usos  integer,
  usos      integer not null default 0,
  vence     date,
  activo    boolean not null default true,
  creado    timestamptz not null default now(),
  constraint cupones_codigo_uq unique (tienda_id, codigo),
  constraint cupones_codigo    check (codigo ~ '^[A-Z0-9]{3,20}$'),
  constraint cupones_tipo      check (tipo in ('pct', 'fijo')),
  constraint cupones_valor     check ((tipo = 'pct' and valor between 1 and 90) or (tipo = 'fijo' and valor between 1 and 100000000)),
  constraint cupones_minimo    check (minimo is null or minimo between 0 and 1000000000),
  constraint cupones_max_usos  check (max_usos is null or max_usos between 1 and 1000000),
  constraint cupones_usos      check (usos >= 0)
);
alter table public.cupones enable row level security;
drop policy if exists "cupones leer"     on public.cupones;
drop policy if exists "cupones escribir" on public.cupones;
-- El público NO puede listar cupones: solo se validan con validar_cupon()
create policy "cupones leer" on public.cupones for select to authenticated
  using (tienda_id = (select public.mi_tienda()));
create policy "cupones escribir" on public.cupones for all to authenticated
  using (tienda_id = (select public.mi_tienda()) and (select public.funcion_activa(tienda_id, 'cupones')))
  with check (tienda_id = (select public.mi_tienda()) and (select public.funcion_activa(tienda_id, 'cupones')));
revoke all on public.cupones from anon, authenticated;
grant select, insert, update, delete on public.cupones to authenticated;

-- Para el carrito: ¿sirve este cupón? (no descuenta usos; eso lo hace crear_pedido)
create or replace function public.validar_cupon(p_tienda uuid, p_codigo text, p_subtotal numeric)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_cod text := upper(left(btrim(coalesce(p_codigo, '')), 20));
  c     record;
begin
  if v_cod = '' or not public.tienda_activa(p_tienda) or not public.funcion_activa(p_tienda, 'cupones') then
    return jsonb_build_object('ok', false, 'motivo', 'Ese cupón no existe o ya venció.');
  end if;
  select * into c from public.cupones where tienda_id = p_tienda and codigo = v_cod;
  if not found or not c.activo
     or (c.vence is not null and c.vence < public.hoy_colombia())
     or (c.max_usos is not null and c.usos >= c.max_usos) then
    return jsonb_build_object('ok', false, 'motivo', 'Ese cupón no existe o ya venció.');
  end if;
  return jsonb_build_object('ok', true, 'codigo', c.codigo, 'tipo', c.tipo, 'valor', c.valor, 'minimo', c.minimo,
    'cumple_minimo', c.minimo is null or coalesce(p_subtotal, 0) >= c.minimo);
end;
$$;
revoke execute on function public.validar_cupon(uuid, text, numeric) from public;
grant execute on function public.validar_cupon(uuid, text, numeric) to anon, authenticated;

-- =====================================================================
-- 4. PEDIDOS: cupón usado y descuento (columnas nuevas, opcionales)
-- =====================================================================
alter table public.pedidos
  add column if not exists cupon     text,
  add column if not exists descuento numeric not null default 0;
do $$ begin
  alter table public.pedidos add constraint pedidos_cupon_largo check (cupon is null or char_length(cupon) <= 20);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pedidos add constraint pedidos_descuento_valido check (descuento >= 0);
exception when duplicate_object then null; end $$;

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
  if v_pago is null or v_pago not in ('efectivo', 'nequi', 'transferencia', 'addi', 'sistecredito') then
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

  -- Crédito (Addi / Sistecrédito): solo si esta tienda lo acepta
  if v_pago in ('addi', 'sistecredito') and not exists (
       select 1 from configuracion c where c.tienda_id = v_tienda
          and case v_pago when 'addi' then c.pago_addi else c.pago_sistecredito end) then
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

create or replace function public.obtener_pedido(p_codigo uuid)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'creado_en',      p.creado_en,
    'total',          p.total,
    'cliente_nombre', p.cliente_nombre,
    'entrega',        p.entrega,
    'pago',           p.pago,
    'cupon',          p.cupon,
    'descuento',      p.descuento,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nombre', d.nombre, 'talla', d.talla,
        'precio_unitario', d.precio_unitario,
        'cantidad', d.cantidad, 'imagen', d.imagen,
        'personalizacion', d.personalizacion
      ) order by d.id)
      from detalle_pedido d where d.pedido_id = p.id
    ), '[]'::jsonb)
  )
  from pedidos p where p.codigo = p_codigo;
$$;

commit;
