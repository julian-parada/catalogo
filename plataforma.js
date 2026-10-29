// plataforma.js — panel del dueño de Exhibe Pro (plataforma.html).
// Toda la seguridad la pone el servidor: cada función revisa es_superadmin().
// Si otra persona abre esta página, solo ve "Sin permiso".

/* ---------- Precios (cámbialos aquí cuando quieras) ---------- */
const PRECIO_MES = 39900;
const PRECIOS = { 1: 39900, 3: 107700, 6: 215400, 12: 399000 };   // 3 y 6 meses: 10 % menos · 1 año: 2 meses gratis
const DIAS_AVISO = 5;            // "por vencer" cuando quedan estos días o menos
const URL_BASE = "https://exhibepro.pages.dev";

const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s ?? "");
const money = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
const fechaLarga = f => f ? new Date(String(f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "—";
const fechaCorta = f => f ? new Date(String(f).slice(0, 10) + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" }) : "—";
const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
function sumarMeses(iso, meses){
  const [a, m, d] = iso.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).getUTCDate();
  f.setUTCDate(Math.min(d, ultimo));
  return f.toISOString().slice(0, 10);
}
// Teléfono colombiano → número de WhatsApp (57 + 10 dígitos)
function numeroWa(tel){
  const n = String(tel || "").replace(/\D/g, "");
  return n.length === 10 ? "57" + n : n;
}

let tiendas = [];
let filtro = "todas";

/* =========================================================
   SESIÓN
   ========================================================= */
function mostrar(vista){
  ["vistaLogin", "vistaNoAutorizado", "vistaPanel"].forEach(v => { $(v).hidden = v !== vista; });
}

let usuarioActual = null;
async function iniciar(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  usuarioActual = session ? session.user.id : null;
  if(!session){ mostrar("vistaLogin"); $("email").focus(); return; }
  const { data: esDueno, error } = await supabaseClient.rpc("es_superadmin");
  if(error || !esDueno){ mostrar("vistaNoAutorizado"); return; }
  mostrar("vistaPanel");
  await cargar();
}

activarOjos();
$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const err = $("loginError"), btn = $("loginBtn");
  const espera = segundosBloqueo();
  if(espera > 0){ err.textContent = `Demasiados intentos. Espera ${textoEspera(espera)}.`; return; }
  const email = $("email").value.trim(), password = $("password").value;
  if(!email || !password){ err.textContent = "Escribe tu correo y tu contraseña."; return; }
  btn.disabled = true; err.textContent = "";
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  if(error){
    $("password").value = "";
    if(/invalid login|invalid credentials/i.test(error.message)){
      const s = registrarFallo();
      if(s > 0){ err.textContent = `Demasiados intentos. Espera ${textoEspera(s)}.`; return; }
    }
    err.textContent = errorAmigable(error);
    return;
  }
  limpiarIntentos();
  // Si en otra pestaña entras con otra cuenta (ej. el panel de un cliente), este panel se entera
// y deja de mostrar la lista vieja: así nunca intentas cambios con la cuenta equivocada.
supabaseClient.auth.onAuthStateChange((evento, session) => {
  const nuevo = session ? session.user.id : null;
  if(usuarioActual !== null && nuevo !== usuarioActual) iniciar();
});
window.addEventListener("focus", async () => {
  if($("vistaPanel").hidden) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if((session ? session.user.id : null) !== usuarioActual) iniciar();
});

// Si el servidor dice "No autorizado", la sesión ya no es la tuya: se vuelve a revisar
function revisarAutorizacion(error){
  if(error && /no autorizado/i.test(error.message || "")){
    toast("Tu sesión cambió a otra cuenta. Vuelve a entrar con la tuya.");
    iniciar();
    return true;
  }
  return false;
}

iniciar();
});

document.querySelectorAll("[data-salir]").forEach(b => b.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
}));

/* =========================================================
   DATOS
   ========================================================= */
async function cargar(){
  const { data, error } = await supabaseClient.rpc("plataforma_tiendas");
  if(revisarAutorizacion(error)) return;
  if(error){
    mensaje(/function .* does not exist|could not find/i.test(error.message)
      ? "Falta correr sql/006_panel_plataforma.sql en Supabase."
      : "No se pudieron cargar las tiendas: " + error.message, "error");
    $("tiendas").innerHTML = "";
    return;
  }
  tiendas = (data || []).map(t => ({ ...t, situacion: situacion(t) }));
  pintarResumen();
  pintarFiltros();
  pintarTiendas();
}

