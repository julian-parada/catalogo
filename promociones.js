// promociones.js — panel "Promociones": ventana al entrar a la tienda + cupones.
// Solo funciona si el superadmin activó el paquete (sql/013, tabla funciones_tienda).
// La base de datos lo vuelve a revisar en cada escritura (RLS), así que esta
// pantalla solo decide qué mostrar.

const $ = id => document.getElementById(id);
const BUCKET_PROMOS = "promos";
const MAX_LAMINAS = 5;
const MAX_VIDEO_MB = 15;
const MAX_VIDEO_SEG = 16;          // 15 s + un margen por redondeo del celular
const DESTINOS = { ofertas: "Productos en oferta", categoria: "Una categoría", producto: "Un producto", cerrar: "Solo cerrar la ventana" };

let tienda = null, funciones = {};
let ajustes = null, laminas = [], categorias = [], productos = [], cupones = [];
let sinGuardar = false;

const hoyISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
const fechaLarga = iso => new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long" });
const pesos = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");

function msg(id, texto, tipo){
  const m = $(id);
  m.className = "form-msg" + (tipo ? " " + tipo : "");
  m.textContent = texto;
  if(tipo === "ok") setTimeout(() => { if(m.textContent === texto) m.textContent = ""; }, 3500);
}

$("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.href = "admin.html";
});

/* =========================================================
   INICIO
   ========================================================= */
async function iniciar(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){ location.href = "admin.html"; return; }
  tienda = await window.tiendaActual;
  if(!tienda){ location.href = "admin.html"; return; }
  funciones = await window.funcionesTienda;
  $("prCargando").hidden = true;

  if(!funciones.promos && !funciones.cupones){
    const nombre = (await window.configTienda)?.nombre_tienda || tienda.nombre || tienda.slug;
    $("prPedirPaquete").href = enlaceWhatsapp(EXHIBE_PRO.whatsapp, `Hola, quiero activar las promociones y cupones en mi tienda ${nombre}.`);
    $("prSinPaquete").hidden = false;
    return;
  }
  $("prContenido").hidden = false;
  $("prVistaPrevia").href = linkTienda("index.html", { promo: "ver" });

  // Pestañas: la que no está en el paquete queda desactivada
  if(!funciones.promos){ $("tabVentana").disabled = true; $("tabVentana").textContent += " · no activa"; }
  if(!funciones.cupones){ $("tabCupones").disabled = true; $("tabCupones").textContent += " · no activa"; }
  abrirPestana(funciones.promos ? "ventana" : "cupones");

  if(funciones.promos){
    $("paqPromos").textContent = `Paquete activo hasta el ${fechaLarga(funciones.promos)}.`;
    await cargarVentana();
  }
  if(funciones.cupones){
    $("paqCupones").textContent = `Cupones activos hasta el ${fechaLarga(funciones.cupones)}.`;
    await cargarCupones();
  }
}

function abrirPestana(cual){
  const v = cual === "ventana";
  $("tabVentana").setAttribute("aria-selected", v);
  $("tabCupones").setAttribute("aria-selected", !v);
  $("panelVentana").hidden = !v;
  $("panelCupones").hidden = v;
}
$("tabVentana").addEventListener("click", () => abrirPestana("ventana"));
$("tabCupones").addEventListener("click", () => abrirPestana("cupones"));

/* =========================================================
   VENTANA DE PROMOCIONES
   ========================================================= */
