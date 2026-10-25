// tema.js: conecta los colores de TODAS las páginas a una sola paleta.
// Solo cambia colores de acento. Los fondos y grises de cada página no se tocan.

const PALETAS = {
    // ==========================================
  // PALETAS CLÁSICAS Y DE LUJO
  // ==========================================
  esmeralda_lujo: {
    acento:       "#059669", // Verde esmeralda
    acentoClaro:  "#10b981",
    acentoOscuro: "#064e3b",
    secundario:   "#fbbf24", // Dorado
    bg:           "#022c22", // Fondo verde muy oscuro
    bg2:          "#064e3b",
    card:         "#064e3b",
    texto:        "#ecfdf5",
    textoSuave:   "#a7f3d0",
    textoAcento:  "#ffffff",
    borde:        "#065f46"
  },
  borgona_oro: {
    acento:       "#9f1239", // Vino/Borgoña
    acentoClaro:  "#e11d48",
    acentoOscuro: "#4c0519",
    secundario:   "#d4af37", // Oro puro
    bg:           "#0c0002", 
    bg2:          "#1a0006",
    card:         "#26000b",
    texto:        "#fdf8f8",
    textoSuave:   "#d4a3ab",
    textoAcento:  "#ffffff",
    borde:        "#4c0519"
  },
  azul_marino_oro: {
    acento:       "#1e3a8a", // Azul marino clásico
    acentoClaro:  "#3b82f6",
    acentoOscuro: "#172554",
    secundario:   "#fbbf24", // Dorado
    bg:           "#0f172a",
    bg2:          "#1e293b",
    card:         "#1e293b",
    texto:        "#f8fafc",
    textoSuave:   "#94a3b8",
    textoAcento:  "#ffffff",
    borde:        "#334155"
  },
  marfil_minimal: {
    acento:       "#78350f", // Café oscuro / Chocolate
    acentoClaro:  "#b45309",
    acentoOscuro: "#451a03",
    secundario:   "#d97706",
    bg:           "#fafaf9", // Fondo marfil/beige
    bg2:          "#f5f5f4",
    card:         "#ffffff",
    texto:        "#1c1917", // Texto casi negro para contrastar
    textoSuave:   "#78716c",
    textoAcento:  "#ffffff",
    borde:        "#e7e5e4"
  },

  // ==========================================
  // PALETAS URBANAS Y DE ALTA COSTURA
  // ==========================================
  concreto_neon: {
    acento:       "#ea580c", // Naranja quemado urbano
    acentoClaro:  "#f97316",
    acentoOscuro: "#9a3412",
    secundario:   "#facc15",
    bg:           "#18181b", // Gris concreto
    bg2:          "#27272a",
    card:         "#27272a",
    texto:        "#fafafa",
    textoSuave:   "#a1a1aa",
    textoAcento:  "#ffffff",
    borde:        "#3f3f46"
  },
  cyberpunk_musico: {
    acento:       "#06b6d4", // Cyan brillante (estilo neón)
    acentoClaro:  "#22d3ee",
    acentoOscuro: "#0891b2",
    secundario:   "#d946ef", // Magenta neón
    bg:           "#000000", // Negro puro
    bg2:          "#09090b",
    card:         "#18181b",
    texto:        "#f4f4f5",
    textoSuave:   "#a1a1aa",
    textoAcento:  "#000000", // Texto negro sobre cyan para que se lea
    borde:        "#27272a"
  },
  blanco_negro: {
    acento:       "#000000", // Minimalismo total
    acentoClaro:  "#333333",
    acentoOscuro: "#000000",
    secundario:   "#666666",
    bg:           "#ffffff", 
    bg2:          "#f3f4f6",
    card:         "#ffffff",
    texto:        "#111827",
    textoSuave:   "#6b7280",
    textoAcento:  "#ffffff",
    borde:        "#e5e7eb"
  },

  // ==========================================
  // PALETAS FEMENINAS, DELICADAS Y MÍSTICAS
  // ==========================================
  rosa_pastel_crema: {
    acento:       "#f472b6", // Rosa suave
    acentoClaro:  "#fbcfe8",
    acentoOscuro: "#be185d",
    secundario:   "#fcd34d", // Amarillo suave
    bg:           "#fdf2f8", // Fondo rosa muy claro
    bg2:          "#ffffff",
    card:         "#ffffff",
    texto:        "#1f2937",
    textoSuave:   "#6b7280",
    textoAcento:  "#ffffff",
    borde:        "#fbcfe8"
  },
  menta_lavanda: {
    acento:       "#0d9488", // Verde menta
    acentoClaro:  "#2dd4bf",
    acentoOscuro: "#115e59",
    secundario:   "#c084fc", // Lavanda
    bg:           "#f0fdfa", // Fondo menta muy claro
    bg2:          "#ffffff",
    card:         "#ffffff",
    texto:        "#134e4a",
    textoSuave:   "#475569",
    textoAcento:  "#ffffff",
    borde:        "#ccfbf1"
  },
  amatista_mistico: {
    acento:       "#9333ea", // Púrpura místico
    acentoClaro:  "#c084fc",
    acentoOscuro: "#581c87",
    secundario:   "#f472b6", // Rosa vibrante
    bg:           "#09090b", 
    bg2:          "#18181b",
    card:         "#27272a",
    texto:        "#f4f4f5",
    textoSuave:   "#a1a1aa",
    textoAcento:  "#ffffff",
    borde:        "#3f3f46"
  },
  rosa: {
    acento:       "#ff1493",
    acentoClaro:  "#ff3ca7",
    acentoOscuro: "#b90069",
    secundario:   "#ffd400",
    bg:           "#070707",
    bg2:          "#0c0c0c",
    card:         "#121212",
    texto:        "#f7f7f7",
    textoSuave:   "#a9a9a9",
    textoAcento:  "#ffffff",  // color legible SOBRE el acento
    borde:        "#252525"
  },
  naranja: {
    acento:       "#f26a0f",
    acentoClaro:  "#ff8a3d",
    acentoOscuro: "#b84a00",
    secundario:   "#ffc233",
    bg:           "#0a0806",
    bg2:          "#100c07",
    card:         "#161210",
    texto:        "#f7f7f7",
    textoSuave:   "#a9a9a9",
    textoAcento:  "#111111",
    borde:        "#2a2318"
  },
  azul: {
    acento:       "#3b82f6",
    acentoClaro:  "#60a5fa",
    acentoOscuro: "#1d4ed8",
    secundario:   "#22d3ee",
    bg:           "#060a12",
    bg2:          "#0a1018",
    card:         "#0f1620",
    texto:        "#f7f7f7",
    textoSuave:   "#9aa4b3",
    textoAcento:  "#ffffff",
    borde:        "#1a2536"
  },
  morado: {
    acento:       "#8b5cf6",
    acentoClaro:  "#a78bfa",
    acentoOscuro: "#6d28d9",
    secundario:   "#f472b6",
    bg:           "#0b0812",
    bg2:          "#110d1a",
    card:         "#171224",
    texto:        "#f7f7f7",
    textoSuave:   "#a89bb8",
    textoAcento:  "#ffffff",
    borde:        "#271f3a"
  },
  verde: {
    acento:       "#16a34a",
    acentoClaro:  "#4ade80",
    acentoOscuro: "#166534",
    secundario:   "#facc15",
    bg:           "#050a07",
    bg2:          "#08120c",
    card:         "#0e1a12",
    texto:        "#f7f7f7",
    textoSuave:   "#9ab3a2",
    textoAcento:  "#ffffff",
    borde:        "#1a3020"
  },
  rojo: {
    acento:       "#e11d48",
    acentoClaro:  "#fb7185",
    acentoOscuro: "#9f1239",
    secundario:   "#fbbf24",
    bg:           "#0d0407",
    bg2:          "#12080b",
    card:         "#1a0d11",
    texto:        "#f7f7f7",
    textoSuave:   "#b3a0a5",
    textoAcento:  "#ffffff",
    borde:        "#2c1a1e"
  },
  claro: {
    // ✅ Paleta CLARA completa — antes era "blanco" y rompía todo
    acento:       "#ff1493",
    acentoClaro:  "#ff3ca7",
    acentoOscuro: "#b90069",
    secundario:   "#f59e0b",
    bg:           "#f7f7f7",
    bg2:          "#ffffff",
    card:         "#ffffff",
    texto:        "#111111",   // texto oscuro sobre fondo claro
    textoSuave:   "#555555",
    textoAcento:  "#ffffff",
    borde:        "#e5e5e5"
  },
  oscuro: {
    // ✅ Paleta OSCURA neutra (la que ya tienes por defecto)
    acento:       "#ff6a00",
    acentoClaro:  "#ff8a2a",
    acentoOscuro: "#c24800",
    secundario:   "#ffd400",
    bg:           "#070707",
    bg2:          "#0c0c0c",
    card:         "#121212",
    texto:        "#f7f7f7",
    textoSuave:   "#a9a9a9",
    textoAcento:  "#111111",
    borde:        "#252525"
  }
};






