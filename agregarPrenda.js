let categoriasCache = [];

// Esta página no tiene login propio: si no hay sesión, de vuelta al admin
async function revisarSesion(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){ window.location.href = "admin.html"; return; }
  cargarCategorias();
}

// Comprime y sube a la carpeta de la tienda (utils.js)
async function subirImagen(archivo){
  return subirFotoPrenda(archivo);
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

  const errPrecio = errorPrecios(precio, precioOferta);
  if(errPrecio){ msg.textContent = errPrecio; msg.className = "form-msg error"; return; }

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

  // Sin opciones escritas → una sola opción "Única" (en el catálogo no se muestra)
  const listaTallas = [...new Set(tallasTexto.split(",").map(t => t.trim()).filter(Boolean))];
  if(!listaTallas.length) listaTallas.push(OPCION_UNICA);
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

  msg.textContent = "¡Producto agregado! Redirigiendo...";
  msg.className = "form-msg ok";
  setTimeout(() => window.location.href = "admin.html", 1200);
});



/* ---------- Botones rápidos de opciones (S/M/L, 50 ml/100 ml, colores...) ---------- */
function pintarOpcionesRapidas(cfg){
  const cont = document.getElementById("opcionesRapidas");
  const input = document.getElementById("tallas");
  if(!cont || !input) return;
  const op = textoOpcion(cfg);
  input.placeholder = op.ejemplos.length ? op.ejemplos.slice(0, 3).join(", ") : "Ej: Rojo, Azul, Verde";
  cont.textContent = "";
  cont.hidden = !op.ejemplos.length;
  if(cont.hidden) return;

  const titulo = document.createElement("span");
  titulo.textContent = op.plural.toUpperCase();
  cont.appendChild(titulo);
  op.ejemplos.forEach(valor => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = valor;
    b.dataset.valor = valor;
    cont.appendChild(b);
  });

  const marcar = () => {
    const actuales = input.value.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
    cont.querySelectorAll("button").forEach(b => b.classList.toggle("selected", actuales.includes(b.dataset.valor.toLowerCase())));
  };
  cont.addEventListener("click", e => {
    const b = e.target.closest("button[data-valor]");
    if(!b) return;
    let lista = input.value.split(",").map(x => x.trim()).filter(Boolean);
    const ya = lista.some(x => x.toLowerCase() === b.dataset.valor.toLowerCase());
    lista = ya ? lista.filter(x => x.toLowerCase() !== b.dataset.valor.toLowerCase()) : [...lista, b.dataset.valor];
    input.value = lista.join(", ");
    marcar();
  });
  input.addEventListener("input", marcar);
}
if(window.configTienda) window.configTienda.then(pintarOpcionesRapidas);

revisarSesion();