// activa · por-vencer · vencida · suspendida
function situacion(t){
  if(t.estado === "suspendido") return "suspendida";
  if(t.dias < 0 || !t.activa) return "vencida";
  if(t.dias <= DIAS_AVISO) return "por-vencer";
  return "activa";
}
const NOMBRE_SIT = { activa: "Activa", "por-vencer": "Por vencer", vencida: "Vencida", suspendida: "Suspendida" };

function mensaje(texto, tipo){
  const m = $("msg");
  m.hidden = !texto;
  m.textContent = texto || "";
  m.className = "pl-msg" + (tipo ? " " + tipo : "");
}
let tToast;
function toast(texto){
  const t = $("toast");
  t.textContent = texto;
  t.classList.add("ver");
  clearTimeout(tToast);
  tToast = setTimeout(() => t.classList.remove("ver"), 2600);
}

/* =========================================================
   RESUMEN
   ========================================================= */
function pintarResumen(){
  const cuenta = s => tiendas.filter(t => t.situacion === s).length;
  const cobrado = tiendas.reduce((a, t) => a + Number(t.pagado_mes || 0), 0);
  const tarjetas = [
    { n: cuenta("activa") + cuenta("por-vencer"), t: "Tiendas activas", c: "ok" },
    { n: cuenta("por-vencer"), t: `Vencen en ${DIAS_AVISO} días o menos`, c: "aviso" },
    { n: cuenta("vencida") + cuenta("suspendida"), t: "Vencidas o suspendidas", c: "mal" },
    { n: money(cobrado), t: "Cobrado este mes", c: "plata" }
  ];
  $("resumen").innerHTML = tarjetas.map(x => `
    <div class="pl-res ${x.c}"><strong>${x.n}</strong><span>${x.t}</span></div>`).join("");
}

function pintarFiltros(){
  const n = s => s === "todas" ? tiendas.length : tiendas.filter(t => t.situacion === s).length;
  const opciones = [["todas", "Todas"], ["activa", "Activas"], ["por-vencer", "Por vencer"], ["vencida", "Vencidas"], ["suspendida", "Suspendidas"]];
  $("filtros").innerHTML = opciones.map(([v, t]) => `
    <button type="button" class="pl-chip${filtro === v ? " on" : ""}" data-filtro="${v}" aria-pressed="${filtro === v}">${t} <b>${n(v)}</b></button>`).join("");
}
$("filtros").addEventListener("click", e => {
  const b = e.target.closest("[data-filtro]");
  if(!b) return;
  filtro = b.dataset.filtro;
  pintarFiltros();
  pintarTiendas();
});
$("buscar").addEventListener("input", pintarTiendas);

/* =========================================================
   TARJETAS DE TIENDAS
   ========================================================= */
function textoDias(t){
  if(t.situacion === "suspendida") return { grande: "Pausada", chico: `Pagada hasta el ${fechaLarga(t.vence)}` };
  if(t.dias < 0) return { grande: `Venció hace ${-t.dias} día${t.dias === -1 ? "" : "s"}`, chico: `El ${fechaLarga(t.vence)}` };
  if(t.dias === 0) return { grande: "Vence hoy", chico: fechaLarga(t.vence) };
  return { grande: `${t.dias} día${t.dias === 1 ? "" : "s"}`, chico: `Vence el ${fechaLarga(t.vence)}` };
}

