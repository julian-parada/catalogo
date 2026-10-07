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
  const { data, error } = await supabaseClient.from("categorias").select("id, nombre");
  if(error){ console.error(error); return; }
  categoriasCache = data;
  document.getElementById("categoriasList").innerHTML =
    data.map(c => `<option value="${c.nombre}"></option>`).join("");
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
    .select(`id, nombre, precio, imagen, descripcion, categorias(nombre)`)
    .eq("id", prendaId)
    .single();

  if(error){ alert("No se pudo cargar la prenda: " + error.message); window.location.href = "admin.html"; return; }

  document.getElementById("nombre").value = data.nombre;
  document.getElementById("categoria").value = data.categorias ? data.categorias.nombre : "";
  document.getElementById("precio").value = data.precio;
  document.getElementById("precioOferta").value = data.precio_oferta || "";
  document.getElementById("imagen").value = data.imagen;
  document.getElementById("descripcion").value = data.descripcion || "";

  cargarTallas();
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

  let categoria;
  try { categoria = await resolverCategoria(categoriaTexto); }
  catch(err){ msg.textContent = "Error con la categoría: " + err.message; msg.classList.add("error"); return; }

  const precioOferta = document.getElementById("precioOferta").value.trim();

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
          Talla ${t.talla}
        </label>
      </div>
      <button class="delete-btn" data-borrar-talla="${t.id}">Eliminar talla</button>
    </div>
  `).join("") : "<p style='color:var(--muted)'>Esta prenda no tiene tallas. Agrega una abajo.</p>";
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
    if(!confirm("¿Eliminar esta talla?")) return;
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

  if(error){ alert("Error al agregar la talla: " + error.message); return; }

  input.value = "";
  cargarTallas();
});

revisarSesion();