function hexARgb(hex){
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}
const s = document.documentElement.style;
function aplicarPaleta(clave){
  const p = PALETAS[clave] || PALETAS.rosa;
  const s = document.documentElement.style;

  // Colores de acento
  s.setProperty("--pink", p.acento);
  s.setProperty("--pink-light", p.acentoClaro);
  s.setProperty("--pink-dark", p.acentoOscuro);
  s.setProperty("--yellow", p.secundario);
  s.setProperty("--gold", p.secundario);

  // ✅ Fondos y textos (esto es lo nuevo que hace que TODO se adapte)
  s.setProperty("--black", p.bg);
  s.setProperty("--black-2", p.bg2);
  s.setProperty("--dark", p.card);
  s.setProperty("--dark-2", p.card);
  s.setProperty("--card", p.card);
  s.setProperty("--white", p.texto);
  s.setProperty("--soft-white", p.textoSuave);
  s.setProperty("--muted", p.textoSuave);
  s.setProperty("--line", p.borde);
  s.setProperty("--line-light", p.borde);

  // Colores RGBA
  s.setProperty("--pink-rgb", hexARgb(p.acento));
  s.setProperty("--yellow-rgb", hexARgb(p.secundario));

  // Derivados
  s.setProperty("--pink-soft", `rgba(${hexARgb(p.acento)}, .14)`);
  s.setProperty("--grad", `linear-gradient(100deg, ${p.acento} 0%, ${p.secundario} 100%)`);

  // Para texto legible sobre el acento
  s.setProperty("--texto-acento", p.textoAcento);

  // Compatibilidad con el viejo --orange
  s.setProperty("--orange", p.acento);

  // ¿Fondo claro u oscuro? style.css ajusta las partes que tenían negro fijo
  const n = parseInt(String(p.bg).slice(1), 16);
  const luz = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  document.documentElement.dataset.fondo = luz > 150 ? "claro" : "oscuro";
}