async function cargarVentana(){
  const [aj, lam, cats, prods] = await Promise.all([
    supabaseClient.from("promo_ajustes").select("*").eq("tienda_id", tienda.id).maybeSingle(),
    supabaseClient.from("promociones").select("*").eq("tienda_id", tienda.id).order("orden").order("id"),
    supabaseClient.from("categorias").select("id, nombre").eq("tienda_id", tienda.id).order("nombre"),
    supabaseClient.from("prendas").select("id, nombre").eq("tienda_id", tienda.id).order("nombre")
  ]);
  if(lam.error){ msg("prMsg", "No se pudieron leer tus láminas: " + lam.error.message, "error"); return; }
  ajustes = aj.data || { encendida: true, desde: null, hasta: null, frecuencia: "dia", mostrar_cuenta: true };
  laminas = lam.data || [];
  categorias = cats.data || [];
  productos = prods.data || [];

  $("prEncendida").checked = ajustes.encendida !== false;
  $("prDesde").value = ajustes.desde || "";
  $("prHasta").value = ajustes.hasta || "";
  document.querySelector(`input[name="prFrecuencia"][value="${ajustes.frecuencia === "siempre" ? "siempre" : "dia"}"]`).checked = true;
  $("prCuentaFin").checked = ajustes.mostrar_cuenta !== false;
  $("prFechasAyuda").textContent = `Si las dejas vacías, se muestra mientras tengas el paquete (hasta el ${fechaLarga(funciones.promos)}).`;
  pintarLaminas();
}

function opcionesDestino(l){
  const lista = l.boton_destino === "categoria" ? categorias : l.boton_destino === "producto" ? productos : null;
  if(!lista) return "";
  if(!lista.length) return `<small class="pr-ayuda">No tienes ${l.boton_destino === "categoria" ? "categorías" : "productos"} todavía.</small>`;
  return `<select data-campo="destino_id" aria-label="Elige ${l.boton_destino === "categoria" ? "la categoría" : "el producto"}">
    ${lista.map(x => `<option value="${x.id}" ${String(x.id) === String(l.destino_id) ? "selected" : ""}>${escapeHtml(x.nombre)}</option>`).join("")}
  </select>`;
}

function pintarLaminas(){
  $("prCuenta").textContent = `(${laminas.length} de ${MAX_LAMINAS})`;
  const lleno = laminas.length >= MAX_LAMINAS;
  ["btnSubirImagen", "btnSubirVideo"].forEach(id => $(id).classList.toggle("desactivado", lleno));
  $("prImagen").disabled = lleno; $("prVideo").disabled = lleno;

  $("prLaminas").innerHTML = laminas.length ? laminas.map((l, i) => {
    const url = safeUrl(l.url) || "";
    return `
    <article class="pr-lamina" data-i="${i}">
      <div class="pr-media">
        ${l.tipo === "video"
          ? `<video src="${escapeHtml(url)}#t=0.5" muted playsinline preload="metadata"></video>`
          : `<img src="${escapeHtml(url)}" alt="Lámina ${i + 1}" loading="lazy">`}
        <span class="pr-tipo">${l.tipo === "video" ? "VIDEO" : "IMAGEN"}</span>
      </div>
      <div class="pr-lamina-campos">
        <label>Texto encima <small>(opcional)</small>
          <input type="text" data-campo="titulo" maxlength="80" value="${escapeHtml(l.titulo || "")}" placeholder="Ej: 50% en productos seleccionados">
        </label>
        <label>Texto del botón
          <input type="text" data-campo="boton_texto" maxlength="40" value="${escapeHtml(l.boton_texto || "")}" placeholder="Ver productos en oferta">
        </label>
        <label>El botón lleva a
          <select data-campo="boton_destino">
            ${Object.entries(DESTINOS).map(([k, v]) => `<option value="${k}" ${k === l.boton_destino ? "selected" : ""}>${v}</option>`).join("")}
          </select>
        </label>
        <div class="pr-destino">${opcionesDestino(l)}</div>
      </div>
      <div class="pr-lamina-btns">
        <button type="button" data-accion="subir" aria-label="Mover antes" ${i === 0 ? "disabled" : ""}>▲</button>
        <button type="button" data-accion="bajar" aria-label="Mover después" ${i === laminas.length - 1 ? "disabled" : ""}>▼</button>
        <button type="button" data-accion="borrar" class="pr-borrar" aria-label="Quitar lámina">🗑</button>
      </div>
    </article>`; }).join("")
    : `<p class="pr-vacio">Aún no tienes láminas. Sube una imagen o un video corto de tus ofertas.</p>`;
}

