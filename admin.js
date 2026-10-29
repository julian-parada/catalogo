// ============================================================
// admin.js — Panel de administración
// ============================================================

let categoriasCache = [];
let prendasCache = [];
let listenersRegistrados = false;

// ---------- SESIÓN ----------
async function revisarSesion(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session) mostrarPanel();
}

// ---------- LOGIN ----------
const $id = id => document.getElementById(id);
let captchaLogin = SIN_CAPTCHA, captchaOlvide = SIN_CAPTCHA;
let relojBloqueo;

activarOjos();
prepararCaptcha($id("captchaLogin")).then(c => { captchaLogin = c; });

// Mensaje al volver de restablecer la contraseña
if(new URLSearchParams(location.search).get("clave") === "ok"){
  $id("loginOk").textContent = "✓ Contraseña cambiada. Ya puedes entrar con la nueva.";
  history.replaceState(null, "", location.pathname);
}

// Si hay demasiados fallos, el botón queda bloqueado con cuenta regresiva
function mostrarBloqueo(){
  const btn = $id("loginBtn");
  const tick = () => {
    const seg = segundosBloqueo();
    if(seg <= 0){
      clearInterval(relojBloqueo);
      btn.disabled = false;
      $id("loginError").textContent = "";
      return;
    }
    btn.disabled = true;
    $id("loginError").textContent = `Demasiados intentos fallidos. Espera ${textoEspera(seg)} para volver a intentar.`;
  };
  clearInterval(relojBloqueo);
  tick();
  relojBloqueo = setInterval(tick, 1000);
}
if(segundosBloqueo() > 0) mostrarBloqueo();

$id("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if(segundosBloqueo() > 0){ mostrarBloqueo(); return; }

  const email    = $id("email").value.trim().toLowerCase();
  const password = $id("password").value;
  const errorBox = $id("loginError");
  const btn      = $id("loginBtn");
  $id("loginOk").textContent = "";
  if(!email || !password){ errorBox.textContent = "Escribe tu correo y tu contraseña."; return; }

  btn.disabled = true;
  const { error } = await supabaseClient.auth.signInWithPassword({
    email, password, options: { captchaToken: captchaLogin.token() }
  });
  captchaLogin.reiniciar();

  if(error){
    btn.disabled = false;
    $id("password").value = "";
    if(/invalid login|invalid credentials/i.test(error.message)){
      const espera = registrarFallo();
      if(espera > 0){ mostrarBloqueo(); return; }
    }
    errorBox.textContent = errorAmigable(error);
    return;
  }
  limpiarIntentos();
  errorBox.textContent = "";
  // Se recarga para que tema.js lea la tienda de este usuario
  location.reload();
});

// ---------- OLVIDÉ MI CONTRASEÑA ----------
function verOlvide(ver){
  $id("loginForm").hidden = ver;
  $id("olvideForm").hidden = !ver;
  if(ver){
    $id("olvideEmail").value = $id("email").value.trim();
    $id("olvideError").textContent = "";
    $id("olvideOk").textContent = "";
    if(captchaOlvide === SIN_CAPTCHA) prepararCaptcha($id("captchaOlvide")).then(c => { captchaOlvide = c; });
    $id("olvideEmail").focus();
  }else{
    $id("email").focus();
  }
}
$id("irOlvide").addEventListener("click", () => verOlvide(true));
$id("volverLogin").addEventListener("click", () => verOlvide(false));

$id("olvideForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $id("olvideEmail").value.trim().toLowerCase();
  const errorBox = $id("olvideError"), okBox = $id("olvideOk"), btn = $id("olvideBtn");
  errorBox.textContent = ""; okBox.textContent = "";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ errorBox.textContent = "Escribe un correo válido."; return; }

  btn.disabled = true;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: urlRestablecer(),
    captchaToken: captchaOlvide.token()
  });
  captchaOlvide.reiniciar();

  // Por seguridad, la respuesta es la misma exista o no el correo
  // (solo se muestran errores de límite de envíos, captcha o conexión)
  if(error && /rate limit|too many|security purposes|captcha|network|fetch/i.test(error.message)){
    btn.disabled = false;
    errorBox.textContent = errorAmigable(error);
    return;
  }
  okBox.textContent = "Si ese correo tiene una cuenta, te llegará un link en unos minutos. Revisa también la carpeta de spam. El link sirve una sola vez.";
  // Evita reenvíos seguidos
  setTimeout(() => { btn.disabled = false; }, 60000);
});