/* =========================================================
   ESTILOS DE LETRA
   Cada estilo = una letra para títulos + una para textos (Google Fonts).
   La tienda usa:  var(--font-titulo)  var(--font-texto)  var(--font-titulo-peso)
   ========================================================= */
const FUENTES = {
  moderno: {
    nombre: "Moderna", descripcion: "Fuerte y llamativa",
    titulo: "'Bebas Neue', Impact, sans-serif", texto: "'Inter', system-ui, sans-serif", peso: 400,
    google: "family=Bebas+Neue&family=Inter:wght@400;500;600;700;800;900"
  },
  elegante: {
    nombre: "Elegante", descripcion: "Fina, para marcas premium",
    titulo: "'Playfair Display', Georgia, serif", texto: "'Lato', system-ui, sans-serif", peso: 700,
    google: "family=Playfair+Display:wght@600;700;800&family=Lato:wght@400;700;900"
  },
  minimal: {
    nombre: "Minimalista", descripcion: "Limpia y actual",
    titulo: "'Montserrat', system-ui, sans-serif", texto: "'Montserrat', system-ui, sans-serif", peso: 800,
    google: "family=Montserrat:wght@400;500;600;700;800;900"
  },
  urbano: {
    nombre: "Urbana", descripcion: "Streetwear, deportiva",
    titulo: "'Anton', Impact, sans-serif", texto: "'Roboto', system-ui, sans-serif", peso: 400,
    google: "family=Anton&family=Roboto:wght@400;500;700;900"
  },
  clasico: {
    nombre: "Clásica", descripcion: "Tradicional y confiable",
    titulo: "'Cormorant Garamond', Georgia, serif", texto: "'Nunito Sans', system-ui, sans-serif", peso: 700,
    google: "family=Cormorant+Garamond:wght@600;700&family=Nunito+Sans:wght@400;600;700;800;900"
  },
  divertido: {
    nombre: "Divertida", descripcion: "Redondeada, para niños o regalos",
    titulo: "'Fredoka', system-ui, sans-serif", texto: "'Nunito', system-ui, sans-serif", peso: 600,
    google: "family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800;900"
  },
  delicado: {
    nombre: "Delicada", descripcion: "Suave, para belleza o accesorios",
    titulo: "'Josefin Sans', system-ui, sans-serif", texto: "'Raleway', system-ui, sans-serif", peso: 700,
    google: "family=Josefin+Sans:wght@500;600;700&family=Raleway:wght@400;500;600;700;800;900"
  }
};

