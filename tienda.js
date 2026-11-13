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

// En las páginas del panel este archivo va en el <head>: antes de pintar
// hay que esperar a que exista el HTML (si Supabase responde rápido, aún no está)
const domListo = new Promise(ok => {
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", ok, { once: true });
  else ok();
});

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
    if(numeroWhatsapp(cfg))  items.push(`<li><span class="label">WhatsApp</span>+${escapeHtml(numeroWhatsapp(cfg))}</li>`);
    if(cfg.footer_direccion){
      // Si la tienda puso su link de Google Maps, la dirección abre el mapa
      const mapa = safeUrl(cfg.footer_mapa_url);
      const dir = escapeHtml(cfg.footer_direccion);
      items.push(`<li><span class="label">Dirección</span>${mapa ? `<a href="${mapa}" target="_blank" rel="noopener">${dir} ↗</a>` : dir}</li>`);
    }else if(safeUrl(cfg.footer_mapa_url)){
      items.push(`<li><span class="label">Ubicación</span><a href="${safeUrl(cfg.footer_mapa_url)}" target="_blank" rel="noopener">Ver en Google Maps ↗</a></li>`);
    }
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

  pintarUbicacion(cfg);

  const copy = document.getElementById("footerCopy");
  if(copy){
    const anio = new Date().getFullYear();
    copy.textContent = `© ${anio} ${cfg.nombre_tienda || ""}. Todos los derechos reservados.`;
  }
}

// Cuadro de ubicación en el pie:
//  · con dirección → mini mapa (al tocarlo abre Google Maps)
//  · sin dirección → "Tienda 100 % en línea" con botón a WhatsApp
function pintarUbicacion(cfg){
  const caja = document.getElementById("footerUbicacion");
  if(!caja) return;
  const dir = String(cfg.footer_direccion || "").trim();
  const link = safeUrl(cfg.footer_mapa_url);
  const wa = numeroWhatsapp(cfg);
  if(dir || link){
    const destino = link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}`;
    // El mapa pequeño se dibuja con la dirección escrita (el link corto de Maps no se puede incrustar)
    const mapa = dir
      ? `<iframe src="https://maps.google.com/maps?q=${encodeURIComponent(dir)}&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" tabindex="-1" aria-hidden="true" title="Mapa"></iframe>`
      : `<span class="ubi-mapa-falso" aria-hidden="true"></span>`;
    caja.innerHTML = `
      <a class="ubi-card" href="${destino}" target="_blank" rel="noopener" aria-label="Ver la ubicación en Google Maps">
        <span class="ubi-mapa">${mapa}<span class="ubi-pin" aria-hidden="true"></span></span>
        <span class="ubi-pie">
          <span class="ubi-txt"><b>Visítanos</b><small>${escapeHtml(dir || "Ver ubicación")}</small></span>
          <span class="ubi-ir">Cómo llegar ↗</span>
        </span>
      </a>`;
  }else{
    caja.innerHTML = `
      <div class="ubi-card ubi-virtual">
        <span class="ubi-icono" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>
        </span>
        <span class="ubi-txt"><b>Tienda 100 % en línea</b><small>Pide por WhatsApp y te lo llevamos a domicilio.</small></span>
        ${wa ? `<a class="ubi-ir" href="https://wa.me/${wa}" target="_blank" rel="noopener">Escríbenos ↗</a>` : ""}
      </div>`;
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
  // Si el servidor ya puso el título para Google (nombre + ciudad + qué es), se respeta
  const nombreT = String(cfg.nombre_tienda || "").trim();
  if(!nombreT || !document.title.startsWith(nombreT)){
    const generico = /^(nuestra colecci[oó]n|cat[aá]logo|bienvenid[oa]s?|inicio|tienda|t[ií]tulo que se ve.*)$/i;
    const propio = String(cfg.portada_titulo || "").trim();
    document.title = propio && !generico.test(propio) ? `${nombreT} | ${propio}` : `${nombreT} | Catálogo y pedidos por WhatsApp`;
  }

  // Foto del banner (si no hay, se queda la que trae el CSS por defecto)
  const banner = urlSegura(cfg.banner_url);
  const delServidor = document.documentElement.classList.contains("con-portada-m");
  if(delServidor){ /* el servidor ya puso la foto grande y la de celular */ }
  else if(banner){
    document.documentElement.style.setProperty("--hero-img", `url("${banner.replace(/"/g, "%22")}")`);
  }else{
    document.documentElement.style.removeProperty("--hero-img");
  }
  // Con foto: la portada usa la foto con un velo del color de fondo. Sin foto: fondo animado de colores
  document.documentElement.classList.toggle("con-portada", Boolean(banner));
  // Intensidad de la sombra sobre la foto (normal / suave / minimo)
  if(["suave", "minimo"].includes(cfg.portada_velo)) document.documentElement.dataset.velo = cfg.portada_velo;
  else delete document.documentElement.dataset.velo;

  pintarFooter(cfg);
  pintarWhatsappFlotante(cfg);
  pintarPortadaVacia(cfg);

  // Descripción de la página con los textos de la tienda
  const desc = document.querySelector('meta[name="description"]');
  const base = String(cfg.portada_subtitulo || cfg.footer_texto || "").replace(/\s+/g, " ").trim();
  const relleno = `Mira el catálogo de ${cfg.nombre_tienda || "la tienda"}, elige tus productos y haz tu pedido por WhatsApp.`;
  if(desc) desc.setAttribute("content", base.length >= 50 ? base : (base ? `${base.replace(/[.\s]+$/, "")}. ${relleno}` : relleno));
  // Título principal (oculto en pantalla) con el nombre de la tienda
  const h1 = document.getElementById("tiendaH1");
  if(h1 && cfg.nombre_tienda) h1.textContent = cfg.nombre_tienda;
}

