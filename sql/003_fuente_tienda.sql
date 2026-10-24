-- =====================================================================
-- 003_fuente_tienda.sql — cada tienda elige su estilo de letra
--
-- Correr UNA vez en Supabase → SQL Editor. No hay nada que cambiar.
-- Los nombres de los estilos (moderno, elegante, ...) están en tema.js.
-- =====================================================================

alter table public.configuracion
  add column if not exists fuente text not null default 'moderno'
  check (fuente ~ '^[a-z_]{1,30}$');
