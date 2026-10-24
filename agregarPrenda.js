let categoriasCache = [];

// Esta página no tiene login propio: si no hay sesión, de vuelta al admin
async function revisarSesion(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){ window.location.href = "admin.html"; return; }
  cargarCategorias();
}

async function subirImagen(archivo){
  if(!archivo || !archivo.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen.");
  archivo = await comprimirImagen(archivo, 1200);   // de varios MB a ~200 KB (utils.js)
  const tienda = await window.tiendaActual;
  if(!tienda) throw new Error("No se encontró tu tienda. Vuelve a iniciar sesión.");
  // Cada tienda sube a su propia carpeta (lo exige el servidor). Sin tildes ni espacios en el nombre.
  const limpio = archivo.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  const nombreArchivo = `${tienda.id}/${Date.now()}_${limpio}`;

  const { error } = await supabaseClient.storage
    .from("imagenes-prendas")
    .upload(nombreArchivo, archivo);

  if(error) throw error;

  const { data } = supabaseClient.storage
    .from("imagenes-prendas")
    .getPublicUrl(nombreArchivo);

  return data.publicUrl;
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
  return nueva;
}

document.getElementById("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("formMsg");
  msg.className = "form-msg";
  msg.textContent = "Subiendo imágenes...";
  msg.classList.add("ok");

  const nombre = document.getElementById("nombre").value;
  const categoriaTexto = document.getElementById("categoria").value.trim();
  const precio = document.getElementById("precio").value;
  const precioOferta = document.getElementById("precioOferta").value.trim();
  const descripcion = document.getElementById("descripcion").value;
  const tallasTexto = document.getElementById("tallas").value.trim();
  const archivoPrincipal = document.getElementById("imagenArchivo").files[0];
  const archivosExtra = document.getElementById("fotosExtraArchivos").files;

  let categoria;
  try { categoria = await resolverCategoria(categoriaTexto); }
  catch(err){ msg.textContent = "Error con la categoría: " + err.message; msg.className = "form-msg error"; return; }

  let urlPrincipal;
  try { urlPrincipal = await subirImagen(archivoPrincipal); }
  catch(err){ msg.textContent = "Error al subir la foto principal: " + err.message; msg.className = "form-msg error"; return; }

  const { data: prendaNueva, error: errorPrenda } = await supabaseClient
    .from("prendas")
    .insert({
      nombre, categoria_id: categoria.id, precio, imagen: urlPrincipal, descripcion,
      precio_oferta: precioOferta ? precioOferta : null
    })
    .select()
    .single();

  if(errorPrenda){ msg.textContent = "Error al guardar: " + errorPrenda.message; msg.className = "form-msg error"; return; }

  const listaTallas = tallasTexto ? tallasTexto.split(",").map(t => t.trim()) : ["Única"];
  const filasTallas = listaTallas.map(talla => ({ prenda_id: prendaNueva.id, talla, disponible: true }));
  await supabaseClient.from("tallas").insert(filasTallas);

  if(archivosExtra.length){
    for(let i = 0; i < archivosExtra.length; i++){
      try {
        const url = await subirImagen(archivosExtra[i]);
        await supabaseClient.from("imagenes_prenda").insert({ prenda_id: prendaNueva.id, url, orden: i + 1 });
      } catch(err){ console.error("Error subiendo foto extra:", err); }
    }
  }

  msg.textContent = "¡Prenda agregada! Redirigiendo...";
  msg.className = "form-msg ok";
  setTimeout(() => window.location.href = "admin.html", 1200);
});



revisarSesion();