// Cambios en los campos de una lámina
$("prLaminas").addEventListener("input", e => {
  const card = e.target.closest(".pr-lamina"), campo = e.target.dataset.campo;
  if(!card || !campo) return;
  const l = laminas[Number(card.dataset.i)];
  l[campo] = campo === "destino_id" ? Number(e.target.value) : e.target.value;
  if(campo === "boton_destino"){
    const lista = l.boton_destino === "categoria" ? categorias : l.boton_destino === "producto" ? productos : [];
    l.destino_id = lista.length ? lista[0].id : null;
    card.querySelector(".pr-destino").innerHTML = opcionesDestino(l);
  }
  marcarCambio();
});
$("prLaminas").addEventListener("change", e => { if(e.target.matches("select")) e.target.dispatchEvent(new Event("input", { bubbles: true })); });

$("prLaminas").addEventListener("click", async e => {
  const b = e.target.closest("[data-accion]"); if(!b) return;
  const i = Number(b.closest(".pr-lamina").dataset.i);
  if(b.dataset.accion === "subir" && i > 0){ [laminas[i - 1], laminas[i]] = [laminas[i], laminas[i - 1]]; marcarCambio(); pintarLaminas(); }
  if(b.dataset.accion === "bajar" && i < laminas.length - 1){ [laminas[i + 1], laminas[i]] = [laminas[i], laminas[i + 1]]; marcarCambio(); pintarLaminas(); }
  if(b.dataset.accion === "borrar"){
    if(!confirm("¿Quitar esta lámina de la ventana de promociones?")) return;
    const l = laminas[i];
    const { error } = await supabaseClient.from("promociones").delete().eq("id", l.id).eq("tienda_id", tienda.id);
    if(error){ msg("prMsg", "No se pudo quitar: " + error.message, "error"); return; }
    borrarArchivoPromo(l.url);
    laminas.splice(i, 1);
    pintarLaminas();
    msg("prMsg", "Lámina quitada.", "ok");
  }
});

function marcarCambio(){ sinGuardar = true; msg("prMsg", "Tienes cambios sin guardar.", ""); }
["prEncendida", "prDesde", "prHasta", "prCuentaFin"].forEach(id => $(id).addEventListener("change", marcarCambio));
document.querySelectorAll('input[name="prFrecuencia"]').forEach(r => r.addEventListener("change", marcarCambio));
addEventListener("beforeunload", e => { if(sinGuardar){ e.preventDefault(); e.returnValue = ""; } });

