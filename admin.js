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
  await cargarPrendas();
}

// Aviso dentro del panel si la tienda está vencida o por vencer
function avisoSuscripcion(tienda){
  const panel = document.getElementById("panel");
  if(!panel || document.getElementById("avisoSuscripcion")) return;

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = tienda.vence ? new Date(tienda.vence + "T00:00:00") : null;
  const dias = vence ? Math.round((vence - hoy) / 86400000) : null;

  let texto = "";
  if(!tienda.activa) texto = "Tu tienda está suspendida o vencida: los clientes no pueden verla. Comunícate con tu proveedor para reactivarla.";
  else if(dias !== null && dias <= 5) texto = dias === 0 ? "Tu suscripción vence hoy." : `Tu suscripción vence en ${dias} día${dias === 1 ? "" : "s"}.`;
  if(!texto) return;

  const aviso = document.createElement("p");
  aviso.id = "avisoSuscripcion";
  aviso.textContent = texto;
  aviso.style.cssText = "background:rgba(255,92,122,.12);border:1px solid #ff5c7a;color:#ff5c7a;padding:12px 16px;border-radius:10px;margin:0 0 18px";
  panel.prepend(aviso);
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
  if(!prendasCache.length) cont.innerHTML = "<p class='lista-vacia'>Cargando prendas…</p>";

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
    cont.innerHTML = "<p class='lista-vacia error'>No se pudieron cargar las prendas. Recarga la página.</p>";
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
    cont.innerHTML = "<p class='lista-vacia'>Todavía no has agregado ninguna prenda.</p>";
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
                ${esc(t.talla)}
              </label>
            `).join("")}
          </div>
        </div>
        <div class="item-actions">
          <a href="editarPrenda.html?id=${p.id}" class="edit-link">Editar</a>
          <button type="button" class="delete-btn" data-prenda="${p.id}">Eliminar</button>
        </div>
      </div>`;
  }).join("")
  : `<p class='lista-vacia'>No hay prendas ${textoBusqueda ? "que coincidan con la búsqueda" : "en esta categoría"}.</p>`;

  registrarListenersLista();
}

// ---------- CATEGORÍAS ----------
function renderCategorias(){
  const cont = document.getElementById("listaCategorias");
  if(!cont) return;

  if(!categoriasCache.length){
    cont.innerHTML = "<p class='lista-vacia'>Aún no tienes categorías. Crea una arriba o al agregar una prenda.</p>";
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
          <span class="cat-num">${n} ${n === 1 ? "prenda" : "prendas"}</span>
          <label class="cat-menu" title="Si la desmarcas, no sale en el menú de categorías de la tienda">
            <input type="checkbox" data-accion="menu" ${c.en_menu ? "checked" : ""}> En el menú
          </label>
        </div>
        <div class="cat-acciones">
          <button type="button" data-accion="ver" ${n ? "" : "disabled"}>Ver prendas</button>
          <button type="button" class="cat-borrar" data-accion="borrar" ${n ? `disabled title="Primero mueve o elimina sus ${n} prenda${n === 1 ? "" : "s"}"` : ""}>Eliminar</button>
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
  avisar(valor ? "Ahora sale en el menú de la tienda." : "Ya no sale en el menú (sus prendas siguen en el catálogo).");
}

async function borrarCategoria(fila){
  const id = Number(fila.dataset.cat);
  const cat = categoriasCache.find(c => c.id === id);
  if(!cat) return;
  if(prendasDe(id).length){ alert("Esta categoría todavía tiene prendas."); return; }
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
    const btn = e.target.closest("[data-prenda]");
    if(btn){
      if(!confirm("¿Eliminar esta prenda y todas sus tallas e imágenes?")) return;
      const prendaId = btn.dataset.prenda;

      await supabaseClient.from("imagenes_prenda").delete().eq("prenda_id", prendaId);
      await supabaseClient.from("tallas").delete().eq("prenda_id", prendaId);

      const { error } = await supabaseClient.from("prendas").delete().eq("id", prendaId);
      if(error){ alert("Error al eliminar: " + error.message); return; }
      prendasCache = prendasCache.filter(p => String(p.id) !== String(prendaId));
      renderTodo();
      avisar("Prenda eliminada.");
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