// "/" sin tienda → página de ventas de Exhibe Pro (inicio.html), la que encuentra Google.
// "/" con ?t=nombre-tienda (los links de siempre) → el catálogo de esa tienda, con su nombre y foto
// para que WhatsApp y Google los muestren. Esos links siguen funcionando igual que antes.
import { slugValido, idProductoValido, paginaTienda } from "../funciones-lib/seo.js";

export async function onRequestGet(context){
  const url = new URL(context.request.url);
  const params = url.searchParams;
  const t = String(params.get("t") || "").trim().toLowerCase();

  if(!t){
    // Un link viejo con solo ?p= sigue abriendo la tienda por defecto, como antes
    if(params.has("p")) return context.next();
    // Cualquier otra visita a "/" (aunque traiga ?fbclid=, ?utm_…): la página de ventas
    const pagina = await context.env.ASSETS.fetch(new Request(url.origin + "/inicio"));
    if(!pagina.ok) return context.next();          // si faltara inicio.html, queda como antes
    const headers = new Headers(pagina.headers);
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return new Response(pagina.body, { status: 200, headers });
  }

  if(!slugValido(t)) return context.next();
  const p = params.get("p");
  return paginaTienda(context, t, { inyectarSlug: false, productoId: idProductoValido(p) ? p : null });
}
