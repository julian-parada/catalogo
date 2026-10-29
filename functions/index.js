// "/" con ?t=nombre-tienda (los links de siempre): le pone el nombre y la foto
// de la tienda para que WhatsApp y Google los muestren. Sin ?t= queda igual que antes.
import { slugValido, idProductoValido, paginaTienda } from "../funciones-lib/seo.js";

export async function onRequestGet(context){
  const params = new URL(context.request.url).searchParams;
  const t = String(params.get("t") || "").trim().toLowerCase();
  if(!t || !slugValido(t)) return context.next();
  const p = params.get("p");
  return paginaTienda(context, t, { inyectarSlug: false, productoId: idProductoValido(p) ? p : null });
}