/* ---------- Subir imagen o video ---------- */
function nombreArchivo(archivo, ext){
  return `${tienda.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}
async function subirArchivo(archivo, ext){
  const ruta = nombreArchivo(archivo, ext);
  const { error } = await supabaseClient.storage.from(BUCKET_PROMOS)
    .upload(ruta, archivo, { cacheControl: "31536000", contentType: archivo.type });
  if(error) throw error;
  return supabaseClient.storage.from(BUCKET_PROMOS).getPublicUrl(ruta).data.publicUrl;
}
async function borrarArchivoPromo(url){
  try{
    const marca = `/object/public/${BUCKET_PROMOS}/`;
    const i = String(url || "").indexOf(marca);
    if(i === -1) return;
    await supabaseClient.storage.from(BUCKET_PROMOS).remove([decodeURIComponent(url.slice(i + marca.length).split("?")[0])]);
  }catch(e){ /* si no se pudo borrar el archivo, la lámina igual ya no sale */ }
}
function duracionVideo(archivo){
  return new Promise(ok => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(archivo);
    v.preload = "metadata"; v.muted = true;
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); ok(v.duration); };
    v.onerror = () => { URL.revokeObjectURL(url); ok(NaN); };
    v.src = url;
    setTimeout(() => ok(NaN), 8000);
  });
}

async function agregarLamina(tipo, archivo){
  if(laminas.length >= MAX_LAMINAS){ msg("prMsg", `Máximo ${MAX_LAMINAS} láminas.`, "error"); return; }
  const aviso = $("prSubiendo");
  try{
    let ext;
    if(tipo === "imagen"){
      if(!/^image\/(jpeg|png|webp)$/.test(archivo.type)) throw new Error("La imagen debe ser JPG, PNG o WebP.");
      archivo = await comprimirImagen(archivo, 1080, 0.82);
      ext = archivo.type === "image/webp" ? "webp" : archivo.type === "image/png" ? "png" : "jpg";
    }else{
      if(!/^video\/(mp4|webm|quicktime)$/.test(archivo.type)) throw new Error("El video debe ser MP4, WebM o MOV.");
      if(archivo.size > MAX_VIDEO_MB * 1024 * 1024) throw new Error(`El video pesa ${(archivo.size / 1048576).toFixed(1)} MB. El máximo es ${MAX_VIDEO_MB} MB.`);
      const seg = await duracionVideo(archivo);
      if(!(seg > 0)) throw new Error("No se pudo leer el video. Prueba con otro (MP4).");
      if(seg > MAX_VIDEO_SEG) throw new Error(`El video dura ${Math.round(seg)} segundos. El máximo es 15.`);
      ext = archivo.type === "video/webm" ? "webm" : archivo.type === "video/quicktime" ? "mov" : "mp4";
    }
    aviso.hidden = false; aviso.textContent = tipo === "video" ? "Subiendo el video… no cierres esta página." : "Subiendo la imagen…";
    const url = await subirArchivo(archivo, ext);
    const orden = laminas.length ? Math.max(...laminas.map(l => l.orden || 0)) + 1 : 0;
    const { data, error } = await supabaseClient.from("promociones")
      .insert({ tienda_id: tienda.id, orden: Math.min(orden, 99), tipo, url, boton_destino: "ofertas" })
      .select().single();
    if(error){ borrarArchivoPromo(url); throw error; }
    laminas.push(data);
    pintarLaminas();
    msg("prMsg", tipo === "video" ? "Video agregado." : "Imagen agregada.", "ok");
  }catch(err){
    msg("prMsg", (/row-level security/i.test(err.message) ? "Tu paquete de promociones no está activo." : err.message) || "No se pudo subir.", "error");
  }finally{
    aviso.hidden = true;
  }
}
$("prImagen").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if(f) agregarLamina("imagen", f); });
$("prVideo").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if(f) agregarLamina("video", f); });

/* ---------- Guardar ---------- */
async function guardarVentana(){
  const desde = $("prDesde").value || null, hasta = $("prHasta").value || null;
  if(desde && hasta && hasta < desde){ msg("prMsg", "La fecha «Hasta» debe ser igual o después de «Desde».", "error"); return false; }
  $("prGuardar").disabled = true;
  try{
    const { error } = await supabaseClient.from("promo_ajustes").upsert({
      tienda_id: tienda.id,
      encendida: $("prEncendida").checked,
      desde, hasta,
      frecuencia: document.querySelector('input[name="prFrecuencia"]:checked').value,
      mostrar_cuenta: $("prCuentaFin").checked,
      actualizado: new Date().toISOString()
    }, { onConflict: "tienda_id" });
    if(error) throw error;
    for(let i = 0; i < laminas.length; i++){
      const l = laminas[i];
      const dest = l.boton_destino in DESTINOS ? l.boton_destino : "ofertas";
      const { error: e2 } = await supabaseClient.from("promociones").update({
        orden: i,
        titulo: (l.titulo || "").trim().slice(0, 80) || null,
        boton_texto: (l.boton_texto || "").trim().slice(0, 40) || null,
        boton_destino: dest,
        destino_id: dest === "categoria" || dest === "producto" ? (l.destino_id || null) : null
      }).eq("id", l.id).eq("tienda_id", tienda.id);
      if(e2) throw e2;
      l.orden = i;
    }
    sinGuardar = false;
    msg("prMsg", "¡Guardado! Así lo verán tus clientes.", "ok");
    return true;
  }catch(err){
    msg("prMsg", /row-level security/i.test(err.message) ? "Tu paquete de promociones no está activo." : "No se pudo guardar: " + err.message, "error");
    return false;
  }finally{
    $("prGuardar").disabled = false;
  }
}
$("prGuardar").addEventListener("click", guardarVentana);
$("prVistaPrevia").addEventListener("click", e => {
  if(sinGuardar){ e.preventDefault(); msg("prMsg", "Primero toca «Guardar» para ver los cambios en la vista previa.", "error"); }
});

/* =========================================================
   CUPONES
   ========================================================= */
async function cargarCupones(){
  const { data, error } = await supabaseClient.from("cupones").select("*").eq("tienda_id", tienda.id).order("creado", { ascending: false });
  if(error){ msg("cpMsg", "No se pudieron leer tus cupones: " + error.message, "error"); return; }
  cupones = data || [];
  pintarCupones();
}

function estadoCupon(c){
  if(c.vence && c.vence < hoyISO()) return ["Vencido", "vencido"];
  if(c.max_usos && c.usos >= c.max_usos) return ["Agotado", "vencido"];
  return c.activo ? ["Activo", "activo"] : ["Pausado", "pausado"];
}

function pintarCupones(){
  $("cpLista").innerHTML = cupones.length ? cupones.map((c, i) => {
    const [estado, clase] = estadoCupon(c);
    const reglas = [
      c.minimo ? `Desde ${pesos(c.minimo)}` : "Sin compra mínima",
      c.max_usos ? `máx. ${c.max_usos} usos` : null,
      c.vence ? `vence el ${fechaLarga(c.vence)}` : null
    ].filter(Boolean).join(" · ");
    return `
    <article class="cp-item" data-i="${i}">
      <div class="cp-cab">
        <span class="cp-codigo">${escapeHtml(c.codigo)}</span>
        <span class="cp-estado ${clase}">${estado}</span>
      </div>
      <strong class="cp-valor">${c.tipo === "pct" ? `${Number(c.valor)}% de descuento` : `${pesos(c.valor)} de descuento`}</strong>
      <small>${escapeHtml(reglas)}</small>
      <div class="cp-pie">
        <span>Usado ${c.max_usos ? `${c.usos} de ${c.max_usos}` : `${c.usos} ${c.usos === 1 ? "vez" : "veces"}`}</span>
        <span class="cp-btns">
          <label class="cp-activo"><input type="checkbox" class="pr-switch" data-accion="activo" ${c.activo ? "checked" : ""} aria-label="Cupón ${escapeHtml(c.codigo)} activo"></label>
          <button type="button" data-accion="borrar" class="pr-borrar" aria-label="Borrar cupón ${escapeHtml(c.codigo)}">🗑</button>
        </span>
      </div>
    </article>`; }).join("")
    : `<p class="pr-vacio">Todavía no tienes cupones. Crea el primero abajo.</p>`;
}

$("cpLista").addEventListener("change", async e => {
  if(e.target.dataset.accion !== "activo") return;
  const c = cupones[Number(e.target.closest(".cp-item").dataset.i)];
  const activo = e.target.checked;
  const { error } = await supabaseClient.from("cupones").update({ activo }).eq("id", c.id).eq("tienda_id", tienda.id);
  if(error){ e.target.checked = !activo; msg("cpMsg", "No se pudo cambiar: " + error.message, "error"); return; }
  c.activo = activo;
  pintarCupones();
  msg("cpMsg", activo ? `${c.codigo} activado.` : `${c.codigo} pausado.`, "ok");
});
$("cpLista").addEventListener("click", async e => {
  const b = e.target.closest('[data-accion="borrar"]'); if(!b) return;
  const i = Number(b.closest(".cp-item").dataset.i), c = cupones[i];
  if(!confirm(`¿Borrar el cupón ${c.codigo}? Los pedidos que ya lo usaron no cambian.`)) return;
  const { error } = await supabaseClient.from("cupones").delete().eq("id", c.id).eq("tienda_id", tienda.id);
  if(error){ msg("cpMsg", "No se pudo borrar: " + error.message, "error"); return; }
  cupones.splice(i, 1);
  pintarCupones();
  msg("cpMsg", "Cupón borrado.", "ok");
});

$("cpCodigo").addEventListener("input", e => {
  const limpio = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if(limpio !== e.target.value) e.target.value = limpio;
});
document.querySelectorAll('input[name="cpTipo"]').forEach(r => r.addEventListener("change", () => {
  const pct = r.value === "pct" && r.checked || document.querySelector('input[name="cpTipo"]:checked').value === "pct";
  $("cpValorTxt").textContent = pct ? "Porcentaje (1 a 90)" : "Valor en pesos";
  $("cpValor").placeholder = pct ? "Ej: 10" : "Ej: 10000";
}));

$("cpForm").addEventListener("submit", async e => {
  e.preventDefault();
  const codigo = $("cpCodigo").value.trim().toUpperCase();
  const tipo = document.querySelector('input[name="cpTipo"]:checked').value;
  const valor = Number($("cpValor").value);
  const minimo = $("cpMinimo").value === "" ? null : Number($("cpMinimo").value);
  const max_usos = $("cpMax").value === "" ? null : Math.floor(Number($("cpMax").value));
  const vence = $("cpVence").value || null;

  if(!/^[A-Z0-9]{3,20}$/.test(codigo)) return msg("cpMsg", "El código debe tener de 3 a 20 letras o números, sin espacios.", "error");
  if(tipo === "pct" && !(valor >= 1 && valor <= 90)) return msg("cpMsg", "El porcentaje debe estar entre 1 y 90.", "error");
  if(tipo === "fijo" && !(valor >= 1)) return msg("cpMsg", "Escribe el valor del descuento en pesos.", "error");
  if(minimo !== null && !(minimo >= 0)) return msg("cpMsg", "La compra mínima no puede ser negativa.", "error");
  if(max_usos !== null && !(max_usos >= 1)) return msg("cpMsg", "El máximo de usos debe ser 1 o más.", "error");
  if(vence && vence < hoyISO()) return msg("cpMsg", "La fecha de vencimiento ya pasó.", "error");
  if(cupones.some(c => c.codigo === codigo)) return msg("cpMsg", "Ya tienes un cupón con ese código.", "error");

  $("cpCrear").disabled = true;
  const { data, error } = await supabaseClient.from("cupones")
    .insert({ tienda_id: tienda.id, codigo, tipo, valor: tipo === "pct" ? Math.round(valor) : Math.round(valor), minimo, max_usos, vence })
    .select().single();
  $("cpCrear").disabled = false;
  if(error){
    msg("cpMsg", /cupones_codigo_uq|duplicate/i.test(error.message) ? "Ya tienes un cupón con ese código."
      : /row-level security/i.test(error.message) ? "Tu paquete de cupones no está activo."
      : "No se pudo crear: " + error.message, "error");
    return;
  }
  cupones.unshift(data);
  pintarCupones();
  e.target.reset();
  $("cpValorTxt").textContent = "Porcentaje (1 a 90)";
  msg("cpMsg", `Cupón ${codigo} creado. Compártelo con tus clientes.`, "ok");
});

iniciar();
