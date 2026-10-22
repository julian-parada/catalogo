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
}

// 1) Aplica enseguida la paleta de la visita anterior (evita el parpadeo)
const paletaGuardada = localStorage.getItem("tiendaPaleta");
aplicarPaleta(paletaGuardada || "rosa");

// 2) Una sola consulta de configuración para toda la página.
//    Los demás scripts la reutilizan con:  const cfg = await window.configTienda;
window.configTienda = supabaseClient
  .from("configuracion")
  .select("*")
  .eq("id", 1)
  .single()
  .then(({ data, error }) => {
    if(error || !data){ console.error("No se pudo leer la configuración:", error); return null; }
    aplicarPaleta(data.paleta);
    localStorage.setItem("tiendaPaleta", data.paleta);
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


