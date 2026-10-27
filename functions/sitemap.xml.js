// /sitemap.xml → lista de tiendas activas para Google (se actualiza sola)
import { tiendasActivas } from "../funciones-lib/seo.js";

export async function onRequestGet(context){
  const origen = new URL(context.request.url).origin;
  let tiendas = [];
  try{ tiendas = await tiendasActivas(context.env); }catch(e){ /* sin la función SQL 007: lista vacía */ }

  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const urls = tiendas
    .filter(t => t && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug))
    .map(t => `  <url><loc>${esc(origen + "/" + t.slug)}</loc>${t.actualizada ? `<lastmod>${esc(String(t.actualizada).slice(0, 10))}</lastmod>` : ""}</url>`)
    .join("\n");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
