// demo.js — "Modo vitrina": la tienda de ejemplo de LinkTalogo (/lookshop).
// Sirve para mostrársela a futuros clientes:
//   · franja arriba que dice que es una tienda de ejemplo, con botón "Quiero la mía"
//   · sección final para vender LinkTalogo
//   · los pedidos llegan al WhatsApp de la tienda igual que en cualquier tienda real
//   · el botón flotante de WhatsApp escribe a LinkTalogo
// Las demás tiendas no cambian en nada.
(function(){
  "use strict";
  const TIENDAS_DEMO = ["lookshop"];
  const activo = typeof SLUG_ACTUAL !== "undefined" && TIENDAS_DEMO.includes(SLUG_ACTUAL)
    && typeof ES_PAGINA_ADMIN !== "undefined" && !ES_PAGINA_ADMIN;
  window.ExhibeDemo = { activo };
  if(!activo) return;

  const WA = (typeof EXHIBE_PRO !== "undefined" && EXHIBE_PRO.whatsapp) || "573247348475";
  const MSG_QUIERO = "Hola, vi la tienda de ejemplo de LinkTalogo y quiero una así para mi almacén. ¿Cómo empiezo los 15 días gratis?";
  const linkQuiero = (texto = MSG_QUIERO) => enlaceWhatsapp(WA, texto);
  const ICONO_WA = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.6 2.33A7.85 7.85 0 0 0 8 0C3.63 0 .07 3.56.06 7.93c0 1.4.37 2.76 1.06 3.96L0 16l4.2-1.1a7.9 7.9 0 0 0 3.8.97c4.37 0 7.93-3.56 7.93-7.93A7.9 7.9 0 0 0 13.6 2.33zM8 14.52a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25A6.56 6.56 0 0 1 1.4 7.93C1.4 4.3 4.36 1.35 8 1.35a6.56 6.56 0 0 1 6.59 6.59c0 3.63-2.96 6.58-6.59 6.58zm3.61-4.93c-.2-.1-1.17-.58-1.35-.65-.18-.06-.32-.1-.45.1-.13.2-.51.65-.63.78-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.52-.98-1.17-1.1-1.37-.11-.2-.01-.3.09-.4l.3-.35c.1-.11.13-.2.2-.33.06-.13.03-.25-.02-.35-.05-.1-.44-1.08-.61-1.47-.16-.39-.32-.34-.45-.34h-.38a.73.73 0 0 0-.53.25c-.18.2-.69.68-.69 1.65s.71 1.92.81 2.05c.1.13 1.4 2.13 3.38 2.99.47.2.84.33 1.13.42.48.15.9.13 1.25.08.38-.06 1.17-.48 1.34-.94.16-.46.16-.86.11-.94-.05-.08-.18-.13-.38-.23z"/></svg>';

  document.documentElement.classList.add("modo-demo");

  const listo = new Promise(r => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", r, { once: true }) : r());

  listo.then(() => {
    // 1) Franja de arriba
    const franja = document.createElement("div");
    franja.className = "demo-franja";
    franja.setAttribute("role", "note");
    franja.innerHTML = `
      <p><span class="demo-sello">Tienda de ejemplo</span> <span class="demo-franja-txt">Así puede quedar tu almacén con <b>LinkTalogo</b>. <span class="demo-pista">Pruébala como cliente: añade algo y envía el pedido.</span></span></p>
      <a class="demo-btn-quiero" href="${linkQuiero()}" target="_blank" rel="noopener">Quiero la mía</a>`;
    document.body.prepend(franja);

    // 2) Sección final, antes del pie
    const pie = document.getElementById("footer");
    if(pie){
      const sec = document.createElement("section");
      sec.className = "demo-cierre";
      sec.setAttribute("aria-labelledby", "demoCierreT");
      sec.innerHTML = `
        <div class="demo-cierre-in">
          <h2 id="demoCierreT">Tu almacén puede verse así esta semana</h2>
          <p class="demo-cierre-sub">Te entrego la tienda lista con tu nombre, tu logo y tu portada. Tú subes tus productos desde el celular y los pedidos te llegan a WhatsApp.</p>
          <ul class="demo-lista">
            <li>Tu propio link para Instagram, Facebook y WhatsApp</li>
            <li>Cada producto se comparte con su foto y su precio</li>
            <li>Aparece en Google con el nombre de tu almacén</li>
            <li>Sin comisiones por venta</li>
          </ul>
          <p class="demo-precio"><b>15 días gratis</b> y después $39.900 al mes</p>
          <div class="demo-acciones">
            <a class="demo-btn demo-btn-wa" href="${linkQuiero()}" target="_blank" rel="noopener">${ICONO_WA}Quiero mi tienda</a>
            <a class="demo-btn demo-btn-linea" href="/">Conocer LinkTalogo</a>
          </div>
        </div>`;
      pie.before(sec);
    }
  });

  // 4) El botón flotante de WhatsApp le escribe a LinkTalogo
  const ajustarFlotante = () => {
    const btn = document.getElementById("waFlotante");
    if(!btn) return;
    btn.href = linkQuiero("Hola, estoy viendo la tienda de ejemplo de LinkTalogo y tengo una pregunta.");
    btn.hidden = false;
    btn.setAttribute("aria-label", "Escríbele a LinkTalogo por WhatsApp");
  };
  Promise.all([window.configTienda || Promise.resolve(), listo]).then(() => setTimeout(ajustarFlotante, 0));
})();
