// /nombre-tienda → catálogo de esa tienda, con su nombre y foto para Google y WhatsApp.
// /nombre-tienda?p=ID → lo mismo, pero la vista previa es la del producto (y se abre su ficha).
// Cualquier otra dirección de una sola parte (ej. /admin) sigue como siempre.
import { RESERVADOS, slugValido, idProductoValido, paginaTienda } from "../funciones-lib/seo.js";

export async function onRequestGet(context){
  const url = new URL(context.request.url);
  const original = String(context.params.slug || "");
  const slug = original.toLowerCase();

  if(original.includes(".") || RESERVADOS.has(slug) || !slugValido(slug)) return context.next();

  // Una sola forma de cada link: /Sneakers-VIP → /sneakers-vip (y sin "/" al final)
  if(original !== slug || url.pathname.endsWith("/")){
    return Response.redirect(`${url.origin}/${slug}${url.search}`, 301);
  }
  // /nombre-tienda?p=25 → vista previa del producto 25 (foto, nombre y precio)
  const p = url.searchParams.get("p");
  return paginaTienda(context, slug, { inyectarSlug: true, productoId: idProductoValido(p) ? p : null });
}