function pintarTiendas(){
  const term = $("buscar").value.trim().toLowerCase();
  const lista = tiendas.filter(t =>
    (filtro === "todas" || t.situacion === filtro) &&
    (!term || [t.nombre, t.slug, t.contacto, t.admin_email, t.telefono].some(v => String(v || "").toLowerCase().includes(term))));

  if(!tiendas.length){ $("tiendas").innerHTML = `<p class="pl-vacio">Todavía no tienes tiendas. Crea la primera con <b>＋ Nueva tienda</b>.</p>`; return; }
  if(!lista.length){ $("tiendas").innerHTML = `<p class="pl-vacio">No hay tiendas con ese filtro.</p>`; return; }

  $("tiendas").innerHTML = lista.map(t => {
    const d = textoDias(t);
    const pct = t.situacion === "suspendida" || t.dias < 0 ? 0 : Math.min(100, Math.round(t.dias / 30 * 100));
    const pausada = t.estado === "suspendido";
    return `
    <article class="pl-tienda sit-${t.situacion}" data-id="${esc(t.id)}">
      <header>
        <div class="pl-t-nombre">
          <h3>${esc(t.nombre)}</h3>
          <a href="${esc(URL_BASE + "/" + encodeURIComponent(t.slug))}" target="_blank" rel="noopener">/${esc(t.slug)} ↗</a>
        </div>
        <span class="pl-estado">${NOMBRE_SIT[t.situacion]}</span>
      </header>

      <div class="pl-cuenta">
        <strong>${esc(d.grande)}</strong>
        <span>${esc(d.chico)}</span>
        <div class="pl-progreso"><i style="width:${pct}%"></i></div>
      </div>

      <dl class="pl-datos">
        <div><dt>Contacto</dt><dd>${esc(t.contacto)} · <a href="${esc(enlaceWhatsapp(numeroWa(t.telefono), ""))}" target="_blank" rel="noopener">${esc(t.telefono)}</a></dd></div>
        <div><dt>Usuario</dt><dd>${esc(t.admin_email || "— sin usuario —")}</dd></div>
        <div><dt>Productos</dt><dd>${t.productos}</dd></div>
        <div><dt>Pedidos (30 días)</dt><dd>${t.pedidos_30d}${t.ultimo_pedido ? ` · último ${fechaCorta(t.ultimo_pedido)}` : ""}</dd></div>
        <div><dt>Último pago</dt><dd>${t.ultimo_pago ? `${money(t.ultimo_monto)} · ${fechaCorta(t.ultimo_pago)}` : "Ninguno"}</dd></div>
        <div><dt>Total pagado</dt><dd>${money(t.total_pagado)}</dd></div>
      </dl>

      <div class="pl-acciones">
        <button type="button" class="pl-btn pl-btn-pri" data-accion="renovar">💳 Registrar pago</button>
        <a class="pl-btn pl-btn-wa" href="${esc(enlaceRecordatorio(t))}" target="_blank" rel="noopener">Recordar</a>
        <button type="button" class="pl-btn ${pausada ? "pl-btn-ok" : "pl-btn-mal"}" data-accion="${pausada ? "reactivar" : "suspender"}">${pausada ? "Reactivar" : "Suspender"}</button>
        <button type="button" class="pl-btn" data-accion="editar">Editar</button>
        <button type="button" class="pl-btn" data-accion="pagos">Pagos</button>
      </div>
    </article>`;
  }).join("");
}

// Mensaje de WhatsApp para recordarle al cliente el pago
function enlaceRecordatorio(t){
  const hola = `Hola ${String(t.contacto || "").split(" ")[0]} 👋`;
  let texto;
  if(t.situacion === "suspendida") texto = `${hola} Tu tienda *${t.nombre}* en Exhibe Pro está pausada. Cuando quieras reactivarla me escribes y la dejo funcionando de inmediato.`;
  else if(t.dias < 0) texto = `${hola} El plan de tu tienda *${t.nombre}* en Exhibe Pro venció el ${fechaLarga(t.vence)} y tus clientes ya no la pueden ver. Renuévalo y la activo enseguida. ¿Te envío los datos para el pago?`;
  else if(t.dias === 0) texto = `${hola} Te recuerdo que el plan de tu tienda *${t.nombre}* en Exhibe Pro vence hoy. ¿Te envío los datos para renovarlo y que no se apague?`;
  else texto = `${hola} Te recuerdo que el plan de tu tienda *${t.nombre}* en Exhibe Pro vence el ${fechaLarga(t.vence)} (en ${t.dias} día${t.dias === 1 ? "" : "s"}). El valor es ${money(PRECIO_MES)} al mes. ¿Te envío los datos para el pago?`;
  return enlaceWhatsapp(numeroWa(t.telefono), texto);
}

$("tiendas").addEventListener("click", async e => {
  const b = e.target.closest("[data-accion]");
  if(!b) return;
  const t = tiendas.find(x => x.id === b.closest("[data-id]").dataset.id);
  if(!t) return;
  const accion = b.dataset.accion;
  if(accion === "renovar") abrirRenovar(t);
  if(accion === "editar") abrirEditar(t);
  if(accion === "pagos") abrirPagos(t);
  if(accion === "suspender" || accion === "reactivar"){
    const suspender = accion === "suspender";
    if(suspender && !confirm(`¿Suspender "${t.nombre}"?\n\nSus clientes dejarán de ver la tienda hasta que la reactives. No se borra nada.`)) return;
    b.disabled = true;
    const { error } = await supabaseClient.rpc("plataforma_estado", { p_tienda: t.id, p_estado: suspender ? "suspendido" : "activo" });
    b.disabled = false;
    if(error){ if(!revisarAutorizacion(error)) toast("No se pudo: " + error.message); return; }
    toast(suspender ? `${t.nombre} quedó suspendida` : `${t.nombre} está activa otra vez`);
    cargar();
  }
});