// Carga la letra desde Google Fonts (una sola vez por estilo) y la aplica a la página
function aplicarFuente(clave){
  const f = FUENTES[clave] || FUENTES.moderno;
  const id = "fuente-" + (FUENTES[clave] ? clave : "moderno");
  if(!document.getElementById(id)){
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${f.google}&display=swap`;
    document.head.appendChild(link);
  }
  const raiz = document.documentElement.style;
  raiz.setProperty("--font-titulo", f.titulo);
  raiz.setProperty("--font-texto", f.texto);
  raiz.setProperty("--font-titulo-peso", String(f.peso));
}

/* =========================================================
   OPCIONES DE LOS PRODUCTOS
   Cada producto tiene opciones libres que escribe la tienda
   (ej. "S negro, M negro, XL azul" o "50 ml, 100 ml") y el comprador elige una.
   Si no escribe ninguna, el producto queda con una sola opción "Única"
   que no se muestra.
   ========================================================= */
const OPCION_UNICA = "Única";
function esOpcionUnica(valor){ return String(valor || "").trim().toLowerCase() === "única"; }

// Separa lo que escribió la tienda: por comas, saltos de línea o " - "
function separarOpciones(texto){
  const vistas = new Set();
  return String(texto || "")
    .split(/\s*(?:,|;|\n|\s[-–]\s)\s*/)
    .map(x => x.trim().replace(/\s+/g, " "))
    .filter(x => x && !vistas.has(x.toLowerCase()) && vistas.add(x.toLowerCase()));
}

/* =========================================================
   TIENDA ACTUAL (multi-tienda)
   ---------------------------------------------------------
   · Catálogo y pedido: la tienda sale del link  ?t=slug
   · Panel admin: la tienda sale del usuario logueado (no del link)
   Los demás scripts usan:
     await window.tiendaActual   → { id, slug, activa } o null
     await window.configTienda   → fila de "configuracion" o null
     linkTienda("pedido.html", { codigo }) → "pedido.html?t=slug&codigo=..."
     claveLocal("capCart")       → nombre para localStorage separado por tienda
   ========================================================= */

// Tienda que se abre cuando el link NO trae ?t= (para que los links viejos sigan funcionando).
// Déjalo en "" si prefieres que sin ?t= salga "Tienda no encontrada".
const TIENDA_POR_DEFECTO = "lookshop";

const ES_PAGINA_ADMIN = /(admin|agregarPrenda|editarPrenda|ajustes)\.html$/i.test(location.pathname);

function limpiarSlug(valor){
  return String(valor || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

const SLUG_URL = limpiarSlug(new URLSearchParams(location.search).get("t"));

// localStorage es compartido por TODAS las tiendas (mismo dominio): cada clave lleva el slug
function leerLocal(clave){ try{ return localStorage.getItem(clave); }catch(e){ return null; } }
function guardarLocal(clave, valor){ try{ localStorage.setItem(clave, valor); }catch(e){} }

let SLUG_ACTUAL = ES_PAGINA_ADMIN
  ? (leerLocal("adminSlug") || SLUG_URL)          // en el panel: la última tienda que se abrió
  : (SLUG_URL || TIENDA_POR_DEFECTO);

function claveLocal(nombre){ return `${nombre}:${SLUG_ACTUAL || "_"}`; }

function linkTienda(pagina, extra){
  const params = new URLSearchParams();
  if(SLUG_ACTUAL) params.set("t", SLUG_ACTUAL);
  Object.entries(extra || {}).forEach(([k, v]) => params.set(k, v));
  const q = params.toString();
  return q ? `${pagina}?${q}` : pagina;
}

async function buscarTiendaPublica(slug){
  if(!slug) return null;
  const { data, error } = await supabaseClient.rpc("tienda_publica", { p_slug: slug });
  if(error){ console.error("No se pudo buscar la tienda:", error); return null; }
  return data && data.length ? { id: data[0].id, slug, activa: data[0].activa } : null;
}

window.tiendaActual = (async () => {
  try{
    if(ES_PAGINA_ADMIN){
      const { data: { session } } = await supabaseClient.auth.getSession();
      // Sin sesión (pantalla de login): si el link trae ?t=, se muestra la marca de esa tienda
      if(!session) return buscarTiendaPublica(SLUG_URL);

      const { data, error } = await supabaseClient.rpc("mi_tienda_info");
      if(error){ console.error("No se pudo leer tu tienda:", error); return null; }
      if(!data || !data.length) return null;          // usuario sin tienda asignada
      const t = data[0];
      SLUG_ACTUAL = t.slug;
      guardarLocal("adminSlug", t.slug);
      return t;                                       // { id, slug, nombre, activa, vence }
    }
    return buscarTiendaPublica(SLUG_ACTUAL);
  }catch(err){
    console.error(err);
    return null;
  }
})();

// 1) Aplica enseguida la paleta (y la letra) de la visita anterior a ESTA tienda (evita el parpadeo)
const paletaGuardada = leerLocal(claveLocal("tiendaPaleta"));
aplicarPaleta(paletaGuardada || "rosa");
if(!ES_PAGINA_ADMIN) aplicarFuente(leerLocal(claveLocal("tiendaFuente")) || "moderno");

// 2) Una sola consulta de configuración para toda la página.
//    Los demás scripts la reutilizan con:  const cfg = await window.configTienda;
window.configTienda = window.tiendaActual
  .then(async tienda => {
    if(!tienda) return null;
    const { data, error } = await supabaseClient
      .from("configuracion")
      .select("*")
      .eq("tienda_id", tienda.id)
      .maybeSingle();
    // Tienda vencida o suspendida: el servidor no devuelve su configuración
    if(error || !data){ if(error) console.error("No se pudo leer la configuración:", error); return null; }
    aplicarPaleta(data.paleta);
    guardarLocal(claveLocal("tiendaPaleta"), data.paleta);
    if(!ES_PAGINA_ADMIN){
      aplicarFuente(data.fuente);
      guardarLocal(claveLocal("tiendaFuente"), data.fuente || "moderno");
    }
    return data;
  })
  .catch(err => { console.error(err); return null; });

// 3) Primera visita sin paleta guardada: oculta la página hasta saber los colores
if(!paletaGuardada){
  const html = document.documentElement;
  html.style.visibility = "hidden";
  const mostrar = () => { html.style.visibility = ""; };
  window.configTienda.then(mostrar);
  setTimeout(mostrar, 1500);
}

// 4) Los links a index.html llevan a la tienda correcta (agrega ?t=slug)
window.tiendaActual.then(() => {
  const ajustarLinks = () => {
    document.querySelectorAll('a[href="index.html"], a[href^="index.html#"]').forEach(a => {
      const [pagina, ancla] = a.getAttribute("href").split("#");
      a.setAttribute("href", linkTienda(pagina) + (ancla ? "#" + ancla : ""));
    });
  };
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ajustarLinks);
  else ajustarLinks();
});
