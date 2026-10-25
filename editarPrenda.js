const params = new URLSearchParams(window.location.search);
const prendaId = params.get("id");

let categoriasCache = [];

async function revisarSesion(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){ window.location.href = "admin.html"; return; }
  if(!prendaId){ window.location.href = "admin.html"; return; }
  await cargarCategorias();
  await cargarPrenda();
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "admin.html";
});

async function cargarCategorias(){
  const tienda = await window.tiendaActual;
  if(!tienda){ window.location.href = "admin.html"; return; }
  const { data, error } = await supabaseClient
    .from("categorias").select("id, nombre").eq("tienda_id", tienda.id);
  if(error){ console.error(error); return; }
  categoriasCache = data;
  document.getElementById("categoriasList").innerHTML =
    data.map(c => `<option value="${escapeHtml(c.nombre)}"></option>`).join("");
}

async function resolverCategoria(nombreTexto){
  let categoria = categoriasCache.find(c => c.nombre.toLowerCase() === nombreTexto.toLowerCase());
  if(categoria) return categoria;
  const { data: nueva, error } = await supabaseClient
    .from("categorias").insert({ nombre: nombreTexto }).select().single();
  if(error) throw error;
  categoriasCache.push(nueva);
  return nueva;
}

// ---- Cargar datos de la prenda y llenar el formulario ----
async function cargarPrenda(){
  const { data, error } = await supabaseClient
    .from("prendas")
    .select(`id, nombre, precio, precio_oferta, imagen, descripcion, categorias(nombre)`)
    .eq("id", prendaId)
    .single();

  if(error){ alert("No se pudo cargar el producto: " + error.message); window.location.href = "admin.html"; return; }

  document.getElementById("nombre").value = data.nombre;
  document.getElementById("categoria").value = data.categorias ? data.categorias.nombre : "";
  document.getElementById("precio").value = data.precio;
  document.getElementById("precioOferta").value = data.precio_oferta || "";
  document.getElementById("imagen").value = data.imagen;
  document.getElementById("descripcion").value = data.descripcion || "";

  cargarTallas();
  cargarFotos();
}

// ---- Guardar cambios generales ----
document.getElementById("editForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("formMsg");
  msg.className = "form-msg";

  const nombre = document.getElementById("nombre").value;
  const categoriaTexto = document.getElementById("categoria").value.trim();
  const precio = document.getElementById("precio").value;
  const imagen = document.getElementById("imagen").value;
  const descripcion = document.getElementById("descripcion").value;
  const precioOferta = document.getElementById("precioOferta").value.trim();

  const errPrecio = errorPrecios(precio, precioOferta);
  if(errPrecio){ msg.textContent = errPrecio; msg.classList.add("error"); return; }

  let categoria;
  try { categoria = await resolverCategoria(categoriaTexto); }
  catch(err){ msg.textContent = "Error con la categoría: " + err.message; msg.classList.add("error"); return; }

const { error } = await supabaseClient
  .from("prendas")
  .update({
    nombre, categoria_id: categoria.id, precio, imagen, descripcion,
    precio_oferta: precioOferta ? precioOferta : null
  })
  .eq("id", prendaId);

  if(error){ msg.textContent = "Error al guardar: " + error.message; msg.classList.add("error"); return; }

  msg.textContent = "¡Cambios guardados!";
  msg.classList.add("ok");
});

// ---- Tallas: listar, marcar disponible/no, borrar ----
async function cargarTallas(){
  const { data, error } = await supabaseClient
    .from("tallas")
    .select("id, talla, disponible")
    .eq("prenda_id", prendaId)
    .order("id");

  if(error){ console.error(error); return; }

  const cont = document.getElementById("listaTallas");
  cont.innerHTML = data.length ? data.map(t => `
    <div class="admin-item" style="align-items:center">
      <div class="admin-item-body" style="display:flex;align-items:center;gap:10px">
        <label class="talla-chip" style="margin:0">
          <input type="checkbox" data-talla="${t.id}" ${t.disponible ? "checked" : ""}>
          ${escapeHtml(t.talla)}
        </label>
      </div>
      <button class="delete-btn" data-borrar-talla="${t.id}">Eliminar</button>
    </div>
  `).join("") : `<p style='color:var(--muted)'>Este producto no tiene ${textoOpcion(await window.configTienda).plural.toLowerCase()} todavía. Usa el campo de abajo.</p>`;
}