// Si la tienda no puso frase, subtítulo ni botón, no se muestra el cuadro vacío
function pintarPortadaVacia(cfg){
  const cta = document.querySelector(".hero-cta");
  if(cta) cta.hidden = !String(cfg.portada_boton || "").trim();
  const caja = document.querySelector(".hero-overlay");
  if(caja) caja.hidden = !["portada_frase", "portada_subtitulo", "portada_boton"].some(c => String(cfg[c] || "").trim());
}

// Número de WhatsApp real de la tienda, o "" si no lo ha puesto
// (573000000000 es el valor de relleno con el que se crea una tienda nueva)
function numeroWhatsapp(cfg){
  const n = String((cfg && cfg.whatsapp) || "").replace(/\D/g, "");
  return n.length >= 10 && n !== "573000000000" ? n : "";
}

// Botón flotante de WhatsApp (solo si la tienda tiene número)
function pintarWhatsappFlotante(cfg){
  const btn = porId("waFlotante");
  if(!btn) return;
  const numero = numeroWhatsapp(cfg);
  if(!numero){ btn.hidden = true; return; }
  const texto = `Hola${cfg.nombre_tienda ? " " + cfg.nombre_tienda : ""}, vi su catálogo y tengo una pregunta.`;
  btn.href = enlaceWhatsapp(numero, texto);
  btn.hidden = false;
}

// 1) Lo último que se guardó en este navegador: evita ver los textos de ejemplo un instante
domListo.then(() => {
  try{
    const guardada = JSON.parse(localStorage.getItem(CFG_CACHE));
    if(guardada && !window.CFG) aplicarConfiguracion(guardada);
  }catch(e){ /* si el caché está dañado, se ignora */ }
});

// 2) Lo que hay ahora en Supabase
if(window.configTienda){
  Promise.all([window.configTienda, domListo]).then(([cfg]) => {
    if(!cfg) return;
    aplicarConfiguracion(cfg);
    iconoPestana(cfg);
    try{ localStorage.setItem(claveLocal("tiendaCfg"), JSON.stringify(cfg)); }catch(e){}
  });
}

// La pestaña del navegador muestra el logo de la tienda (Google sigue usando el ícono de LinkTalogo)
function iconoPestana(cfg){
  const logo = String((cfg && cfg.logo_url) || "").trim();
  if(!/^https:\/\//i.test(logo) || cfg.quitar_logo === true) return;
  document.querySelectorAll('link[rel="icon"]').forEach(l => l.remove());
  const link = document.createElement("link");
  link.rel = "icon"; link.href = logo;
  document.head.appendChild(link);
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
  if(urlSegura(cfg.banner_url) && !cfg.quitar_banner && !document.documentElement.classList.contains("con-portada-m")){
    document.documentElement.style.setProperty("--hero-img", `url("${urlSegura(cfg.banner_url).replace(/"/g, "%22")}")`);
    document.documentElement.classList.add("con-portada");
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

Promise.all([window.configTienda, domListo]).then(([cfg]) => {
  if(!cfg) return;

  // Marca visual en las 3 páginas
  pintarBrands(cfg);

  // Los elementos siguientes solo existen en index.html,
  // pero las funciones ya comprueban si el elemento existe.
  pintarHero(cfg);
  pintarFooter(cfg);
  pintarCategoriasFooter(cfg);
});