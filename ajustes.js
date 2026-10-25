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
let fuenteElegida = "moderno";

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

let tienda = null;

async function iniciar(){
  tienda = await window.tiendaActual;
  if(!tienda){ window.location.href = "admin.html"; return; }
  cfg = await window.configTienda;
  if(!cfg){
    mostrarMsg("No se pudo leer la configuración. Revisa que la tabla «configuracion» exista en Supabase.", "error");
    return;
  }
  construirPaletas();
  construirFuentes();
  llenarFormulario();
  pintarMarca();
  marcarGuardado();
}

/* ---------------------------------------------------------
   MENSAJES
   --------------------------------------------------------- */
function mostrarMsg(texto, tipo){
  const m = $("formMsg");
  m.className = "form-msg" + (tipo ? " " + tipo : "");
  m.textContent = texto;
  // El mensaje vive en la barra fija de abajo: siempre está a la vista
  if(tipo === "ok") setTimeout(() => { if(m.textContent === texto) m.textContent = ""; }, 3500);
}

/* ---------------------------------------------------------
   PALETAS
   --------------------------------------------------------- */
// Nombres legibles (las claves internas no cambian)
const NOMBRES_PALETA = {
  esmeralda_lujo: "Esmeralda lujo", borgona_oro: "Borgoña y oro", azul_marino_oro: "Azul marino y oro",
  marfil_minimal: "Marfil", concreto_neon: "Concreto neón", cyberpunk_musico: "Cyberpunk",
  blanco_negro: "Blanco y negro", rosa_pastel_crema: "Rosa pastel", menta_lavanda: "Menta y lavanda",
  amatista_mistico: "Amatista", rosa: "Rosa", naranja: "Naranja", azul: "Azul", morado: "Morado",
  verde: "Verde", rojo: "Rojo", claro: "Claro", oscuro: "Oscuro",
  noche_dorada: "Noche dorada", grafito_lima: "Grafito y lima", oceano_coral: "Océano y coral",
  cafe_caramelo: "Café caramelo", aurora_boreal: "Aurora boreal", fucsia_neon: "Fucsia neón",
  perla_oro: "Perla y oro", arena_terracota: "Arena y terracota", cielo_limpio: "Cielo limpio",
  salvia_natural: "Salvia natural", lavanda_suave: "Lavanda suave", durazno_fresco: "Durazno fresco"
};
const nombrePaleta = k => String(k).startsWith("personal:") ? "Tu paleta" : NOMBRES_PALETA[k] || (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");

// ¿El fondo es claro? (para separar paletas claras y oscuras)
function esClaro(hex){
  const n = parseInt(String(hex).slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}

function tarjetaPaleta(clave, p){
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "paleta";
  btn.dataset.paleta = clave;
  btn.setAttribute("aria-label", "Colores " + nombrePaleta(clave));

  // Mini tienda: fondo, título, línea de texto, botón con el acento y punto con el secundario
  const muestra = document.createElement("span");
  muestra.className = "paleta-muestra";
  muestra.style.background = `linear-gradient(160deg, ${p.bg} 55%, ${p.card})`;
  muestra.style.color = p.texto;

  const titulo = document.createElement("b");
  titulo.textContent = "Aa";
  const linea = document.createElement("span");
  linea.className = "pm-linea";
  linea.style.background = p.textoSuave;
  const boton = document.createElement("span");
  boton.className = "pm-boton";
  boton.textContent = "AÑADIR";
  boton.style.background = p.acento;
  boton.style.color = p.textoAcento;
  const punto = document.createElement("span");
  punto.className = "pm-punto";
  punto.style.background = p.secundario;

  muestra.append(titulo, linea, boton, punto);

  const nombre = document.createElement("span");
  nombre.className = "paleta-nombre";
  nombre.textContent = nombrePaleta(clave);

  btn.append(muestra, nombre);
  return btn;
}

function construirPaletas(){
  const cont = $("paletas");
  cont.textContent = "";

  const grupos = { "OSCUROS": [], "CLAROS": [] };
  Object.entries(PALETAS).forEach(([clave, p]) => {
    grupos[esClaro(p.bg) ? "CLAROS" : "OSCUROS"].push([clave, p]);
  });

  Object.entries(grupos).forEach(([titulo, lista]) => {
    if(!lista.length) return;
    const h = document.createElement("p");
    h.className = "aj-grupo-titulo";
    h.textContent = `FONDO ${titulo}`;
    const grid = document.createElement("div");
    grid.className = "aj-paletas-grid";
    lista.forEach(([clave, p]) => grid.appendChild(tarjetaPaleta(clave, p)));
    cont.append(h, grid);
  });

  cont.append(...bloquePersonal());

  cont.addEventListener("click", e => {
    const btn = e.target.closest("[data-paleta]");
    if(btn){ elegirPaleta(btn.dataset.paleta); marcarCambio(); }
  });
}

/* ---------- Paleta personalizada: la tienda escoge sus 2 colores y el fondo ---------- */
function clavePersonal(){
  const modo = document.querySelector('input[name="pModo"]:checked')?.value || "oscuro";
  return `personal:${$("pAcento").value.toLowerCase()}:${$("pSecundario").value.toLowerCase()}:${modo}`;
}

function bloquePersonal(){
  const h = document.createElement("p");
  h.className = "aj-grupo-titulo";
  h.textContent = "CREA TU PROPIA PALETA";

  const caja = document.createElement("div");
  caja.className = "aj-personal";
  caja.innerHTML = `
    <div class="aj-personal-muestra" id="pMuestra"></div>
    <div class="aj-personal-controles">
      <label class="aj-color"><input type="color" id="pAcento" value="#e11d48"><span><b>Color principal</b><small>Botones y detalles</small></span></label>
      <label class="aj-color"><input type="color" id="pSecundario" value="#fbbf24"><span><b>Color secundario</b><small>Promociones y efectos</small></span></label>
      <div class="aj-modo" role="radiogroup" aria-label="Fondo">
        <label><input type="radio" name="pModo" value="oscuro" checked><span>🌙 Fondo oscuro</span></label>
        <label><input type="radio" name="pModo" value="claro"><span>☀️ Fondo claro</span></label>
      </div>
      <small class="aj-personal-ayuda">Los textos se ajustan solos para que siempre se puedan leer.</small>
    </div>`;

  const actualizar = (seleccionar) => {
    const clave = clavePersonal();
    const muestra = caja.querySelector("#pMuestra");
    muestra.textContent = "";
    muestra.appendChild(tarjetaPaleta(clave, obtenerPaleta(clave)));
    if(seleccionar){ elegirPaleta(clave); marcarCambio(); }
    else elegirPaleta(paletaElegida);   // solo refresca la marca de seleccionada
  };
  caja.addEventListener("input", e => { if(e.target.matches("input")) actualizar(true); });
  caja.addEventListener("change", e => { if(e.target.matches("input")) actualizar(true); });
  caja._actualizar = actualizar;
  setTimeout(() => actualizar(false));
  return [h, caja];
}

// Pone los controles con los colores de una paleta personal ya guardada
function cargarPersonal(clave){
  const p = paletaPersonal(clave);
  if(!p) return false;
  const [, , , modo] = clave.split(":");
  $("pAcento").value = p.acento;
  $("pSecundario").value = p.secundario;
  const radio = document.querySelector(`input[name="pModo"][value="${modo === "claro" ? "claro" : "oscuro"}"]`);
  if(radio) radio.checked = true;
  const caja = document.querySelector(".aj-personal");
  if(caja && caja._actualizar){ paletaElegida = clave; caja._actualizar(false); }
  return true;
}

function elegirPaleta(clave){
  paletaElegida = clave;
  aplicarPaleta(clave); // vista previa inmediata en esta misma pantalla (viene de tema.js)
  document.querySelectorAll(".paleta").forEach(b => {
    const sel = b.dataset.paleta === clave;
    b.classList.toggle("selected", sel);
    b.setAttribute("aria-pressed", sel ? "true" : "false");
  });
}

/* ---------------------------------------------------------
   ESTILO DE LETRA (FUENTES viene de tema.js)
   --------------------------------------------------------- */
function construirFuentes(){
  const cont = $("fuentes");
  if(!cont || typeof FUENTES === "undefined") return;
  cont.textContent = "";

  // Carga todas las letras de una vez para que las muestras se vean bien
  const familias = Object.values(FUENTES).map(f => f.google).join("&");
  if(!document.getElementById("fuentes-muestra")){
    const link = document.createElement("link");
    link.id = "fuentes-muestra";
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${familias}&display=swap`;
    document.head.appendChild(link);
  }

  const nombreTienda = (cfg && cfg.nombre_tienda) || "Mi tienda";
  Object.entries(FUENTES).forEach(([clave, f]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fuente";
    btn.dataset.fuente = clave;

    const muestra = document.createElement("span");
    muestra.className = "fuente-muestra";
    muestra.style.fontFamily = f.titulo;
    muestra.style.fontWeight = f.peso;
    muestra.textContent = nombreTienda;

    const texto = document.createElement("span");
    texto.className = "fuente-texto";
    texto.style.fontFamily = f.texto;
    texto.textContent = f.descripcion;

    const pie = document.createElement("span");
    pie.className = "fuente-pie";
    pie.textContent = f.nombre;

    btn.append(muestra, texto, pie);
    cont.appendChild(btn);
  });

  cont.addEventListener("click", e => {
    const btn = e.target.closest("[data-fuente]");
    if(btn){ elegirFuente(btn.dataset.fuente); marcarCambio(); }
  });
}

function elegirFuente(clave){
  fuenteElegida = (typeof FUENTES !== "undefined" && FUENTES[clave]) ? clave : "moderno";
  if(typeof aplicarFuente === "function") aplicarFuente(fuenteElegida);   // vista previa en esta pantalla
  document.querySelectorAll(".fuente").forEach(b => {
    const sel = b.dataset.fuente === fuenteElegida;
    b.classList.toggle("selected", sel);
    b.setAttribute("aria-pressed", sel ? "true" : "false");
  });
}

// El nombre de la muestra de letras sigue lo que se escribe en "Nombre de la tienda"
$("nombre_tienda").addEventListener("input", e => {
  const nombre = e.target.value.trim() || "Mi tienda";
  document.querySelectorAll(".fuente-muestra").forEach(el => { el.textContent = nombre; });
});

/* ---------------------------------------------------------
   CAMBIOS SIN GUARDAR
   --------------------------------------------------------- */
let hayCambios = false;
function marcarCambio(){
  hayCambios = true;
  $("sinGuardar").hidden = false;
}
function marcarGuardado(){
  hayCambios = false;
  $("sinGuardar").hidden = true;
}
$("tiendaForm").addEventListener("input", marcarCambio);
$("tiendaForm").addEventListener("change", marcarCambio);
// Aviso del navegador si intenta salir sin guardar
window.addEventListener("beforeunload", e => {
  if(!hayCambios) return;
  e.preventDefault();
  e.returnValue = "";
});

/* ---------------------------------------------------------
   MENÚ DE SECCIONES: marca la sección que se está viendo
   --------------------------------------------------------- */
(function(){
  const links = [...document.querySelectorAll(".aj-nav a")];
  if(!links.length || !("IntersectionObserver" in window)) return;
  const activar = id => links.forEach(a => {
    const on = a.getAttribute("href") === "#" + id;
    a.classList.toggle("activo", on);
    if(on && a.parentElement.scrollWidth > a.parentElement.clientWidth){
      a.scrollIntoView({ block: "nearest", inline: "center" });   // en el celular, el menú sigue la sección
    }
  });
  const obs = new IntersectionObserver(entradas => {
    entradas.filter(e => e.isIntersecting).forEach(e => activar(e.target.id));
  }, { rootMargin: "-30% 0px -60% 0px" });
  document.querySelectorAll(".aj-card[id]").forEach(sec => obs.observe(sec));
})();

/* ---------------------------------------------------------
   LLENAR EL FORMULARIO
   --------------------------------------------------------- */
function llenarFormulario(){
  CAMPOS.forEach(c => { $(c).value = cfg[c] ?? ""; });
  $("mostrar_nombre").checked = Boolean(cfg.mostrar_nombre);
  const esPersonal = String(cfg.paleta || "").startsWith("personal:") && cargarPersonal(cfg.paleta);
  elegirPaleta(esPersonal || cfg.paleta in PALETAS ? cfg.paleta : "rosa");
  elegirFuente(cfg.fuente || "moderno");
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
    const boton = this.closest(".aj-archivo");
    if(boton){
      boton.classList.toggle("con-archivo", Boolean(archivo));
      boton.querySelector("span").textContent = archivo ? "Foto elegida" : (tipo === "logo" ? "Subir logo" : "Subir foto");
    }
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
  // Se comprime antes de revisar el peso: logo hasta 600px, banner hasta 1920px (utils.js)
  archivo = await comprimirImagen(archivo, prefijo === "logo" ? 600 : 1920, 0.85);
  if(archivo.size > limite){
    throw new Error(`La imagen del ${prefijo} pesa demasiado (máximo ${Math.round(limite / 1024 / 1024)} MB).`);
  }

  const ext = ((archivo.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "")) || "jpg";
  // Cada tienda sube a su propia carpeta (lo exige el servidor)
  const nombre = `${tienda.id}/${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

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
    datos.fuente = fuenteElegida;
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

    const { data: guardada, error } = await supabaseClient
      .from("configuracion").update(datos).eq("tienda_id", tienda.id).select("id");
    if(error) throw error;
    if(!guardada || !guardada.length) throw new Error("No se pudo guardar: tu usuario no tiene permiso sobre esta tienda.");

    // Ya guardado: se borran los archivos viejos que dejaron de usarse
    if(anterior.logo && anterior.logo !== logo) await borrarAnterior(anterior.logo).catch(() => {});
    if(anterior.banner && anterior.banner !== banner) await borrarAnterior(anterior.banner).catch(() => {});

    cfg = { ...cfg, ...datos };
    try{
      localStorage.setItem(claveLocal("tiendaPaleta"), datos.paleta);
      localStorage.setItem(claveLocal("tiendaCfg"), JSON.stringify(cfg));
    }catch(e){}

    $("logoArchivo").value = "";
    $("bannerArchivo").value = "";
    document.querySelectorAll(".aj-archivo").forEach(b => {
      b.classList.remove("con-archivo");
      b.querySelector("span").textContent = b.querySelector("#logoArchivo") ? "Subir logo" : "Subir foto";
    });
    $("quitar_logo").checked = false;
    $("quitar_banner").checked = false;

    try{ localStorage.setItem(claveLocal("tiendaFuente"), datos.fuente); }catch(e){}
    llenarFormulario();
    pintarMarca();
    marcarGuardado();
    mostrarMsg("✓ Cambios guardados", "ok");
  }catch(err){
    const texto = err && err.message ? err.message : "No se pudo guardar.";
    if(/column|schema cache/i.test(texto)){
      mostrarMsg("A la base le falta una columna (¿corriste los SQL 003 y 004?).", "error");
    }else{
      mostrarMsg(texto, "error");
    }
  }finally{
    boton.disabled = false;
  }
});

revisarSesion();