document.getElementById("listaTallas").addEventListener("change", async (e) => {
  if(e.target.matches("[data-talla]")){
    const { error } = await supabaseClient
      .from("tallas")
      .update({ disponible: e.target.checked })
      .eq("id", e.target.dataset.talla);
    if(error) alert("Error al actualizar: " + error.message);
  }
});

document.getElementById("listaTallas").addEventListener("click", async (e) => {
  if(e.target.matches("[data-borrar-talla]")){
    if(!confirm(`¿Eliminar "${e.target.closest(".admin-item").querySelector("label").textContent.trim()}"?`)) return;
    const { error } = await supabaseClient.from("tallas").delete().eq("id", e.target.dataset.borrarTalla);
    if(error){ alert("Error al eliminar: " + error.message); return; }
    cargarTallas();
  }
});

document.getElementById("addTallaForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("nuevaTalla");
  const talla = input.value.trim();
  if(!talla) return;

  const { error } = await supabaseClient
    .from("tallas")
    .insert({ prenda_id: prendaId, talla, disponible: true });

  if(error){ alert("No se pudo agregar: " + error.message); return; }

  input.value = "";
  cargarTallas();
});

/* ---------------------------------------------------------
   FOTOS
   La posición 0 es la foto principal (columna prendas.imagen);
   las demás son filas de imagenes_prenda. Cada cambio se guarda al instante.
   --------------------------------------------------------- */
let fotos = [];          // [{ url, id? }]  (id solo en las extra)
let fotosOcupado = false;

function msgFotos(texto, tipo){
  const m = document.getElementById("fotosMsg");
  m.textContent = texto || "";
  m.className = "fotos-msg" + (tipo ? " " + tipo : "");
}

async function cargarFotos(){
  const [{ data: prenda, error: e1 }, { data: extras, error: e2 }] = await Promise.all([
    supabaseClient.from("prendas").select("imagen").eq("id", prendaId).single(),
    supabaseClient.from("imagenes_prenda").select("id, url, orden").eq("prenda_id", prendaId).order("orden").order("id")
  ]);
  if(e1 || e2){ console.error(e1 || e2); msgFotos("No se pudieron cargar las fotos.", "error"); return; }

  fotos = [];
  if(prenda && prenda.imagen) fotos.push({ url: prenda.imagen });
  (extras || []).forEach(x => fotos.push({ id: x.id, url: x.url, orden: x.orden }));

  // El formulario de arriba guarda la principal: se mantiene sincronizada
  document.getElementById("imagen").value = fotos[0] ? fotos[0].url : "";
  if(typeof updatePreview === "function") updatePreview();
  renderFotos();
}

function renderFotos(){
  const cont = document.getElementById("listaFotos");
  if(!fotos.length){
    cont.innerHTML = "<p class='fotos-vacio'>Este producto no tiene fotos. Agrega al menos una.</p>";
    return;
  }
  const n = fotos.length;
  cont.innerHTML = fotos.map((f, i) => `
    <div class="foto-item ${i === 0 ? "principal" : ""}">
      <div class="foto-img"><img src="${safeUrl(f.url)}" alt="Foto ${i + 1}" loading="lazy" onerror="this.src='img/placeholder.jpg'"></div>
      ${i === 0 ? `<span class="foto-badge">★ Principal</span>` : ""}
      <div class="foto-acciones">
        <button type="button" data-foto="izq" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Mover a la izquierda" title="Mover a la izquierda">‹</button>
        ${i === 0 ? "" : `<button type="button" data-foto="principal" data-i="${i}" class="foto-hacer" title="Hacer principal">★</button>`}
        <button type="button" data-foto="der" data-i="${i}" ${i === n - 1 ? "disabled" : ""} aria-label="Mover a la derecha" title="Mover a la derecha">›</button>
        <button type="button" data-foto="borrar" data-i="${i}" class="foto-borrar" aria-label="Eliminar foto" title="Eliminar foto">✕</button>
      </div>
    </div>`).join("");
}

// Pone la URL `url` en la posición `i` de la galería
function guardarUrlEn(i, url){
  return i === 0
    ? supabaseClient.from("prendas").update({ imagen: url }).eq("id", prendaId).select("id")
    : supabaseClient.from("imagenes_prenda").update({ url }).eq("id", fotos[i].id).select("id");
}

