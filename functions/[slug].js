// /nombre-tienda → catálogo de esa tienda, con su nombre y foto para Google y WhatsApp.
// Cualquier otra dirección de una sola parte (ej. /admin) sigue como siempre.
import { RESERVADOS, slugValido, paginaTienda } from "../funciones-lib/seo.js";

export async function onRequestGet(context){
  const url = new URL(context.request.url);
  const original = String(context.params.slug || "");
  const slug = original.toLowerCase();

  if(original.includes(".") || RESERVADOS.has(slug) || !slugValido(slug)) return context.next();

  // Una sola forma de cada link: /Sneakers-VIP → /sneakers-vip (y sin "/" al final)
  if(original !== slug || url.pathname.endsWith("/")){
    return Response.redirect(`${url.origin}/${slug}${url.search}`, 301);
  }
  return paginaTienda(context, slug, { inyectarSlug: true });
}
