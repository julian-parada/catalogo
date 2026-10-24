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
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email     = document.getElementById("email").value;
  const password  = document.getElementById("password").value;
  const errorBox  = document.getElementById("loginError");

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ errorBox.textContent = "Correo o contraseña incorrectos."; return; }
  errorBox.textContent = "";
  // Se recarga para que tema.js lea la tienda de este usuario
  location.reload();
});

// ---------- LOGOUT ----------
document.getElementById("logoutBtn").addEventListener("click", async () => {
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

// ---------- CARGAR PRENDAS ----------
async function cargarPrendas(){
  const cont = document.getElementById("listaPrendas");
  if(!cont) return;
  cont.innerHTML = "<p style='color:var(--muted)'>Cargando prendas...</p>";

  const tienda = await window.tiendaActual;
  if(!tienda) return;

  const { data, error } = await supabaseClient
    .from("prendas")
    .select(`id, nombre, precio, imagen, categorias(nombre), tallas(id, talla, disponible)`)
    .eq("tienda_id", tienda.id)
    .order("creado_en", { ascending: false });

  if(error){
    console.error(error);
    cont.innerHTML = "<p style='color:#ff5c7a'>No se pudieron cargar las prendas.</p>";
    return;
  }
  prendasCache = data || [];
  renderPrendas();
}

// ---------- RENDER ----------
function renderPrendas(){
  const cont = document.getElementById("listaPrendas");
  if(!cont) return;

  cont.innerHTML = prendasCache.length
    ? prendasCache.map(p => `
      <div class="admin-item">
        <img src="${typeof safeUrl === "function" ? safeUrl(p.imagen) : p.imagen}"
             alt="${typeof escapeHtml === "function" ? escapeHtml(p.nombre) : p.nombre}">
        <div class="admin-item-body">
          <h3>${typeof escapeHtml === "function" ? escapeHtml(p.nombre) : p.nombre} —
              $${Number(p.precio).toLocaleString("es-CO")}</h3>
          <p style="color:var(--muted);margin:0 0 6px">
            ${typeof escapeHtml === "function"
              ? escapeHtml(p.categorias ? p.categorias.nombre : "Sin categoría")
              : (p.categorias ? p.categorias.nombre : "Sin categoría")}
          </p>
          <div>
            ${(p.tallas || []).map(t => `
              <label class="talla-chip">
                <input type="checkbox" data-talla="${t.id}" ${t.disponible ? "checked" : ""}>
                ${typeof escapeHtml === "function" ? escapeHtml(t.talla) : t.talla}
              </label>
            `).join("")}
          </div>
        </div>
        <div class="item-actions">
          <a href="editarPrenda.html?id=${p.id}" class="edit-link">Editar</a>
          <button class="delete-btn" data-prenda="${p.id}">Eliminar</button>
        </div>
      </div>
    `).join("")
    : "<p style='color:var(--muted)'>Todavía no has agregado ninguna prenda.</p>";

  registrarListenersLista();
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
    if(e.target.matches("[data-prenda]")){
      if(!confirm("¿Eliminar esta prenda y todas sus tallas e imágenes?")) return;
      const prendaId = e.target.dataset.prenda;

      await supabaseClient.from("imagenes_prenda").delete().eq("prenda_id", prendaId);
      await supabaseClient.from("tallas").delete().eq("prenda_id", prendaId);

      const { error } = await supabaseClient.from("prendas").delete().eq("id", prendaId);
      if(error){ alert("Error al eliminar: " + error.message); return; }
      cargarPrendas();
    }
  });
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