// ---------- CAMBIAR CONTRASEÑA (dentro del panel) ----------
const dialogo = $id("claveDialog");
function cerrarDialogo(){ if(dialogo.open) dialogo.close(); }

$id("cambiarClaveBtn").addEventListener("click", () => {
  $id("claveForm").reset();
  $id("claveError").textContent = "";
  pintarFuerza($id("claveFuerza"), "", "");
  activarOjos(dialogo);
  if(typeof dialogo.showModal === "function") dialogo.showModal(); else dialogo.setAttribute("open", "");
  $id("claveActual").focus();
});
$id("claveCerrar").addEventListener("click", cerrarDialogo);
dialogo.addEventListener("click", e => { if(e.target === dialogo) cerrarDialogo(); });

$id("claveNueva").addEventListener("input", async e => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  pintarFuerza($id("claveFuerza"), e.target.value, session && session.user.email);
});

$id("claveForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errorBox = $id("claveError"), btn = $id("claveGuardar");
  const actual = $id("claveActual").value;
  const nueva = $id("claveNueva").value;
  const repetir = $id("claveRepetir").value;
  errorBox.textContent = "";

  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){ location.reload(); return; }
  const correo = session.user.email;

  if(!actual){ errorBox.textContent = "Escribe tu contraseña actual."; return; }
  if(!contrasenaValida(nueva, correo)){ errorBox.textContent = "La contraseña nueva no cumple todos los requisitos."; return; }
  if(nueva !== repetir){ errorBox.textContent = "Las dos contraseñas nuevas no coinciden."; return; }
  if(nueva === actual){ errorBox.textContent = "La nueva debe ser distinta a la actual."; return; }

  btn.disabled = true;
  // 1) Confirmar que sabe la contraseña actual (si alguien encontró el panel abierto, no puede cambiarla)
  const { error: errActual } = await supabaseClient.auth.signInWithPassword({ email: correo, password: actual });
  if(errActual){
    btn.disabled = false;
    errorBox.textContent = /invalid/i.test(errActual.message) ? "La contraseña actual no es correcta." : errorAmigable(errActual);
    return;
  }
  // 2) Guardar la nueva
  const { error } = await supabaseClient.auth.updateUser({ password: nueva });
  if(error){ btn.disabled = false; errorBox.textContent = errorAmigable(error); return; }
  // 3) Cerrar las sesiones de otros dispositivos
  if($id("cerrarOtras").checked) await supabaseClient.auth.signOut({ scope: "others" });

  btn.disabled = false;
  cerrarDialogo();
  avisar("✓ Contraseña cambiada.");
});

