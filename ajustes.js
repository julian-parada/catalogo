// ajustes.js — pantalla "Mi tienda".
// Necesita, cargados antes: supabase-js, supabaseConfig.js y tema.js
// (tema.js aporta PALETAS, aplicarPaleta() y window.configTienda).

const BUCKET = "imagenes-prendas";
const LIMITE_LOGO = 2 * 1024 * 1024;     // 2 MB
const LIMITE_BANNER = 5 * 1024 * 1024;   // 5 MB

// Campos de texto: el id de cada <input> es igual al nombre de su columna
const CAMPOS = [
  "nombre_tienda", "whatsapp",
  "instagram_url", "tiktok_url", "facebook_url",
  "portada_frase", "portada_titulo", "portada_subtitulo", "portada_boton",
  "catalogo_etiqueta", "catalogo_titulo", "mensaje_saludo",
  "footer_texto", "footer_direccion", "footer_horario", "footer_mapa_url"
];
const REDES_Y_LINKS = ["instagram_url", "tiktok_url", "facebook_url", "footer_mapa_url"];
const OPCIONALES_A_NULL = ["footer_texto", "footer_direccion", "footer_horario"];

let cfg = null;              // la configuración tal como está guardada
let paletaElegida = "rosa";

const $ = id => document.getElementById(id);

/* ---------------------------------------------------------
   SESIÓN
   --------------------------------------------------------- */
async function revisarSesion(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(!session){ window.location.href = "admin.html"; return; }
  iniciar();
}

$("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "admin.html";
});

async function iniciar(){
  cfg = await window.configTienda;
  if(!cfg){
    mostrarMsg("No se pudo leer la configuración. Revisa que la tabla «configuracion» exista en Supabase.", "error");
    return;
  }
  construirPaletas();
  llenarFormulario();
  pintarMarca();
}

/* ---------------------------------------------------------
   MENSAJES
   --------------------------------------------------------- */
