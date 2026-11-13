// funciones-lib/seo.js — código compartido por las funciones de Cloudflare Pages (carpeta functions/).
// Hace que Google y WhatsApp vean el nombre, la descripción y la foto de cada tienda
// sin esperar al JavaScript de la página.
//
// La clave de Supabase es la "anon" (la misma pública de supabaseConfig.js): solo puede
// leer lo que las reglas (RLS) dejan ver a cualquiera.

const SUPABASE_URL = "https://txnvsigmwshwduhearvz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnZzaWdtd3Nod2R1aGVhcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDMzMjgsImV4cCI6MjEwNjIxOTMyOH0.JhO4JYOUTh13aZfDT4eDCioTjShcJsVjgxIXcOOS-uQ";

import { PAGINAS_SEO } from "./paginas-seo.js";
export { PAGINAS_SEO };

// Páginas propias de la plataforma: nunca se confunden con una tienda
export const RESERVADOS = new Set([
  "index", "admin", "ajustes", "agregarprenda", "editarprenda", "pedido",
  "privacidad", "restablecer", "plataforma", "sitemap", "robots", "img", "favicon", "inicio",
  ...PAGINAS_SEO
]);

export const slugValido = s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 60;

function base(env){
  return {
    url: (env && env.SUPABASE_URL) || SUPABASE_URL,
    key: (env && env.SUPABASE_KEY) || SUPABASE_KEY
  };
}

async function supabase(env, ruta){
  const { url, key } = base(env);
  // Máximo 3 segundos: si Supabase está lento, la página carga igual sin esperar
  const r = await fetch(url + ruta, {
    headers: { apikey: key, Authorization: "Bearer " + key, Accept: "application/json" },
    cf: { cacheTtl: 300, cacheEverything: true },    // 5 minutos en caché de Cloudflare
    signal: AbortSignal.timeout(3000)
  });
  if(!r.ok) throw new Error("Supabase " + r.status);
  return r.json();
}

// Datos públicos de una tienda: null si no existe
export async function datosTienda(env, slug){
  const filas = await supabase(env, "/rest/v1/rpc/tienda_publica?p_slug=" + encodeURIComponent(slug));
  if(!Array.isArray(filas) || !filas.length) return null;
  const { id, activa } = filas[0];
  let cfg = null, cats = [];
  if(activa){
    const [c, k] = await Promise.all([
      supabase(env, "/rest/v1/configuracion?select=*&tienda_id=eq." + encodeURIComponent(id)),
      supabase(env, "/rest/v1/categorias?select=nombre&order=orden&tienda_id=eq." + encodeURIComponent(id)).catch(() => [])
    ]);
    cfg = Array.isArray(c) && c.length ? c[0] : null;
    cats = Array.isArray(k) ? k.map(x => String(x.nombre || "").trim()).filter(Boolean) : [];
  }
  return { id, activa, cfg, cats };
}

// Un producto de una tienda activa (las reglas de Supabase solo lo dejan ver si la tienda está al día)
export async function datosProducto(env, tiendaId, productoId){
  const filas = await supabase(env,
    "/rest/v1/prendas?select=*,categorias(nombre),tallas(disponible)" +
    "&id=eq." + encodeURIComponent(productoId) + "&tienda_id=eq." + encodeURIComponent(tiendaId));
  return Array.isArray(filas) && filas.length ? filas[0] : null;
}

// Copia liviana del banner para celular (la sube ajustes.js): "" si no existe
export async function bannerMovil(banner){
  if(!/\/banner_[^/?#]+\.(webp|jpe?g|png)$/i.test(banner)) return "";
  const url = banner.replace(/(\.[a-z0-9]+)$/i, "-m$1");
  // La respuesta (sí/no) se guarda 1 día en la caché de Cloudflare: así no se pregunta en cada visita
  const clave = new Request("https://cache.linktalogo.internal/banner-movil?u=" + encodeURIComponent(url));
  const cache = typeof caches !== "undefined" ? caches.default : null;
  try{
    const guardado = cache && await cache.match(clave);
    if(guardado) return (await guardado.text()) === "1" ? url : "";
  }catch(e){}
  let existe = false;
  try{
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(800) });
    existe = r.ok;
  }catch(e){ return ""; }   // si tardó, no se guarda: se vuelve a intentar en la próxima visita
  try{ if(cache) await cache.put(clave, new Response(existe ? "1" : "0", { headers: { "Cache-Control": "max-age=86400" } })); }catch(e){}
  return existe ? url : "";
}

