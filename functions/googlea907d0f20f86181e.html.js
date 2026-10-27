// Verificación de Google Search Console (NO borrar: Google la revisa de vez en cuando).
// Va como función y no como archivo porque Cloudflare redirige los .html (a /sin-extension)
// y Google necesita leerlo exactamente en esta dirección.
export function onRequestGet(){
  return new Response("google-site-verification: googlea907d0f20f86181e.html", {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" }
  });
}
