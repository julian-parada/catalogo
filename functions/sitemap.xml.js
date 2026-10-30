// /sitemap.xml → tiendas activas y sus productos, para Google (se actualiza solo)
import { tiendasActivas, datosTienda, productosDe, PAGINAS_SEO } from "../funciones-lib/seo.js";

// Cloudflare gratis permite 50 consultas por visita: con muchas tiendas se listan solo las tiendas
const MAX_TIENDAS_CON_PRODUCTOS = 40;

export async function onRequestGet(context){
  const origen = new URL(context.request.url).origin;
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const valido = s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);

  let tiendas = [];
  try{ tiendas = (await tiendasActivas(context.env)).filter(t => t && valido(t.slug)); }catch(e){ /* sin la función SQL 007: lista vacía */ }

  // Primero la página de ventas de Exhibe Pro, después cada tienda
  const urls = [`  <url><loc>${esc(origen + "/")}</loc><priority>1.0</priority></url>`];
  // Páginas por búsqueda (seo/generar.py)
  PAGINAS_SEO.forEach(s => urls.push(`  <url><loc>${esc(origen + "/" + s)}</loc><priority>0.9</priority></url>`));
  urls.push(...tiendas.map(t => `  <url><loc>${esc(origen + "/" + t.slug)}</loc><priority>0.8</priority></url>`));

  if(tiendas.length && tiendas.length <= MAX_TIENDAS_CON_PRODUCTOS){
    try{
      const conId = (await Promise.all(tiendas.map(async t => {
        const info = await datosTienda(context.env, t.slug).catch(() => null);
        return info && info.activa ? { slug: t.slug, id: info.id } : null;
      }))).filter(Boolean);
      const slugDe = Object.fromEntries(conId.map(t => [t.id, t.slug]));
      const productos = await productosDe(context.env, conId.map(t => t.id));
      productos.forEach(p => {
        const slug = slugDe[p.tienda_id];
        if(slug) urls.push(`  <url><loc>${esc(`${origen}/${slug}?p=${p.id}`)}</loc><priority>0.7</priority></url>`);
      });
    }catch(e){ /* si falla, el sitemap queda solo con las tiendas */ }
  }

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
