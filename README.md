# Exhibe Pro — catálogos multi-tienda

Catálogo web con pedidos por WhatsApp para **cualquier tipo de negocio** (ropa, perfumes, joyas, accesorios…). **Un solo código y una sola base (Supabase) para todas las tiendas.**

Cada cliente tiene:

- Su link público: `https://exhibepro.pages.dev/?t=SLUG`
- Su panel: `https://exhibepro.pages.dev/admin.html` (entra con su correo y solo ve su tienda)

Publicado en **Cloudflare Pages** (`exhibepro.pages.dev`): cada cambio que se sube a `main` se publica solo.
Build command: `sh publicar.sh` · Output: `dist` (publica solo los archivos de la página).

Si una tienda se vence o se suspende, **el servidor deja de entregar su catálogo** y la página muestra "Servicio suspendido".

---

## ➕ Dar de alta un cliente nuevo

**1. Crear su usuario**
Supabase → **Authentication → Users → Add user → Create new user**
- Correo y contraseña del cliente
- Marca **Auto Confirm User**

**2. Crear la tienda** (Supabase → SQL Editor)

```sql
select crear_tienda(
  'moda-ana',          -- slug: va en el link ?t=  (minúsculas, números y guiones)
  'Moda Ana',          -- nombre del negocio
  'Ana Pérez',         -- contacto
  '3001234567',        -- teléfono
  '2026-12-24',        -- pagada hasta
  'ana@correo.com'     -- correo del usuario del paso 1
);
```

**3. Entregarle al cliente** (y pedirle que cambie la contraseña con el botón 🔑 al entrar)
- Link de su tienda: `https://exhibepro.pages.dev/?t=moda-ana`
- Panel: `https://exhibepro.pages.dev/admin.html` + su correo y contraseña

Él mismo pone nombre, WhatsApp, colores, letra, logo y productos desde **Mi tienda**. Cada producto puede tener opciones libres (ej. "S negro, M negro, XL azul" o "50 ml, 100 ml") y el comprador elige una.

---

## 🔐 Acceso y contraseñas

- El cliente entra en `admin.html` con su correo y la contraseña que le diste.
- **Cambiar contraseña:** botón 🔑 en el panel (pide la actual; cierra sus otras sesiones).
- **¿Olvidó la contraseña?:** en el login → le llega un link a su correo → `restablecer.html`.
- Contraseñas: mínimo 10 caracteres, letras y números, mayúscula o símbolo.
- 5 intentos fallidos seguidos bloquean el login 30 s, luego 1 min, 2 min… (hasta 15 min).

### Ajustes de seguridad en Supabase (una sola vez)

| Dónde | Qué |
|---|---|
| Authentication → URL Configuration | **Site URL:** `https://exhibepro.pages.dev/admin.html`<br>**Redirect URLs:** agregar `https://exhibepro.pages.dev/restablecer.html` |
| Authentication → Sign In / Providers | **Allow new users to sign up:** apagado |
| Authentication → Sign In / Providers → Email | **Minimum password length:** 10 · **Password requirements:** letras y números |
| Authentication → Emails → SMTP Settings | Conectar un servicio de correo (Resend o Brevo, gratis). **Sin esto los correos de recuperación no les llegan a los clientes** |
| Authentication → Emails → Templates → Reset Password | Texto en español (abajo) |

Plantilla del correo (Subject: `Restablece tu contraseña`):

```html
<h2>Restablece tu contraseña</h2>
<p>Recibimos una solicitud para cambiar la contraseña de tu tienda.</p>
<p><a href="{{ .ConfirmationURL }}">Crear una contraseña nueva</a></p>
<p>El link sirve una sola vez. Si no lo pediste, ignora este correo: tu contraseña sigue igual.</p>
```

**CAPTCHA (opcional):** pon la Site Key de Cloudflare Turnstile en `seguridad.js` y la Secret Key en
Authentication → Attack Protection. Hazlo el mismo día en los dos lados.

---

## 💰 Cobros

Todo está en la tabla `clientes` (Supabase → Table Editor):

| Quiero… | Hago… |
|---|---|
| Renovar un mes | Cambio `fecha_vencimiento` |
| Suspender ya | `estado` = `suspendido` |
| Reactivar | `estado` = `activo` y fecha al día |

Los pagos se registran en la tabla `pagos` (ligada a `clientes`).

Al cliente le aparece un aviso en su panel 5 días antes de vencer.

---

## 🗂️ Estructura

| Archivo | Qué hace |
|---|---|
| `tema.js` | Detecta la tienda (`?t=` o usuario logueado), carga su configuración y colores |
| `tienda.js` | Pinta textos, logo, banner y footer de la tienda |
| `script.js` | Catálogo, carrito y pedido por WhatsApp |
| `pedido.js` | Resumen del pedido (`pedido.html?t=...&codigo=...`) |
| `admin.js`, `agregarPrenda.js`, `editarPrenda.js`, `ajustes.js` | Panel del cliente |
| `seguridad.js`, `restablecer.html` | Reglas de contraseña, freno de intentos, CAPTCHA y recuperación |
| `privacidad.html` | Política de datos de cada tienda (Ley 1581), enlazada desde el carrito |
| `sql/001…004_*.sql` | Migraciones de la base (ya aplicadas, no volver a correr). La columna `tipo_opcion` de la 004 ya no se usa |

## 🔒 Seguridad

- Todo el aislamiento entre tiendas lo hace **Supabase (RLS)**, no el JavaScript.
- La key de `supabaseConfig.js` es la `anon` (pública por diseño).
- Las fotos de cada tienda van en su carpeta del bucket `imagenes-prendas/<id-tienda>/`.