function mostrarMsg(texto, tipo){
  const m = $("formMsg");
  m.className = "form-msg" + (tipo ? " " + tipo : "");
  m.textContent = texto;
  if(tipo === "error") m.scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------------------------------------------------------
   PALETAS
   --------------------------------------------------------- */
function construirPaletas(){
  const cont = $("paletas");
  cont.textContent = "";

  Object.entries(PALETAS).forEach(([clave, p]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.dataset.paleta = clave;

    const punto = document.createElement("i");
    punto.style.background = `linear-gradient(135deg, ${p.a}, ${p.b})`;
    btn.appendChild(punto);
    btn.appendChild(document.createTextNode(clave.charAt(0).toUpperCase() + clave.slice(1)));

    cont.appendChild(btn);
  });

  cont.addEventListener("click", e => {
    const btn = e.target.closest("[data-paleta]");
    if(btn) elegirPaleta(btn.dataset.paleta);
  });
}

function elegirPaleta(clave){
  paletaElegida = clave;
  aplicarPaleta(clave); // vista previa inmediata en esta misma pantalla (viene de tema.js)
  document.querySelectorAll(".swatch").forEach(b =>
    b.classList.toggle("selected", b.dataset.paleta === clave));
}

/* ---------------------------------------------------------
   LLENAR EL FORMULARIO
   --------------------------------------------------------- */
function llenarFormulario(){
  CAMPOS.forEach(c => { $(c).value = cfg[c] ?? ""; });
  $("mostrar_nombre").checked = Boolean(cfg.mostrar_nombre);
  elegirPaleta(cfg.paleta in PALETAS ? cfg.paleta : "rosa");
  renderMedia("logo", cfg.logo_url);
  renderMedia("banner", cfg.banner_url);
}

function renderMedia(tipo, url){
  const caja = $(tipo + "Preview");
  caja.textContent = "";

  if(url){
    const img = document.createElement("img");
    img.src = url;
    img.alt = tipo === "logo" ? "Logo actual" : "Banner actual";
    caja.appendChild(img);
  }else{
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = tipo === "logo"
      ? "Todavía no has subido un logo."
      : "Se usa la foto de portada por defecto.";
    caja.appendChild(p);
  }
}

// Vista previa apenas el cliente elige un archivo
["logo", "banner"].forEach(tipo => {
  $(tipo + "Archivo").addEventListener("change", function(){
    const archivo = this.files[0];
    if(!archivo){ renderMedia(tipo, cfg ? cfg[tipo + "_url"] : null); return; }
    const lector = new FileReader();
    lector.onload = e => renderMedia(tipo, e.target.result);
    lector.readAsDataURL(archivo);
  });
});

// Encabezado del panel: logo (o inicial) y nombre de la tienda


function pintarMarca(){
  if(window.pintarMarcaAdmin) window.pintarMarcaAdmin(cfg);
}





/* ---------------------------------------------------------
   VALIDACIONES
   --------------------------------------------------------- */
// Solo se aceptan links http(s). Estos valores terminan como href en el catálogo.
function limpiarUrl(valor){
  const v = valor.trim();
  if(!v) return null;
  if(v.startsWith("@")) throw new Error("Pega el link completo de la red, por ejemplo https://instagram.com/tutienda");
  if(/^https?:\/\//i.test(v)) return v;
  if(/^[a-z][a-z0-9+.-]*:/i.test(v)) throw new Error("Los links deben empezar con https://");
  return "https://" + v;
}

function limpiarWhatsapp(valor){
  let d = valor.replace(/\D/g, "");
  if(d.length === 10 && d.startsWith("3")) d = "57" + d;
  if(d.length < 10 || d.length > 15){
    throw new Error("El WhatsApp debe tener entre 10 y 15 dígitos, con el código del país. Ejemplo: 573001234567");
  }
  return d;
}

/* ---------------------------------------------------------
   STORAGE
   --------------------------------------------------------- */
async function subirArchivo(archivo, prefijo, limite){
  if(!archivo.type.startsWith("image/")) throw new Error("El archivo del " + prefijo + " debe ser una imagen.");
  if(archivo.size > limite){
    throw new Error(`La imagen del ${prefijo} pesa demasiado (máximo ${Math.round(limite / 1024 / 1024)} MB).`);
  }

  const ext = ((archivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")) || "jpg";
  const nombre = `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseClient.storage.from(BUCKET).upload(nombre, archivo);
  if(error) throw error;

  return supabaseClient.storage.from(BUCKET).getPublicUrl(nombre).data.publicUrl;
}

// Borra del bucket el archivo viejo para no llenar el almacenamiento. Si falla, no pasa nada.
async function borrarAnterior(url){
  if(!url) return;
  const marca = `/object/public/${BUCKET}/`;
  const i = url.indexOf(marca);
  if(i === -1) return;
  const ruta = decodeURIComponent(url.slice(i + marca.length).split("?")[0]);
  await supabaseClient.storage.from(BUCKET).remove([ruta]);
}

/* ---------------------------------------------------------
   GUARDAR
   --------------------------------------------------------- */
$("tiendaForm").addEventListener("submit", async e => {
  e.preventDefault();
  if(!cfg) return;

  const boton = $("guardarBtn");
  boton.disabled = true;
  mostrarMsg("Guardando...", "");

  try{
    const datos = {};
    CAMPOS.forEach(c => { datos[c] = $(c).value.trim(); });

    // Obligatorios
    if(!datos.nombre_tienda) throw new Error("Escribe el nombre de la tienda.");
    if(!datos.portada_titulo) throw new Error("Escribe el título de la portada.");
    if(!datos.catalogo_titulo) throw new Error("Escribe el título de la sección del catálogo.");
    if(!datos.mensaje_saludo) throw new Error("Escribe el saludo del mensaje de WhatsApp.");

    // Normalizar
    datos.whatsapp = limpiarWhatsapp(datos.whatsapp);
    REDES_Y_LINKS.forEach(c => { datos[c] = limpiarUrl(datos[c]); });
    OPCIONALES_A_NULL.forEach(c => { datos[c] = datos[c] || null; });

    datos.paleta = paletaElegida;
    datos.mostrar_nombre = $("mostrar_nombre").checked;

    // Logo y banner: archivo nuevo > quitar > dejar como estaba
    const anterior = { logo: cfg.logo_url, banner: cfg.banner_url };
    let logo = cfg.logo_url;
    let banner = cfg.banner_url;

    if($("quitar_logo").checked) logo = null;
    if($("quitar_banner").checked) banner = null;

    const archivoLogo = $("logoArchivo").files[0];
    const archivoBanner = $("bannerArchivo").files[0];
    if(archivoLogo) logo = await subirArchivo(archivoLogo, "logo", LIMITE_LOGO);
    if(archivoBanner) banner = await subirArchivo(archivoBanner, "banner", LIMITE_BANNER);

    datos.logo_url = logo;
    datos.banner_url = banner;

    const { error } = await supabaseClient.from("configuracion").update(datos).eq("id", 1);
    if(error) throw error;

    // Ya guardado: se borran los archivos viejos que dejaron de usarse
    if(anterior.logo && anterior.logo !== logo) await borrarAnterior(anterior.logo).catch(() => {});
    if(anterior.banner && anterior.banner !== banner) await borrarAnterior(anterior.banner).catch(() => {});

    cfg = { ...cfg, ...datos };
    localStorage.setItem("tiendaPaleta", datos.paleta);
    localStorage.setItem("tiendaCfg", JSON.stringify(cfg));

    $("logoArchivo").value = "";
    $("bannerArchivo").value = "";
    $("quitar_logo").checked = false;
    $("quitar_banner").checked = false;

    llenarFormulario();
    pintarMarca();
    mostrarMsg("¡Cambios guardados!", "ok");
  }catch(err){
    const texto = err && err.message ? err.message : "No se pudo guardar.";
    if(/column|schema cache/i.test(texto)){
      mostrarMsg("A la tabla «configuracion» le falta alguna columna. Corre el SQL completo de configuracion en Supabase y vuelve a intentar.", "error");
    }else{
      mostrarMsg(texto, "error");
    }
  }finally{
    boton.disabled = false;
  }
});

revisarSesion();