/* =========================================================
   DIÁLOGOS
   ========================================================= */
document.querySelectorAll("dialog").forEach(d => {
  d.addEventListener("click", e => {
    if(e.target.closest("[data-cerrar]") || e.target === d) d.close();
  });
});

/* ---------- Registrar pago / renovar ---------- */
let tRenovar = null;
function mesesElegidos(){ return Number(document.querySelector('input[name="meses"]:checked').value); }
function previewRenovar(){
  const t = tRenovar;
  const desde = t.vence && String(t.vence).slice(0, 10) > hoyISO() ? String(t.vence).slice(0, 10) : hoyISO();
  const hasta = sumarMeses(desde, mesesElegidos());
  $("renNueva").innerHTML = `Quedará pagada hasta el <b>${fechaLarga(hasta)}</b>${t.estado === "suspendido" ? " y se <b>reactiva</b>" : ""}.`;
}
function abrirRenovar(t){
  tRenovar = t;
  $("renTitulo").textContent = t.nombre;
  $("renActual").textContent = t.dias >= 0
    ? `Hoy está pagada hasta el ${fechaLarga(t.vence)}: los meses nuevos se suman desde esa fecha.`
    : `Está vencida: los meses nuevos se cuentan desde hoy.`;
  document.querySelector('input[name="meses"][value="1"]').checked = true;
  $("renMonto").value = PRECIOS[1];
  $("renError").textContent = "";
  previewRenovar();
  $("dlgRenovar").showModal();
}
$("renMeses").addEventListener("change", () => {
  $("renMonto").value = PRECIOS[mesesElegidos()] ?? PRECIO_MES * mesesElegidos();
  previewRenovar();
});
$("formRenovar").addEventListener("submit", async e => {
  e.preventDefault();
  const monto = Number($("renMonto").value);
  if($("renMonto").value === "" || !(monto >= 0)){ $("renError").textContent = "Escribe el valor recibido (0 si es cortesía)."; return; }
  const btn = $("renGuardar");
  btn.disabled = true;
  const { data: hasta, error } = await supabaseClient.rpc("plataforma_renovar", {
    p_tienda: tRenovar.id, p_meses: mesesElegidos(), p_monto: monto, p_metodo: $("renMetodo").value
  });
  btn.disabled = false;
  if(error){ if(revisarAutorizacion(error)) $("dlgRenovar").close(); else $("renError").textContent = "No se pudo guardar: " + error.message; return; }
  $("dlgRenovar").close();
  toast(`${tRenovar.nombre}: pagada hasta el ${fechaLarga(hasta)}`);
  cargar();
});

/* ---------- Editar ---------- */
let tEditar = null;
function abrirEditar(t){
  tEditar = t;
  $("edTitulo").textContent = t.nombre;
  $("edNombre").value = t.nombre || "";
  $("edContacto").value = t.contacto || "";
  $("edTelefono").value = t.telefono || "";
  $("edVence").value = String(t.vence || "").slice(0, 10);
  $("edError").textContent = "";
  $("dlgEditar").showModal();
}
$("formEditar").addEventListener("submit", async e => {
  e.preventDefault();
  const datos = { p_tienda: tEditar.id, p_nombre: $("edNombre").value.trim(), p_contacto: $("edContacto").value.trim(),
                  p_telefono: $("edTelefono").value.trim(), p_vence: $("edVence").value };
  if(!datos.p_nombre || !datos.p_contacto || !datos.p_telefono || !datos.p_vence){ $("edError").textContent = "Llena todos los campos."; return; }
  $("edGuardar").disabled = true;
  const { error } = await supabaseClient.rpc("plataforma_editar", datos);
  $("edGuardar").disabled = false;
  if(error){ if(revisarAutorizacion(error)) $("dlgEditar").close(); else $("edError").textContent = "No se pudo guardar: " + error.message; return; }
  $("dlgEditar").close();
  toast("Cambios guardados");
  cargar();
});

