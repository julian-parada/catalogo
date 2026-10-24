-- =====================================================================
-- 001_multitienda.sql — convierte la base en MULTI-TIENDA
--
-- Correr UNA sola vez en Supabase → SQL Editor.
-- Todo va dentro de begin/commit: o se aplica completo o no se aplica nada.
--
-- Qué hace:
--   · La tabla `clientes` pasa a ser la tabla de tiendas (url_pagina = slug del link ?t=)
--   · Todas las tablas del catálogo y de pedidos reciben `tienda_id`
--   · Tus datos actuales quedan como la tienda #1
--   · Cada admin solo ve y edita SU tienda (RLS)
--   · Si una tienda está vencida o suspendida, su catálogo deja de cargar (servidor)
--   · Las imágenes de cada tienda van en su propia carpeta del bucket
--   · Función crear_tienda() para dar de alta clientes nuevos
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. DATOS DE TU TIENDA ACTUAL  ✏️ CAMBIA ESTOS 5 VALORES
-- ---------------------------------------------------------------------
create temp table _tienda1 on commit drop as
select
  'CAMBIAR'::text   as slug,             -- va en el link: ?t=slug  (minúsculas, números y guiones)
  'CAMBIAR'::text   as nombre_negocio,
  'CAMBIAR'::text   as nombre_contacto,
  'CAMBIAR'::text   as telefono,
  date '2099-12-31' as vence,            -- hasta cuándo está pagada
  null::uuid        as id;

-- Seguros antes de tocar nada
do $$
declare v _tienda1%rowtype;
begin
  select * into v from _tienda1;
  if 'CAMBIAR' in (v.slug, v.nombre_negocio, v.nombre_contacto, v.telefono) then
    raise exception 'Te faltó cambiar algún valor "CAMBIAR" del paso 0. No se cambió nada.';
  end if;
  if v.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El slug "%" no sirve: solo minúsculas, números y guiones (ej: gorras-ocana). No se cambió nada.', v.slug;
  end if;
  if current_setting('server_version_num')::int < 150000 then
    raise exception 'Tu Postgres es versión %, se necesita 15 o más. Avísale a Claude.', current_setting('server_version');
  end if;
  if (select count(*) from public.configuracion) > 1 then
    raise exception 'La tabla configuracion tiene más de una fila. Avísale a Claude antes de seguir.';
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'prendas' and column_name = 'tienda_id') then
    raise exception 'Esta migración ya se corrió antes (prendas ya tiene tienda_id). No se cambió nada.';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1. TIENDAS = tabla clientes
-- ---------------------------------------------------------------------
-- El slug solo puede tener minúsculas, números y guiones (las filas viejas no se revisan)
alter table public.clientes
  add constraint clientes_slug_formato
  check (url_pagina ~ '^[a-z0-9]+(-[a-z0-9]+)*$') not valid;

insert into public.clientes (nombre_negocio, nombre_contacto, telefono, url_pagina, estado, fecha_vencimiento)
select nombre_negocio, nombre_contacto, telefono, slug, 'activo', vence from _tienda1
on conflict (url_pagina) do update
  set estado = 'activo', fecha_vencimiento = excluded.fecha_vencimiento;

update _tienda1 t set id = c.id from public.clientes c where c.url_pagina = t.slug;

-- ---------------------------------------------------------------------
-- 2. ADMINS: cada admin pertenece a una tienda
-- ---------------------------------------------------------------------
alter table public.admins add column tienda_id uuid
  references public.clientes(id) on delete cascade;
update public.admins set tienda_id = (select id from _tienda1);
alter table public.admins alter column tienda_id set not null;

-- ---------------------------------------------------------------------
-- 3. FUNCIONES DE APOYO
-- ---------------------------------------------------------------------
-- Tienda del usuario logueado (null si no es admin de ninguna)
create or replace function public.mi_tienda()
returns uuid language sql stable security definer
set search_path = public as $$
  select tienda_id from public.admins where user_id = auth.uid();
$$;

-- Se mantiene por compatibilidad
create or replace function public.es_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.mi_tienda() is not null;
$$;

-- Tú (dueño de la plataforma)
create or replace function public.es_superadmin()
returns boolean language sql stable
set search_path = public as $$
  select coalesce(auth.uid() = '4d879ace-17f6-499a-a7eb-e9f229cab964'::uuid, false);
$$;

-- ¿La tienda está activa y al día? (fecha en hora de Colombia)
create or replace function public.tienda_activa(p_tienda uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.clientes c
    where c.id = p_tienda
      and c.estado = 'activo'
      and c.fecha_vencimiento >= (now() at time zone 'America/Bogota')::date
  );
$$;

-- Para el catálogo: slug del link → id de la tienda y si está activa
create or replace function public.tienda_publica(p_slug text)
returns table(id uuid, activa boolean)
language sql stable security definer
set search_path = public as $$
  select c.id, public.tienda_activa(c.id)
  from public.clientes c
  where c.url_pagina = lower(trim(p_slug));
$$;