// Intercambia dos fotos de lugar (sirve para mover y para "hacer principal")
async function intercambiarFotos(a, b){
  const ua = fotos[a].url, ub = fotos[b].url;
  const [r1, r2] = await Promise.all([guardarUrlEn(a, ub), guardarUrlEn(b, ua)]);
  const fallo = r1.error || r2.error || !r1.data || !r1.data.length || !r2.data || !r2.data.length;
  if(fallo) throw new Error((r1.error || r2.error || {}).message || "sin permiso");
}

async function borrarFoto(i){
  if(fotos.length === 1){ throw new Error("el producto necesita al menos una foto; agrega otra antes de borrar esta"); }
  if(!confirm(i === 0 ? "¿Eliminar la foto principal? La siguiente pasará a ser la principal." : "¿Eliminar esta foto?")) return "cancelado";
  const url = fotos[i].url;

  if(i === 0){
    // La primera foto extra pasa a ser la principal
    const siguiente = fotos[1];
    const { data, error } = await supabaseClient.from("prendas").update({ imagen: siguiente.url }).eq("id", prendaId).select("id");
    if(error || !data || !data.length) throw new Error(error ? error.message : "sin permiso");
    await supabaseClient.from("imagenes_prenda").delete().eq("id", siguiente.id);
  }else{
    const { data, error } = await supabaseClient.from("imagenes_prenda").delete().eq("id", fotos[i].id).select("id");
    if(error || !data || !data.length) throw new Error(error ? error.message : "sin permiso");
  }
  // Si ninguna otra posición usa esa misma imagen, se borra del almacenamiento
  if(!fotos.some((f, j) => j !== i && f.url === url)) await borrarFotoPrenda(url);
}

async function agregarFotos(archivos){
  let subidas = 0;
  for(let k = 0; k < archivos.length; k++){
    msgFotos(`Subiendo foto ${k + 1} de ${archivos.length}…`);
    const url = await subirFotoPrenda(archivos[k]);
    if(!fotos.length){
      const { error } = await supabaseClient.from("prendas").update({ imagen: url }).eq("id", prendaId);
      if(error) throw error;
      fotos.push({ url });
    }else{
      const orden = Math.max(0, ...fotos.filter(f => f.id).map(f => f.orden || 0)) + 1;
      const { data, error } = await supabaseClient.from("imagenes_prenda")
        .insert({ prenda_id: Number(prendaId), url, orden }).select("id, url, orden").single();
      if(error) throw error;
      fotos.push(data);
    }
    subidas++;
  }
  return subidas;
}

// Una acción a la vez, y siempre se recarga desde la base al terminar
async function accionFotos(fn, okTexto){
  if(fotosOcupado) return;
  fotosOcupado = true;
  document.getElementById("fotosCard").classList.add("ocupado");
  try{
    const r = await fn();
    if(r === "cancelado") msgFotos("");
    else msgFotos(typeof okTexto === "function" ? okTexto(r) : okTexto, "ok");
  }catch(err){
    console.error(err);
    msgFotos("No se pudo guardar el cambio de fotos" + (err && err.message ? ": " + err.message : "."), "error");
  }finally{
    fotosOcupado = false;
    document.getElementById("fotosCard").classList.remove("ocupado");
    await cargarFotos();
  }
}

document.getElementById("listaFotos").addEventListener("click", e => {
  const btn = e.target.closest("[data-foto]");
  if(!btn || btn.disabled) return;
  const i = Number(btn.dataset.i);
  const accion = btn.dataset.foto;
  if(accion === "izq") accionFotos(() => intercambiarFotos(i, i - 1), i - 1 === 0 ? "✓ Nueva foto principal." : "✓ Orden guardado.");
  if(accion === "der") accionFotos(() => intercambiarFotos(i, i + 1), i === 0 ? "✓ Nueva foto principal." : "✓ Orden guardado.");
  if(accion === "principal") accionFotos(() => intercambiarFotos(i, 0), "✓ Nueva foto principal.");
  if(accion === "borrar") accionFotos(() => borrarFoto(i), "✓ Foto eliminada.");
});

document.getElementById("fotosNuevas").addEventListener("change", e => {
  const archivos = [...e.target.files];
  e.target.value = "";
  if(!archivos.length) return;
  if(fotos.length + archivos.length > 10){ msgFotos("Máximo 10 fotos por producto.", "error"); return; }
  accionFotos(() => agregarFotos(archivos), n => `✓ ${n} foto${n === 1 ? "" : "s"} agregada${n === 1 ? "" : "s"}.`);
});

revisarSesion();