/* ---------- Historial de pagos ---------- */
async function abrirPagos(t){
  $("pagTitulo").textContent = t.nombre;
  $("pagLista").innerHTML = `<p class="pl-vacio">Cargando…</p>`;
  $("dlgPagos").showModal();
  const { data, error } = await supabaseClient.rpc("plataforma_pagos", { p_tienda: t.id });
  if(error){ $("pagLista").innerHTML = `<p class="pl-error">${esc(error.message)}</p>`; return; }
  if(!data.length){ $("pagLista").innerHTML = `<p class="pl-vacio">Todavía no hay pagos registrados.</p>`; return; }
  const total = data.reduce((a, p) => a + Number(p.monto), 0);
  $("pagLista").innerHTML = data.map(p => `
    <div class="pl-pago">
      <div><strong>${money(p.monto)}</strong><span>${esc(p.metodo)} · ${esc(fechaLarga(p.fecha))}</span></div>
      <small>${esc(p.periodo)}</small>
    </div>`).join("") + `<div class="pl-pago-total"><span>Total</span><strong>${money(total)}</strong></div>`;
}

/* ---------- Nueva tienda ---------- */
const slugDe = txt => String(txt || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
let slugTocado = false;
$("btnNueva").addEventListener("click", () => {
  $("formNueva").reset();
  $("formNueva").hidden = false;
  $("nvListo").hidden = true;
  slugTocado = false;
  $("nvVence").value = sumarMeses(hoyISO(), 1);
  $("nvError").textContent = "";
  $("dlgNueva").showModal();
});
$("nvNombre").addEventListener("input", () => { if(!slugTocado) $("nvSlug").value = slugDe($("nvNombre").value); });
$("nvSlug").addEventListener("input", () => { slugTocado = true; });
$("nvSlug").addEventListener("blur", () => { $("nvSlug").value = slugDe($("nvSlug").value); });

$("formNueva").addEventListener("submit", async e => {
  e.preventDefault();
  const d = { p_nombre: $("nvNombre").value.trim(), p_slug: slugDe($("nvSlug").value), p_contacto: $("nvContacto").value.trim(),
              p_telefono: $("nvTelefono").value.trim(), p_email: $("nvEmail").value.trim().toLowerCase(), p_vence: $("nvVence").value };
  if(Object.values(d).some(v => !v)){ $("nvError").textContent = "Llena todos los campos."; return; }
  $("nvGuardar").disabled = true;
  const { error } = await supabaseClient.rpc("plataforma_crear_tienda", d);
  $("nvGuardar").disabled = false;
  if(error){
    const m = error.message || "";
    $("nvError").textContent = /No existe el usuario/i.test(m) ? "Ese correo no existe en Authentication. Créalo primero (paso 1)."
      : /ya administra/i.test(m) ? "Ese usuario ya tiene otra tienda."
      : /duplicate|unique|url_pagina/i.test(m) ? "Ese link ya lo usa otra tienda. Prueba otro."
      : "No se pudo crear: " + m;
    return;
  }
  const texto = `¡Hola ${d.p_contacto.split(" ")[0]}! Tu catálogo ${d.p_nombre} ya está listo 🎉

🛍️ Tu tienda: ${URL_BASE}/${d.p_slug}
⚙️ Tu panel: ${URL_BASE}/admin.html

Correo: ${d.p_email}
Contraseña temporal: (escríbela aquí)

Primeros pasos:
1. Entra al panel y cambia la contraseña (botón 🔑)
2. En "Mi tienda" pon tu WhatsApp, logo, colores y textos
3. Agrega tus productos en "Agregar producto"`;
  $("nvMensaje").value = texto;
  $("nvEnviar").href = enlaceWhatsapp(numeroWa(d.p_telefono), texto);
  $("formNueva").hidden = true;
  $("nvListo").hidden = false;
  cargar();
});
$("nvCopiar").addEventListener("click", async () => {
  try{ await navigator.clipboard.writeText($("nvMensaje").value); toast("Mensaje copiado"); }
  catch(e){ $("nvMensaje").select(); document.execCommand("copy"); toast("Mensaje copiado"); }
});

// Si en otra pestaña entras con otra cuenta (ej. el panel de un cliente), este panel se entera
// y deja de mostrar la lista vieja: así nunca intentas cambios con la cuenta equivocada.
supabaseClient.auth.onAuthStateChange((evento, session) => {
  const nuevo = session ? session.user.id : null;
  if(usuarioActual !== null && nuevo !== usuarioActual) iniciar();
});
window.addEventListener("focus", async () => {
  if($("vistaPanel").hidden) return;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if((session ? session.user.id : null) !== usuarioActual) iniciar();
});

// Si el servidor dice "No autorizado", la sesión ya no es la tuya: se vuelve a revisar
function revisarAutorizacion(error){
  if(error && /no autorizado/i.test(error.message || "")){
    toast("Tu sesión cambió a otra cuenta. Vuelve a entrar con la tuya.");
    iniciar();
    return true;
  }
  return false;
}

iniciar();