// Tiendas activas para el sitemap
export async function tiendasActivas(env){
  const filas = await supabase(env, "/rest/v1/rpc/tiendas_publicas");
  return Array.isArray(filas) ? filas : [];
}

// Productos de varias tiendas (para el sitemap): [{ id, tienda_id }]
export async function productosDe(env, ids){
  if(!ids.length) return [];
  const lista = ids.map(id => encodeURIComponent(id)).join(",");
  const filas = await supabase(env, "/rest/v1/prendas?select=id,tienda_id&tienda_id=in.(" + lista + ")&order=id");
  return Array.isArray(filas) ? filas : [];
}

export const idProductoValido = v => /^[0-9]{1,12}$/.test(String(v || ""));

const urlSegura = u => typeof u === "string" && /^https:\/\//i.test(u.trim()) ? u.trim() : "";
const corto = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };
// $159.000 (pesos colombianos, sin decimales)
const pesos = n => "$" + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const attr = v => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const jsonSeguro = o => JSON.stringify(o).replace(/</g, "\\u003c");
// Descripción para Google: el subtítulo de la tienda, completado si es muy corto (Google pide 50–160 letras)
// Textos que la tienda dejó de ejemplo o genéricos: no sirven para Google
const GENERICO = /^(nuestra colecci[oó]n|cat[aá]logo|bienvenid[oa]s?|inicio|tienda|t[ií]tulo que se ve.*|subt[ií]tulo de tu negocio.*|texto de ejemplo.*)$/i;
const util = t => { const s = String(t || "").replace(/\s+/g, " ").trim(); return s && !GENERICO.test(s) ? s : ""; };
// Ciudad de la tienda: la última parte de la dirección ("Calle 11 #12-30, Centro, Ocaña") o una ciudad nombrada en sus textos
const CIUDADES = /\b(Oca[ñn]a|C[uú]cuta|Bucaramanga|Bogot[aá]|Medell[ií]n|Cali|Barranquilla|Cartagena|Santa Marta|Valledupar|Aguachica|Pamplona|[ÁA]brego|Convenci[oó]n|Teorama|San Calixto|El Carmen|Hacar[ií]|La Playa|Villa del Rosario|Los Patios|Tib[uú])\b/i;
export function ciudadTienda(cfg){
  const dir = String(cfg.footer_direccion || "").trim();
  const ult = dir.split(",").map(s => s.trim()).filter(Boolean).pop() || "";
  if(ult && !/\d|#/.test(ult) && ult.length <= 30 && dir.includes(",")) return ult.replace(/\s*-\s*.*$/, "");
  const m = [dir, cfg.portada_subtitulo, cfg.footer_texto, cfg.portada_titulo].join(" ").match(CIUDADES);
  return m ? m[1] : "";
}
export function descripcionTienda(cfg, nombre, cats = [], ciudad = ""){
  const base = util(cfg.portada_subtitulo) || util(cfg.footer_texto);
  const lista = cats.slice(0, 4).join(", ").toLowerCase();
  const relleno = `${lista ? `${nombre}${ciudad ? ` en ${ciudad}` : ""}: ${lista}. ` : ""}Mira el catálogo con fotos y precios y haz tu pedido por WhatsApp.`;
  if(base.length >= 50) return corto(base, 160);
  return corto(base ? `${base.replace(/[.\s]+$/, "")}. ${relleno}` : `${lista ? "" : `Catálogo de ${nombre}${ciudad ? ` en ${ciudad}` : ""}. `}${relleno}`, 160);
}
// Título para Google: el de la tienda si es propio; si no, nombre + ciudad + qué es
export function tituloTienda(cfg, nombre, ciudad = ""){
  const propio = util(cfg.portada_titulo);
  const lugar = ciudad && !new RegExp(ciudad, "i").test(nombre + " " + propio) ? ` en ${ciudad}` : "";
  if(propio) return corto(`${nombre} | ${propio}${lugar}`, 70);
  return corto(`${nombre}${lugar} | Catálogo y pedidos por WhatsApp`, 70);
}
// Textos de la portada que el servidor ya deja escritos (así no "saltan" al cargar)
const TEXTOS_PORTADA = ["portada_frase", "portada_subtitulo", "portada_boton", "catalogo_etiqueta", "catalogo_titulo"];

// Lee el index.html publicado y le pone el nombre, la descripción y la foto de la tienda.
// Si el link trae un producto (?p=ID), la vista previa es la del producto: su foto, nombre y precio.
export async function paginaTienda(context, slug, { inyectarSlug, productoId = null }){
  const { request, env } = context;
  const origen = new URL(request.url).origin;

  let info = null, prod = null, fallo = false;
  try{
    info = await datosTienda(env, slug);
    if(productoId && info && info.activa) prod = await datosProducto(env, info.id, productoId);
  }catch(e){ fallo = true; /* Supabase no respondió: la página carga normal y el JavaScript hace lo suyo */ }

  // Se pide la página completa (sin "If-None-Match"): si no, podría llegar vacía con un 304
  const html = await env.ASSETS.fetch(new Request(origen + "/"));
  const existe = info !== null;
  const cfg = info && info.cfg;

  const nombre = cfg && cfg.nombre_tienda ? corto(cfg.nombre_tienda, 60) : "";
  const indexable = existe && info.activa && cfg;

  let titulo, descripcion, imagen, canonica, datos, extras = "";
  if(indexable && prod){
    const conOferta = Number(prod.precio_oferta) > 0 && (!prod.oferta_hasta || new Date(prod.oferta_hasta).getTime() > Date.now());
    const precio = Number(conOferta ? prod.precio_oferta : prod.precio) || 0;
    const disponible = !Array.isArray(prod.tallas) || prod.tallas.some(t => t.disponible);
    canonica = `${origen}/${slug}?p=${prod.id}`;
    titulo = `${corto(prod.nombre, 70)} · ${pesos(precio)} | ${nombre}`;
    descripcion = corto(prod.descripcion ||
      `${prod.nombre} por ${pesos(precio)} en ${nombre}.${conOferta ? ` Antes ${pesos(prod.precio)}.` : ""} Pídelo fácil por WhatsApp.`, 160);
    imagen = urlSegura(prod.imagen) || urlSegura(cfg.logo_url);
    datos = {
      "@context": "https://schema.org", "@type": "Product",
      name: prod.nombre, description: descripcion, sku: String(prod.id), url: canonica,
      ...(imagen ? { image: [imagen] } : {}),
      ...(prod.categorias && prod.categorias.nombre ? { category: prod.categorias.nombre } : {}),
      offers: {
        "@type": "Offer", url: canonica, priceCurrency: "COP", price: String(precio),
        availability: disponible ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: nombre }
      }
    };
    extras =
      `<meta property="product:price:amount" content="${precio}">` +
      `<meta property="product:price:currency" content="COP">` +
      `<meta property="product:availability" content="${disponible ? "in stock" : "out of stock"}">` +
      (imagen ? `<meta property="og:image:alt" content="${attr(prod.nombre)}">` : "");
  }else if(indexable){
    canonica = `${origen}/${slug}`;
    const ciudad = ciudadTienda(cfg);
    titulo = tituloTienda(cfg, nombre, ciudad);
    descripcion = descripcionTienda(cfg, nombre, info.cats || [], ciudad);
    imagen = urlSegura(cfg.banner_url) || urlSegura(cfg.logo_url);
    // Datos para Google: "sameAs" le dice que esta página es del mismo negocio que su Instagram, TikTok y Facebook
    const redes = [cfg.instagram_url, cfg.tiktok_url, cfg.facebook_url].map(urlSegura).filter(Boolean);
    const tel = String(cfg.whatsapp || "").replace(/\D/g, "");
    const dir = util(cfg.footer_direccion);
    datos = {
      "@context": "https://schema.org", "@type": "Store", name: nombre, url: canonica, description: descripcion,
      ...(imagen ? { image: imagen } : {}),
      ...(urlSegura(cfg.logo_url) ? { logo: urlSegura(cfg.logo_url) } : {}),
      ...(redes.length ? { sameAs: redes } : {}),
      ...(tel.length >= 10 ? { telephone: "+" + tel } : {}),
      ...((dir || ciudad) ? { address: { "@type": "PostalAddress", ...(dir ? { streetAddress: dir } : {}), ...(ciudad ? { addressLocality: ciudad } : {}), addressCountry: "CO" } } : {}),
      ...((info.cats || []).length ? { keywords: info.cats.join(", ") } : {})
    };
  }

  let rw = new HTMLRewriter();
  const variables = [];
  if(inyectarSlug) variables.push(`window.TIENDA_SLUG=${JSON.stringify(slug)};`);        // tema.js: tienda del link /nombre-tienda
  if(prod) variables.push(`window.PRODUCTO_ID=${JSON.stringify(String(prod.id))};`);     // script.js: abre la ficha de este producto
  if(variables.length){
    rw = rw.on("head", { element(el){ el.prepend(`<script>${variables.join("")}</script>`, { html: true }); } });
  }
  if(indexable){
    const banner = !cfg.quitar_banner ? urlSegura(cfg.banner_url) : "";
    const movil = banner ? await bannerMovil(banner) : "";
    const hayPortada = ["portada_frase", "portada_subtitulo", "portada_boton"].some(c => String(cfg[c] || "").trim());
    rw = rw
      .on("#tiendaH1", { element(el){ el.setInnerContent(nombre); } })
      .on(".hero-overlay", { element(el){ if(!hayPortada) el.setAttribute("hidden", ""); } })
      .on(".hero-cta", { element(el){ if(!String(cfg.portada_boton || "").trim()) el.setAttribute("hidden", ""); } })
      .on("[data-cfg]", { element(el){
        const c = el.getAttribute("data-cfg"), v = cfg[c];
        if(TEXTOS_PORTADA.includes(c) && typeof v === "string" && v.trim()) el.setInnerContent(v);
      } });
    if(banner){
      // La foto de portada se pide de una vez, sin esperar al JavaScript: carga mucho más rápido en el celular
      const u = x => `url("${x.replace(/["\\]/g, "")}")`;
      rw = rw.on("html", { element(el){
        // Con copia para celular: el CSS elige la foto según el ancho (style.css, "con-portada-m")
        el.setAttribute("style", movil ? `--hero-img-d:${u(banner)};--hero-img-m:${u(movil)}` : `--hero-img:${u(banner)}`);
        el.setAttribute("class", ((el.getAttribute("class") || "") + " con-portada" + (movil ? " con-portada-m" : "")).trim());
        if(["suave", "minimo"].includes(cfg.portada_velo)) el.setAttribute("data-velo", cfg.portada_velo);
      } });
    }
    rw = rw
      .on("title", { element(el){ el.setInnerContent(titulo); } })
      .on('meta[name="description"]', { element(el){ el.setAttribute("content", descripcion); } })
      .on('meta[property="og:title"]', { element(el){ el.setAttribute("content", titulo); } })
      .on('meta[property="og:description"]', { element(el){ el.setAttribute("content", descripcion); } })
      .on('meta[property="og:type"]', { element(el){ el.setAttribute("content", prod ? "product" : "website"); } })
      .on("head", { element(el){
        el.append(
          (banner && !prod ? (movil
            ? `<link rel="preload" as="image" href="${attr(movil)}" media="(max-width: 750px)" fetchpriority="high">` +
              `<link rel="preload" as="image" href="${attr(banner)}" media="(min-width: 751px)" fetchpriority="high">`
            : `<link rel="preload" as="image" href="${attr(banner)}" fetchpriority="high">`) : "") +
          `<link rel="canonical" href="${attr(canonica)}">` +
          `<meta property="og:url" content="${attr(canonica)}">` +
          `<meta property="og:site_name" content="${attr(nombre)}">` +
          `<meta property="og:locale" content="es_CO">` +
          (imagen ? `<meta property="og:image" content="${attr(imagen)}"><meta name="twitter:image" content="${attr(imagen)}">` : "") +
          `<meta name="twitter:card" content="${imagen ? "summary_large_image" : "summary"}">` +
          extras +
          `<script type="application/ld+json">${jsonSeguro(datos)}</script>`,
          { html: true });
      } });
  }else if(!fallo){
    // Tienda que no existe o está apagada: que Google no la guarde
    rw = rw.on("head", { element(el){ el.append(`<meta name="robots" content="noindex">`, { html: true }); } });
  }

  const salida = rw.transform(html);
  const headers = new Headers(salida.headers);
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  if(!indexable && !fallo) headers.set("X-Robots-Tag", "noindex");
  // Si Supabase falló no sabemos si existe: se responde 200 (nunca un 404 falso que Google borre)
  return new Response(salida.body, { status: existe || fallo ? 200 : 404, headers });
}