// ---------- LOGOUT ----------
$id("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

// ---------- MOSTRAR PANEL ----------
async function mostrarPanel(){
  const tienda = await window.tiendaActual;
  if(!tienda){
    alert("Tu usuario no tiene una tienda asignada. Escríbele al administrador de la plataforma.");
    await supabaseClient.auth.signOut();
    location.reload();
    return;
  }
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("panel").style.display = "block";
  avisoSuscripcion(tienda);
  avisoPrimerosPasos();
  // Viene del botón 🔑 de otra página del panel
  if(location.hash === "#cambiar-clave"){
    history.replaceState(null, "", location.pathname);
    document.getElementById("cambiarClaveBtn").click();
  }
  await cargarPrendas();
}

// Aviso grande arriba solo si la tienda está apagada (vencida o suspendida)
function avisoSuscripcion(tienda){
  pintarPlan(tienda);
  const panel = document.getElementById("panel");
  if(!panel || tienda.activa || document.getElementById("avisoSuscripcion")) return;
  const aviso = document.createElement("p");
  aviso.id = "avisoSuscripcion";
  aviso.className = "aviso-suscripcion";
  aviso.textContent = tienda.estado === "suspendido"
    ? "Tu tienda está pausada: tus clientes no pueden verla. Escríbenos para reactivarla."
    : "Tu plan venció: tus clientes ya no pueden ver tu tienda. Renuévalo y se activa de inmediato.";
  panel.prepend(aviso);
}

// Cuenta regresiva del plan: días que quedan, fecha y barra (cambia de color al acercarse)
function pintarPlan(tienda){
  const caja = document.getElementById("planBox");
  if(!caja || !tienda) return;
  let dias = Number.isInteger(tienda.dias) ? tienda.dias : null;
  if(dias === null && tienda.vence){
    // Por si el servidor todavía no manda "dias": se calcula con la fecha de Colombia
    const hoy = new Date(new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) + "T00:00:00");
    dias = Math.round((new Date(tienda.vence + "T00:00:00") - hoy) / 86400000);
  }
  if(dias === null) return;

  const pausada = tienda.estado === "suspendido";
  const vencida = !pausada && (dias < 0 || !tienda.activa);
  const nivel = pausada || vencida ? "mal" : dias <= 3 ? "mal" : dias <= 7 ? "aviso" : "ok";
  const fecha = new Date(tienda.vence + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const grande = pausada ? "Pausada" : vencida ? "Vencido" : dias === 0 ? "Vence hoy" : `${dias} día${dias === 1 ? "" : "s"}`;
  const chico = pausada ? "Tu tienda no se está mostrando" : vencida ? `Venció el ${fecha}` : `Tu plan vence el ${fecha}`;
  const pct = pausada || vencida ? 0 : Math.max(3, Math.min(100, Math.round(dias / 30 * 100)));

  caja.className = "plan-box plan-" + nivel;
  caja.textContent = "";
  const k = document.createElement("span"); k.className = "plan-k"; k.textContent = "TU PLAN";
  const g = document.createElement("strong"); g.textContent = grande;
  if(!pausada && !vencida && dias > 0){ const q = document.createElement("small"); q.textContent = dias === 1 ? " restante" : " restantes"; g.appendChild(q); }
  const c = document.createElement("span"); c.className = "plan-fecha"; c.textContent = chico;
  const barra = document.createElement("div"); barra.className = "plan-barra";
  const i = document.createElement("i"); i.style.width = pct + "%"; barra.appendChild(i);
  caja.append(k, g, c, barra);

  // Cuando falta poco (o ya venció), botón para renovar por WhatsApp
  if(nivel !== "ok" && typeof EXHIBE_PRO !== "undefined"){
    const a = document.createElement("a");
    a.className = "plan-renovar";
    a.target = "_blank"; a.rel = "noopener";
    a.href = enlaceWhatsapp(EXHIBE_PRO.whatsapp, `Hola ${EXHIBE_PRO.nombre}, quiero renovar el plan de mi tienda "${tienda.nombre || tienda.slug}".`);
    a.textContent = pausada ? "Reactivar mi tienda" : "Renovar por WhatsApp";
    caja.appendChild(a);
  }
  caja.hidden = false;
}

// Tienda recién creada: le recuerda lo que falta para empezar a recibir pedidos
async function avisoPrimerosPasos(){
  const cfg = await window.configTienda;
  const panel = document.getElementById("panel");
  if(!cfg || !panel || document.getElementById("avisoPasos")) return;
  if(typeof numeroWhatsapp === "function" && numeroWhatsapp(cfg)) return;

  const aviso = document.createElement("div");
  aviso.id = "avisoPasos";
  aviso.className = "aviso-pasos";
  aviso.innerHTML = `<strong>Falta tu WhatsApp:</strong> sin él tus clientes no pueden enviarte pedidos.
    <a href="ajustes.html#sec-contacto">Configurarlo ahora →</a>`;
  const intro = panel.querySelector(".admin-intro");
  if(intro) intro.after(aviso); else panel.prepend(aviso);
}

// ---------- DATOS ----------
const esc = s => (typeof escapeHtml === "function" ? escapeHtml(s) : String(s ?? ""));
const pesos = n => "$" + Number(n || 0).toLocaleString("es-CO");
let filtroCategoria = "todas";   // "todas", "sin" o el id de la categoría
let textoBusqueda = "";

// Carga prendas y categorías de la tienda (las dos listas se usan en ambas pestañas)
async function cargarPrendas(){
  const cont = document.getElementById("listaPrendas");
  if(!cont) return;
  if(!prendasCache.length) cont.innerHTML = "<p class='lista-vacia'>Cargando productos…</p>";

  const tienda = await window.tiendaActual;
  if(!tienda) return;

  const [rPrendas, rCats] = await Promise.all([
    supabaseClient
      .from("prendas")
      .select(`id, nombre, precio, precio_oferta, imagen, categoria_id, tallas(id, talla, disponible)`)
      .eq("tienda_id", tienda.id)
      .order("creado_en", { ascending: false }),
    supabaseClient
      .from("categorias")
      .select("id, nombre, en_menu, orden")
      .eq("tienda_id", tienda.id)
      .order("orden").order("nombre")
  ]);

  if(rPrendas.error || rCats.error){
    console.error(rPrendas.error || rCats.error);
    cont.innerHTML = "<p class='lista-vacia error'>No se pudieron cargar los productos. Recarga la página.</p>";
    return;
  }
  prendasCache = rPrendas.data || [];
  categoriasCache = rCats.data || [];

  // Si se borró la categoría que estaba filtrada, vuelve a "Todas"
  if(filtroCategoria !== "todas" && filtroCategoria !== "sin" &&
     !categoriasCache.some(c => String(c.id) === filtroCategoria)) filtroCategoria = "todas";

  renderTodo();
}

function renderTodo(){
  document.getElementById("numPrendas").textContent = prendasCache.length;
  document.getElementById("numCategorias").textContent = categoriasCache.length;
  renderFiltros();
  renderPrendas();
  renderCategorias();
}

const nombreCategoria = id => (categoriasCache.find(c => c.id === id) || {}).nombre;
const prendasDe = idCat => prendasCache.filter(p => p.categoria_id === idCat);
const sinCategoria = () => prendasCache.filter(p => !p.categoria_id || !nombreCategoria(p.categoria_id));

// ---------- PRENDAS: filtros ----------
function renderFiltros(){
  const cont = document.getElementById("filtroCats");
  const chips = [["todas", "Todas", prendasCache.length]];
  categoriasCache.forEach(c => chips.push([String(c.id), c.nombre, prendasDe(c.id).length]));
  const sinCat = sinCategoria().length;
  if(sinCat) chips.push(["sin", "Sin categoría", sinCat]);

  cont.innerHTML = chips.map(([valor, texto, n]) => `
    <button type="button" class="chip-cat ${filtroCategoria === valor ? "activo" : ""}" data-filtro="${esc(valor)}">
      ${esc(texto)} <span>${n}</span>
    </button>`).join("");
}

// ---------- PRENDAS: lista ----------
function prendasVisibles(){
  const q = textoBusqueda.trim().toLowerCase();
  return prendasCache.filter(p => {
    const okCat = filtroCategoria === "todas" ||
      (filtroCategoria === "sin" ? (!p.categoria_id || !nombreCategoria(p.categoria_id)) : String(p.categoria_id) === filtroCategoria);
    return okCat && (!q || p.nombre.toLowerCase().includes(q));
  });
}

function renderPrendas(){
  const cont = document.getElementById("listaPrendas");
  if(!cont) return;

  if(!prendasCache.length){
    cont.innerHTML = "<p class='lista-vacia'>Todavía no has agregado ningún producto.</p>";
    registrarListenersLista();
    return;
  }

  const lista = prendasVisibles();
  cont.innerHTML = lista.length ? lista.map(p => {
    const cat = nombreCategoria(p.categoria_id);
    const precio = p.precio_oferta
      ? `<s>${pesos(p.precio)}</s> ${pesos(p.precio_oferta)} <em class="tag-oferta">OFERTA</em>`
      : pesos(p.precio);
    return `
      <div class="admin-item">
        <img src="${safeUrl(p.imagen) || "img/placeholder.jpg"}" alt="${esc(p.nombre)}" loading="lazy" onerror="this.src='img/placeholder.jpg'">
        <div class="admin-item-body">
          <h3>${esc(p.nombre)}</h3>
          <div class="item-meta">
            <span class="item-precio">${precio}</span>
            <span class="item-cat ${cat ? "" : "sin"}">${esc(cat || "Sin categoría")}</span>
          </div>
          <div class="item-tallas">
            ${(p.tallas || []).sort((a, b) => a.id - b.id).map(t => `
              <label class="talla-chip" title="Marcada = disponible">
                <input type="checkbox" data-talla="${t.id}" ${t.disponible ? "checked" : ""}>
                ${esOpcionUnica(t.talla) ? "Disponible" : esc(t.talla)}
              </label>
            `).join("")}
          </div>
        </div>
        <div class="item-actions">
          <button type="button" class="compartir-btn" data-compartir="${p.id}" title="Compartir en WhatsApp, Facebook o Instagram">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>
            Compartir
          </button>
          <a href="editarPrenda.html?id=${p.id}" class="edit-link">Editar</a>
          <button type="button" class="delete-btn" data-prenda="${p.id}">Eliminar</button>
        </div>
      </div>`;
  }).join("")
  : `<p class='lista-vacia'>No hay productos ${textoBusqueda ? "que coincidan con la búsqueda" : "en esta categoría"}.</p>`;

  registrarListenersLista();
}

// ---------- CATEGORÍAS ----------
function renderCategorias(){
  const cont = document.getElementById("listaCategorias");
  if(!cont) return;

  if(!categoriasCache.length){
    cont.innerHTML = "<p class='lista-vacia'>Aún no tienes categorías. Crea una arriba o al agregar un producto.</p>";
    return;
  }

  cont.innerHTML = categoriasCache.map(c => {
    const n = prendasDe(c.id).length;
    return `
      <div class="cat-fila" data-cat="${c.id}">
        <div class="cat-nombre">
          <input type="text" value="${esc(c.nombre)}" maxlength="40" aria-label="Nombre de la categoría" data-original="${esc(c.nombre)}">
          <button type="button" class="cat-guardar" data-accion="guardar" hidden>Guardar</button>
        </div>
        <div class="cat-info">
          <span class="cat-num">${n} ${n === 1 ? "producto" : "productos"}</span>
          <label class="cat-menu" title="Si la desmarcas, no sale en el menú de categorías de la tienda">
            <input type="checkbox" data-accion="menu" ${c.en_menu ? "checked" : ""}> En el menú
          </label>
        </div>
        <div class="cat-acciones">
          <button type="button" data-accion="ver" ${n ? "" : "disabled"}>Ver productos</button>
          <button type="button" class="cat-borrar" data-accion="borrar" ${n ? `disabled title="Primero mueve o elimina sus ${n} producto${n === 1 ? "" : "s"}"` : ""}>Eliminar</button>
        </div>
      </div>`;
  }).join("");
}

// Nombre válido: no vacío y sin repetir otra categoría de la tienda
function validarNombreCategoria(nombre, idActual){
  if(!nombre) return "Escribe un nombre.";
  if(nombre.length > 40) return "Máximo 40 letras.";
  const repetida = categoriasCache.some(c => c.id !== idActual && c.nombre.trim().toLowerCase() === nombre.toLowerCase());
  return repetida ? `Ya tienes una categoría llamada "${nombre}".` : "";
}

async function renombrarCategoria(fila){
  const id = Number(fila.dataset.cat);
  const input = fila.querySelector(".cat-nombre input");
  const nombre = input.value.trim().replace(/\s+/g, " ");
  const error = validarNombreCategoria(nombre, id);
  if(error){ alert(error); input.focus(); return; }

  const boton = fila.querySelector("[data-accion='guardar']");
  boton.disabled = true;
  const { data, error: err } = await supabaseClient.from("categorias").update({ nombre }).eq("id", id).select("id");
  boton.disabled = false;
  if(err || !data || !data.length){ alert("No se pudo cambiar el nombre" + (err ? ": " + err.message : ".")); return; }

  const cat = categoriasCache.find(c => c.id === id);
  if(cat) cat.nombre = nombre;
  renderTodo();
  avisar(`Categoría renombrada a "${nombre}".`);
}

async function cambiarEnMenu(fila, valor){
  const id = Number(fila.dataset.cat);
  const { data, error } = await supabaseClient.from("categorias").update({ en_menu: valor }).eq("id", id).select("id");
  if(error || !data || !data.length){
    alert("No se pudo guardar" + (error ? ": " + error.message : "."));
    fila.querySelector("[data-accion='menu']").checked = !valor;
    return;
  }
  const cat = categoriasCache.find(c => c.id === id);
  if(cat) cat.en_menu = valor;
  avisar(valor ? "Ahora sale en el menú de la tienda." : "Ya no sale en el menú (sus productos siguen en el catálogo).");
}

async function borrarCategoria(fila){
  const id = Number(fila.dataset.cat);
  const cat = categoriasCache.find(c => c.id === id);
  if(!cat) return;
  if(prendasDe(id).length){ alert("Esta categoría todavía tiene productos."); return; }
  if(!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return;

  const { data, error } = await supabaseClient.from("categorias").delete().eq("id", id).select("id");
  if(error || !data || !data.length){ alert("No se pudo eliminar" + (error ? ": " + error.message : ".")); return; }
  categoriasCache = categoriasCache.filter(c => c.id !== id);
  renderTodo();
  avisar(`Categoría "${cat.nombre}" eliminada.`);
}

async function crearCategoria(e){
  e.preventDefault();
  const input = document.getElementById("nuevaCatNombre");
  const nombre = input.value.trim().replace(/\s+/g, " ");
  const error = validarNombreCategoria(nombre, null);
  if(error){ alert(error); input.focus(); return; }

  const { data, error: err } = await supabaseClient
    .from("categorias").insert({ nombre, en_menu: true }).select("id, nombre, en_menu, orden").single();
  if(err){ alert("No se pudo crear: " + err.message); return; }
  categoriasCache.push(data);
  input.value = "";
  renderTodo();
  avisar(`Categoría "${nombre}" creada.`);
}

// ---------- PESTAÑAS ----------
function mostrarPestana(cual){
  document.querySelectorAll(".admin-tab").forEach(t => {
    const on = t.dataset.tab === cual;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.getElementById("tabPrendas").hidden = cual !== "prendas";
  document.getElementById("tabCategorias").hidden = cual !== "categorias";
}

// Aviso corto abajo de la pantalla
let avisoTimer;
function avisar(texto){
  let el = document.getElementById("avisoPanel");
  if(!el){
    el = document.createElement("div");
    el.id = "avisoPanel";
    el.className = "aviso-panel";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => el.classList.remove("visible"), 2600);
}

// ---------- LISTENERS (una sola vez) ----------
function registrarListenersLista(){
  if(listenersRegistrados) return;
  listenersRegistrados = true;

  const cont = document.getElementById("listaPrendas");

  cont.addEventListener("change", async (e) => {
    if(e.target.matches("[data-talla]")){
      const { error } = await supabaseClient
        .from("tallas")
        .update({ disponible: e.target.checked })
        .eq("id", e.target.dataset.talla);
      if(error){
        alert("Error al actualizar: " + error.message);
        e.target.checked = !e.target.checked;
      }
    }
  });

  cont.addEventListener("click", async (e) => {
    // Compartir: link del producto con su foto y precio (WhatsApp, Facebook, historia de Instagram)
    const compartir = e.target.closest("[data-compartir]");
    if(compartir){
      const p = prendasCache.find(x => String(x.id) === compartir.dataset.compartir);
      const tienda = await window.tiendaActual;
      const cfg = await window.configTienda;
      if(!p || !tienda || typeof Compartir === "undefined") return;
      Compartir.abrir({
        url: Compartir.urlProducto(tienda.slug, p.id),
        nombre: p.nombre,
        precio: p.precio_oferta || p.precio,
        precioAntes: p.precio_oferta ? p.precio : 0,
        imagen: /^https?:\/\//i.test(p.imagen || "") ? p.imagen : "",
        tienda: (cfg && cfg.nombre_tienda) || tienda.nombre || "mi tienda"
      });
      return;
    }
    const btn = e.target.closest("[data-prenda]");
    if(btn){
      if(!confirm("¿Eliminar este producto? También se borran sus fotos y sus opciones.")) return;
      const prendaId = btn.dataset.prenda;

      // Fotos a borrar del almacenamiento cuando la prenda ya no exista
      const prenda = prendasCache.find(p => String(p.id) === String(prendaId));
      const { data: extras } = await supabaseClient.from("imagenes_prenda").select("url").eq("prenda_id", prendaId);
      const urls = [...new Set([prenda && prenda.imagen, ...(extras || []).map(x => x.url)].filter(Boolean))];

      await supabaseClient.from("imagenes_prenda").delete().eq("prenda_id", prendaId);
      await supabaseClient.from("tallas").delete().eq("prenda_id", prendaId);

      const { error } = await supabaseClient.from("prendas").delete().eq("id", prendaId);
      if(error){ alert("Error al eliminar: " + error.message); return; }
      // Solo se borran las que ninguna otra prenda usa
      const enUso = new Set(prendasCache.filter(p => String(p.id) !== String(prendaId)).map(p => p.imagen));
      urls.filter(u => !enUso.has(u)).forEach(u => borrarFotoPrenda(u));
      prendasCache = prendasCache.filter(p => String(p.id) !== String(prendaId));
      renderTodo();
      avisar("Producto eliminado.");
    }
  });

  // Filtro por categoría
  document.getElementById("filtroCats").addEventListener("click", e => {
    const chip = e.target.closest("[data-filtro]");
    if(!chip) return;
    filtroCategoria = chip.dataset.filtro;
    renderFiltros();
    renderPrendas();
  });

  // Buscador
  document.getElementById("buscarPrenda").addEventListener("input", e => {
    textoBusqueda = e.target.value;
    renderPrendas();
  });

  // Pestañas
  document.querySelectorAll(".admin-tab").forEach(t =>
    t.addEventListener("click", () => mostrarPestana(t.dataset.tab)));

  // Categorías
  const cats = document.getElementById("listaCategorias");
  cats.addEventListener("input", e => {
    // El botón Guardar aparece solo si el nombre cambió
    const input = e.target.closest(".cat-nombre input");
    if(!input) return;
    const cambio = input.value.trim() !== input.dataset.original;
    input.closest(".cat-fila").querySelector("[data-accion='guardar']").hidden = !cambio;
  });
  cats.addEventListener("keydown", e => {
    if(e.key === "Enter" && e.target.closest(".cat-nombre input")){
      e.preventDefault();
      renombrarCategoria(e.target.closest(".cat-fila"));
    }
  });
  cats.addEventListener("change", e => {
    if(e.target.matches("[data-accion='menu']")) cambiarEnMenu(e.target.closest(".cat-fila"), e.target.checked);
  });
  cats.addEventListener("click", e => {
    const btn = e.target.closest("button[data-accion]");
    if(!btn || btn.disabled) return;
    const fila = btn.closest(".cat-fila");
    if(btn.dataset.accion === "guardar") renombrarCategoria(fila);
    if(btn.dataset.accion === "borrar") borrarCategoria(fila);
    if(btn.dataset.accion === "ver"){
      filtroCategoria = fila.dataset.cat;
      textoBusqueda = "";
      document.getElementById("buscarPrenda").value = "";
      renderFiltros();
      renderPrendas();
      mostrarPestana("prendas");
      document.querySelector(".admin-tabs").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  document.getElementById("nuevaCatForm").addEventListener("submit", crearCategoria);
}

// ---------- BRAND ----------
window.configTienda.then(cfg => {
  if(!cfg){
    console.warn("configTienda devolvió null. Usando fallback para el brand.");
    // Fallback: al menos mostramos algo
    document.querySelectorAll(".brand-unificado").forEach(el => {
      if(!el.innerHTML.trim()){
        el.innerHTML = `<span class="brand-nombre">Mi tienda</span>`;
      }
    });
    return;
  }
  if(typeof pintarBrands === "function") pintarBrands(cfg);
});

// ---------- INIT ----------
revisarSesion();