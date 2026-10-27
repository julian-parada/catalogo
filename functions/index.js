// "/" con ?t=nombre-tienda (los links de siempre): le pone el nombre y la foto
// de la tienda para que WhatsApp y Google los muestren. Sin ?t= queda igual que antes.
import { slugValido, paginaTienda } from "../funciones-lib/seo.js";

export async function onRequestGet(context){
  const t = String(new URL(context.request.url).searchParams.get("t") || "").trim().toLowerCase();
  if(!t || !slugValido(t)) return context.next();
  return paginaTienda(context, t, { inyectarSlug: false });
}
