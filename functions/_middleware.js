// Dominio oficial: linktalogo.com
// · exhibepro.pages.dev (la dirección vieja) manda todo a linktalogo.com con el mismo camino,
//   así los links que ya tienen los clientes siguen funcionando y Google pasa todo al dominio nuevo.
// · www.linktalogo.com → linktalogo.com
// Las vistas previas de Cloudflare (xxxx.exhibepro.pages.dev) no se tocan.
const OFICIAL = "linktalogo.com";
const VIEJOS = new Set(["exhibepro.pages.dev", "www.linktalogo.com"]);
// El archivo de verificación de Search Console de la dirección vieja debe seguir respondiendo
// (lo pide el "Cambio de dirección" de Google)
const SIN_REDIRIGIR = /^\/google[0-9a-f]+\.html$/;

export async function onRequest(context){
  const url = new URL(context.request.url);
  if(VIEJOS.has(url.hostname) && !SIN_REDIRIGIR.test(url.pathname)){
    url.hostname = OFICIAL; url.protocol = "https:"; url.port = "";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
}