-- Para el panel: la tienda del admin logueado
create or replace function public.mi_tienda_info()
returns table(id uuid, slug text, nombre text, activa boolean, vence date)
language sql stable security definer
set search_path = public as $$
  select c.id, c.url_pagina, c.nombre_negocio, public.tienda_activa(c.id), c.fecha_vencimiento
  from public.clientes c
  where c.id = public.mi_tienda();
$$;

-- ---------------------------------------------------------------------
-- 4. tienda_id EN TODAS LAS TABLAS
--    · Lo existente queda en la tienda #1
--    · Por defecto toma la tienda del admin logueado (el panel no tiene que mandarlo)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  v_tienda uuid := (select id from _tienda1);
begin
  foreach t in array array['categorias','prendas','tallas','imagenes_prenda','configuracion','pedidos','detalle_pedido'] loop
    execute format('alter table public.%I add column tienda_id uuid', t);
    execute format('update public.%I set tienda_id = %L', t, v_tienda);
    execute format('alter table public.%I alter column tienda_id set not null, alter column tienda_id set default public.mi_tienda()', t);
    execute format('alter table public.%I add constraint %I foreign key (tienda_id) references public.clientes(id) on delete restrict', t, t || '_tienda_fk');
    execute format('create index %I on public.%I (tienda_id)', t || '_tienda_idx', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. RELACIONES QUE NO DEJAN MEZCLAR TIENDAS
--    Una talla, imagen o categoría solo puede colgar de algo de SU MISMA tienda.
-- ---------------------------------------------------------------------
alter table public.prendas    add constraint prendas_id_tienda_uq    unique (id, tienda_id);
alter table public.categorias add constraint categorias_id_tienda_uq unique (id, tienda_id);
alter table public.pedidos    add constraint pedidos_id_tienda_uq    unique (id, tienda_id);

-- Quita las relaciones viejas (de una sola columna)
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tabla, conname
    from pg_constraint
    where contype = 'f'
      and ( (conrelid = 'public.tallas'::regclass          and confrelid = 'public.prendas'::regclass)
         or (conrelid = 'public.imagenes_prenda'::regclass and confrelid = 'public.prendas'::regclass)
         or (conrelid = 'public.prendas'::regclass         and confrelid = 'public.categorias'::regclass)
         or (conrelid = 'public.detalle_pedido'::regclass  and confrelid = 'public.pedidos'::regclass) )
  loop
    execute format('alter table %s drop constraint %I', r.tabla, r.conname);
  end loop;
end $$;

-- Y las vuelve a crear incluyendo la tienda
alter table public.tallas add constraint tallas_prenda_fk
  foreign key (prenda_id, tienda_id) references public.prendas(id, tienda_id) on delete cascade;

alter table public.imagenes_prenda add constraint imagenes_prenda_prenda_fk
  foreign key (prenda_id, tienda_id) references public.prendas(id, tienda_id) on delete cascade;

-- Si se borra la categoría, la prenda queda "sin categoría" (solo se vacía categoria_id)
alter table public.prendas add constraint prendas_categoria_fk
  foreign key (categoria_id, tienda_id) references public.categorias(id, tienda_id)
  on delete set null (categoria_id);

alter table public.detalle_pedido add constraint detalle_pedido_pedido_fk
  foreign key (pedido_id, tienda_id) references public.pedidos(id, tienda_id) on delete cascade;

-- ---------------------------------------------------------------------
-- 6. CONFIGURACIÓN: una fila por tienda
-- ---------------------------------------------------------------------
alter table public.configuracion alter column id add generated by default as identity;
select setval(pg_get_serial_sequence('public.configuracion', 'id'),
              greatest((select max(id) from public.configuracion), 1));
alter table public.configuracion add constraint configuracion_tienda_uq unique (tienda_id);

-- Si no había configuración, se crea la de la tienda #1
insert into public.configuracion (tienda_id, nombre_tienda)
select id, nombre_negocio from _tienda1
where not exists (select 1 from public.configuracion);

-- ---------------------------------------------------------------------
-- 7. PEDIDOS: ahora cada pedido queda en la tienda de sus prendas
--    (misma firma de antes: la página no cambia la llamada)
-- ---------------------------------------------------------------------
create or replace function public.crear_pedido(p_items jsonb)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_pedido_id integer;
  v_codigo    uuid;
  v_total     numeric := 0;
  v_item      jsonb;
  v_prenda    record;
  v_talla     record;
  v_cant      integer;
  v_precio    numeric;
  v_tienda    uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Pedido invalido';
  end if;

  -- La tienda sale de la primera prenda; todas las demás deben ser de la misma
  select tienda_id into v_tienda from prendas
  where id = (p_items->0->>'prenda_id')::bigint;
  if v_tienda is null then raise exception 'Prenda no existe'; end if;
  if not public.tienda_activa(v_tienda) then raise exception 'Tienda no disponible'; end if;

  insert into pedidos (total, tienda_id) values (0, v_tienda)
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

-- La verificación vieja (corría en el navegador y no tenía search_path) ya no se usa
drop function if exists public.verificar_suscripcion(text);

-- ---------------------------------------------------------------------
-- 8. CREAR TIENDAS NUEVAS (solo desde el SQL Editor)
--    Antes: crear el usuario del cliente en Authentication → Users
-- ---------------------------------------------------------------------
create or replace function public.crear_tienda(
  p_slug           text,
  p_nombre_negocio text,
  p_contacto       text,
  p_telefono       text,
  p_vence          date,
  p_email_admin    text
)
returns uuid language plpgsql security definer
set search_path = public as $$
declare
  v_tienda uuid;
  v_user   uuid;
begin
  p_slug := lower(trim(p_slug));
  if p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El slug "%" no sirve: solo minúsculas, números y guiones (ej: gorras-ocana)', p_slug;
  end if;

  select id into v_user from auth.users where lower(email) = lower(trim(p_email_admin));
  if v_user is null then
    raise exception 'No existe el usuario %. Créalo primero en Authentication → Users', p_email_admin;
  end if;
  if exists (select 1 from admins where user_id = v_user) then
    raise exception 'El usuario % ya administra otra tienda', p_email_admin;
  end if;

  insert into clientes (nombre_negocio, nombre_contacto, telefono, url_pagina, estado, fecha_vencimiento)
  values (p_nombre_negocio, p_contacto, p_telefono, p_slug, 'activo', p_vence)
  returning id into v_tienda;

  insert into configuracion (tienda_id, nombre_tienda) values (v_tienda, p_nombre_negocio);
  insert into admins (user_id, tienda_id) values (v_user, v_tienda);

  return v_tienda;
end;
$$;
revoke execute on function public.crear_tienda(text, text, text, text, date, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. POLÍTICAS (RLS)
-- ---------------------------------------------------------------------
-- Catálogo: lo ve cualquiera SI la tienda está activa (o si eres su admin);
--           solo el admin de esa tienda escribe
do $$
declare t text;
begin
  foreach t in array array['categorias','prendas','tallas','imagenes_prenda','configuracion'] loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('drop policy if exists "admin escribe" on public.%I', t);
    execute format($p$
      create policy "lectura publica" on public.%I for select to anon, authenticated
      using (public.tienda_activa(tienda_id) or tienda_id = (select public.mi_tienda()))
    $p$, t);
    execute format($p$
      create policy "admin escribe" on public.%I for all to authenticated
      using (tienda_id = (select public.mi_tienda()))
      with check (tienda_id = (select public.mi_tienda()))
    $p$, t);
  end loop;
end $$;

-- Pedidos: solo el admin de esa tienda (el público usa crear_pedido / obtener_pedido)
drop policy if exists "admin pedidos" on public.pedidos;
create policy "admin pedidos" on public.pedidos for all to authenticated
  using (tienda_id = (select public.mi_tienda()))
  with check (tienda_id = (select public.mi_tienda()));

drop policy if exists "admin detalle" on public.detalle_pedido;
create policy "admin detalle" on public.detalle_pedido for all to authenticated
  using (tienda_id = (select public.mi_tienda()))
  with check (tienda_id = (select public.mi_tienda()));

-- ---------------------------------------------------------------------
-- 10. STORAGE: cada tienda sube a su carpeta  imagenes-prendas/<tienda_id>/...
--     Las fotos se siguen viendo por su link público (el bucket es público).
--     Las fotos viejas (sin carpeta) las puede administrar el superadmin.
-- ---------------------------------------------------------------------
drop policy if exists "imagenes-prendas lectura" on storage.objects;
drop policy if exists "imagenes-prendas subir"   on storage.objects;
drop policy if exists "imagenes-prendas editar"  on storage.objects;
drop policy if exists "imagenes-prendas borrar"  on storage.objects;

-- Listar archivos: solo los de tu carpeta (ya no se pueden listar los de otras tiendas)
create policy "imagenes-prendas lectura" on storage.objects for select to authenticated
  using (bucket_id = 'imagenes-prendas'
         and ((storage.foldername(name))[1] = (select public.mi_tienda())::text
              or (select public.es_superadmin())));

create policy "imagenes-prendas subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'imagenes-prendas'
              and (storage.foldername(name))[1] = (select public.mi_tienda())::text);

create policy "imagenes-prendas editar" on storage.objects for update to authenticated
  using (bucket_id = 'imagenes-prendas'
         and ((storage.foldername(name))[1] = (select public.mi_tienda())::text
              or (select public.es_superadmin())))
  with check (bucket_id = 'imagenes-prendas'
              and (storage.foldername(name))[1] = (select public.mi_tienda())::text);

create policy "imagenes-prendas borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'imagenes-prendas'
         and ((storage.foldername(name))[1] = (select public.mi_tienda())::text
              or (select public.es_superadmin())));

-- Límite de tamaño y tipo del bucket: se configura en el panel de Supabase
-- (Storage → imagenes-prendas → Edit bucket), no aquí.

commit;
