// funciones-lib/seo.js — código compartido por las funciones de Cloudflare Pages (carpeta functions/).
// Hace que Google y WhatsApp vean el nombre, la descripción y la foto de cada tienda
// sin esperar al JavaScript de la página.
//
// La clave de Supabase es la "anon" (la misma pública de supabaseConfig.js): solo puede
// leer lo que las reglas (RLS) dejan ver a cualquiera.

const SUPABASE_URL = "https://txnvsigmwshwduhearvz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnZzaWdtd3Nod2R1aGVhcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDMzMjgsImV4cCI6MjEwNjIxOTMyOH0.JhO4JYOUTh13aZfDT4eDCioTjShcJsVjgxIXcOOS-uQ";

// Páginas propias de la plataforma: nunca se confunden con una tienda
export const RESERVADOS = new Set([
  "index", "admin", "ajustes", "agregarprenda", "editarprenda", "pedido",
  "privacidad", "restablecer", "plataforma", "sitemap", "robots", "img", "favicon"
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
  let cfg = null;
  if(activa){
    const c = await supabase(env, "/rest/v1/configuracion?select=nombre_tienda,portada_titulo,portada_subtitulo,footer_texto,logo_url,banner_url&tienda_id=eq." + encodeURIComponent(id));
    cfg = Array.isArray(c) && c.length ? c[0] : null;
  }
  return { id, activa, cfg };
}

// Tiendas activas para el sitemap
export async function tiendasActivas(env){
  const filas = await supabase(env, "/rest/v1/rpc/tiendas_publicas");
  return Array.isArray(filas) ? filas : [];
}

const urlSegura = u => typeof u === "string" && /^https:\/\//i.test(u.trim()) ? u.trim() : "";
const corto = (t, n) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

// Lee el index.html publicado y le pone el nombre, la descripción y la foto de la tienda
export async function paginaTienda(context, slug, { inyectarSlug }){
  const { request, env } = context;
  const origen = new URL(request.url).origin;
  const canonica = `${origen}/${slug}`;

  let info = null, fallo = false;
  try{ info = await datosTienda(env, slug); }
  catch(e){ fallo = true; /* Supabase no respondió: la página carga normal y el JavaScript hace lo suyo */ }

  // Se pide la página completa (sin "If-None-Match"): si no, podría llegar vacía con un 304
  const html = await env.ASSETS.fetch(new Request(origen + "/"));
  const existe = info !== null;
  const cfg = info && info.cfg;

  const nombre = cfg && cfg.nombre_tienda ? corto(cfg.nombre_tienda, 60) : "";
  const titulo = nombre ? (cfg.portada_titulo ? `${nombre} | ${corto(cfg.portada_titulo, 60)}` : nombre) : "";
  const descripcion = cfg ? corto(cfg.portada_subtitulo || cfg.footer_texto || `Mira el catálogo de ${nombre}, elige tus productos y haz tu pedido por WhatsApp.`, 160) : "";
  const imagen = cfg ? (urlSegura(cfg.banner_url) || urlSegura(cfg.logo_url)) : "";
  const indexable = existe && info.activa && cfg;

  let rw = new HTMLRewriter();
  if(inyectarSlug){
    // tema.js lee la tienda de aquí cuando el link es /nombre-tienda (sin ?t=)
    rw = rw.on("head", { element(el){ el.prepend(`<script>window.TIENDA_SLUG=${JSON.stringify(slug)};</script>`, { html: true }); } });
  }
  if(indexable){
    rw = rw
      .on("title", { element(el){ el.setInnerContent(titulo); } })
      .on('meta[name="description"]', { element(el){ el.setAttribute("content", descripcion); } })
      .on('meta[property="og:title"]', { element(el){ el.setAttribute("content", titulo); } })
      .on('meta[property="og:description"]', { element(el){ el.setAttribute("content", descripcion); } })
      .on("head", { element(el){
        const attr = v => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
        const datos = { "@context": "https://schema.org", "@type": "Store", name: nombre, url: canonica, description: descripcion };
        if(imagen) datos.image = imagen;
        el.append(
          `<link rel="canonical" href="${attr(canonica)}">` +
          `<meta property="og:url" content="${attr(canonica)}">` +
          `<meta property="og:site_name" content="${attr(nombre)}">` +
          `<meta property="og:locale" content="es_CO">` +
          (imagen ? `<meta property="og:image" content="${attr(imagen)}"><meta name="twitter:image" content="${attr(imagen)}">` : "") +
          `<meta name="twitter:card" content="${imagen ? "summary_large_image" : "summary"}">` +
          `<script type="application/ld+json">${JSON.stringify(datos).replace(/</g, "\\u003c")}</script>`,
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
