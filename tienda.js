// tienda.js — aplica al catálogo lo que el cliente guardó en "Mi tienda".
// Va en index.html ANTES de script.js, al final del <body>.
// Necesita tema.js en el <head> (aporta window.configTienda).
//
// Cómo se conecta con el HTML:
//   - Cualquier elemento con  data-cfg="columna"  recibe el texto de esa columna,
//     y se oculta solo si el cliente la deja vacía.
//   - Lo demás (marca, buscador, banner, footer) se arma por id.

const CFG_CACHE = claveLocal("tiendaCfg");   // separado por tienda (viene de tema.js)
window.CFG = null;

const porId = id => document.getElementById(id);

// Solo links http(s): estos valores terminan en un href
function urlSegura(u){
  return typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
}

function formatearWhatsapp(valor){
  const d = String(valor || "").replace(/\D/g, "");
  if(d.length === 12 && d.startsWith("57")){
    return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  return d ? "+" + d : "";
}

// Logo (si hay) y/o nombre dentro de un enlace de marca
function pintarMarca(el, cfg){
  if(!el) return;
  el.textContent = "";

  const logo = urlSegura(cfg.logo_url);
  if(logo){
    const img = document.createElement("img");
    img.src = logo;
    img.alt = cfg.nombre_tienda || "";
    img.className = "brand-logo";
    el.appendChild(img);
  }

  if(!logo || cfg.mostrar_nombre){
    const nombre = document.createElement("span");
    nombre.textContent = cfg.nombre_tienda || "";
    el.appendChild(nombre);
  }
}

function enlace(texto, href){
  const a = document.createElement("a");
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = texto;
  return a;
}

function pintarFooter(cfg){
  // Rellena footer: brand, texto, contacto, categorías, copyright
  const brand = document.getElementById("footerBrand");
  if(brand){
    brand.innerHTML = cfg.logo_url
      ? `<img src="${safeUrl(cfg.logo_url)}" alt="${escapeHtml(cfg.nombre_tienda || '')}"> ${escapeHtml(cfg.nombre_tienda || '')}`
      : escapeHtml(cfg.nombre_tienda || '');
  }

  const texto = document.getElementById("footerTexto");
  if(texto) texto.textContent = cfg.footer_texto || "";

  const contacto = document.getElementById("footerContacto");
  if(contacto){
    const items = [];
    if(cfg.whatsapp)         items.push(`<li><span class="label">WhatsApp</span>+${escapeHtml(cfg.whatsapp)}</li>`);
    if(cfg.footer_direccion) items.push(`<li><span class="label">Dirección</span>${escapeHtml(cfg.footer_direccion)}</li>`);
    if(cfg.footer_horario)   items.push(`<li><span class="label">Horario</span>${escapeHtml(cfg.footer_horario)}</li>`);
    contacto.innerHTML = items.join("");
  }

  const social = document.getElementById("footerSocial");
  if(social){
    const redes = [];
    if(cfg.instagram_url) redes.push(`<a href="${safeUrl(cfg.instagram_url)}" target="_blank" rel="noopener"><i class="bi bi-instagram"></i> Instagram</a>`);
    if(cfg.tiktok_url)    redes.push(`<a href="${safeUrl(cfg.tiktok_url)}"    target="_blank" rel="noopener"><i class="bi bi-tiktok"></i> TikTok</a>`);
    if(cfg.facebook_url)  redes.push(`<a href="${safeUrl(cfg.facebook_url)}"  target="_blank" rel="noopener"><i class="bi bi-facebook"></i> Facebook</a>`);
    social.innerHTML = redes.join("");
  }

  const copy = document.getElementById("footerCopy");
  if(copy){
    const anio = new Date().getFullYear();
    copy.textContent = `© ${anio} ${cfg.nombre_tienda || ""}. Todos los derechos reservados.`;
  }
}

function aplicarConfiguracion(cfg){
  if(!cfg) return;
  window.CFG = cfg;

  // Textos marcados con data-cfg
  document.querySelectorAll("[data-cfg]").forEach(el => {
    const valor = String(cfg[el.dataset.cfg] ?? "").trim();
    el.textContent = valor;
    el.hidden = !valor;
  });

  // Barra superior
  pintarMarca(porId("topbarBrand"), cfg);

  // Buscador

  // Pestaña del navegador
  document.title = cfg.portada_titulo
    ? `${cfg.nombre_tienda} | ${cfg.portada_titulo}`
    : cfg.nombre_tienda;

  // Foto del banner (si no hay, se queda la que trae el CSS por defecto)
  const banner = urlSegura(cfg.banner_url);
  if(banner){
    document.documentElement.style.setProperty("--hero-img", `url("${banner.replace(/"/g, "%22")}")`);
  }else{
    document.documentElement.style.removeProperty("--hero-img");
  }

  pintarFooter(cfg);
}

// 1) Lo último que se guardó en este navegador: evita ver los textos de ejemplo un instante
try{
  const guardada = JSON.parse(localStorage.getItem(CFG_CACHE));
  if(guardada) aplicarConfiguracion(guardada);
}catch(e){ /* si el caché está dañado, se ignora */ }

// 2) Lo que hay ahora en Supabase
if(window.configTienda){
  window.configTienda.then(cfg => {
    if(!cfg) return;
    aplicarConfiguracion(cfg);
    try{ localStorage.setItem(claveLocal("tiendaCfg"), JSON.stringify(cfg)); }catch(e){}
  });
}

// ============================================================
// Rellena todos los brand-unificados de la página
// ============================================================
function pintarBrands(cfg){
  const logo     = cfg?.logo_url || "";
  const nombre   = cfg?.nombre_tienda || "Mi tienda";
  const mostrar  = cfg?.mostrar_nombre !== false;   // por defecto sí
  const sinLogo  = !logo || cfg?.quitar_logo === true;

  document.querySelectorAll(".brand-unificado").forEach(el => {
    // Construir HTML interno
    let html = "";

    if(!sinLogo){
      html += `<img class="brand-logo" src="${safeUrl(logo)}" alt="${escapeHtml(nombre)}"
                    onerror="this.style.display='none'">`;
    }
    if(mostrar){
      html += `<span class="brand-nombre">${escapeHtml(nombre)}</span>`;
    }

    // Fallback: si no hay ni logo ni nombre, mostrar el nombre igual
    if(!html){
      html = `<span class="brand-nombre">${escapeHtml(nombre)}</span>`;
    }

    el.innerHTML = html;
    el.classList.toggle("sin-logo", sinLogo);
    el.classList.toggle("sin-nombre", !mostrar);
  });
}

function pintarHero(cfg){
  document.querySelectorAll("[data-cfg]").forEach(el => {
    const clave = el.dataset.cfg;
    if(cfg[clave] !== undefined && cfg[clave] !== null){
      el.textContent = cfg[clave];
    }
  });

  // Banner del hero como imagen de fondo
  if(cfg.banner_url && !cfg.quitar_banner){
    document.documentElement.style.setProperty("--hero-img", `url("${cfg.banner_url}")`);
  }
}

function pintarCategoriasFooter(cfg){
  // Rellena #footerCats con las categorías del catálogo
  const cont = document.getElementById("footerCats");
  if(!cont) return;
  window.tiendaActual.then(tienda => {
    if(!tienda) return;
    supabaseClient
      .from("categorias")
      .select("nombre")
      .eq("tienda_id", tienda.id)
      .order("nombre")
      .then(({ data, error }) => {
        if(error || !data) return;
        cont.innerHTML = data
          .map(c => `<li><a href="${escapeHtml(linkTienda("index.html"))}">${escapeHtml(c.nombre)}</a></li>`)
          .join("");
      });
  });
}

window.configTienda.then(cfg => {
  if(!cfg) return;

  // Marca visual en las 3 páginas
  pintarBrands(cfg);

  // Los elementos siguientes solo existen en index.html,
  // pero las funciones ya comprueban si el elemento existe.
  pintarHero(cfg);
  pintarFooter(cfg);
  pintarCategoriasFooter(cfg);
});