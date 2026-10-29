// Exhibe Pro — página de ventas (inicio.html)
(function(){
  "use strict";

  const WHATSAPP = "573247348475";
  // Mensaje que llega a tu WhatsApp según el botón que tocaron (así sabes de dónde viene)
  const MENSAJES = {
    portada:  "Hola, vi Exhibe Pro y quiero probar la página 15 días gratis para mi almacén.",
    precio:   "Hola, quiero empezar mi prueba gratis de 15 días de Exhibe Pro.",
    cierre:   "Hola, quiero que me muestres cómo quedaría la página de mi almacén con Exhibe Pro.",
    barra:    "Hola, quiero información sobre Exhibe Pro para mi almacén.",
    flotante: "Hola, quiero probar Exhibe Pro 15 días gratis."
  };
  const enlace = texto => `https://api.whatsapp.com/send?phone=${WHATSAPP}&text=${encodeURIComponent(texto)}`;
  document.querySelectorAll("[data-wa]").forEach(a => {
    a.href = enlace(MENSAJES[a.dataset.wa] || MENSAJES.barra);
  });

  // Colores de la tienda de ejemplo: cambia la captura
  const img = document.getElementById("imgMarca");
  const botones = document.querySelectorAll(".paleta");
  // Se descargan cuando la sección se acerca, para que el cambio sea inmediato
  let precargadas = false;
  const precargar = () => {
    if(precargadas) return; precargadas = true;
    botones.forEach(b => { const i = new Image(); i.src = `img/exhibe/${b.dataset.img}.webp`; });
  };
  if(img && "IntersectionObserver" in window){
    const io = new IntersectionObserver(e => { if(e.some(x => x.isIntersecting)){ precargar(); io.disconnect(); } }, { rootMargin: "400px" });
    io.observe(img);
  }
  function elegir(boton){
    if(!img || boton.classList.contains("on")) return;
    botones.forEach(b => { const on = b === boton; b.classList.toggle("on", on); b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1; });
    const src = `img/exhibe/${boton.dataset.img}.webp`;
    const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if(quieto){ img.src = src; return; }
    img.classList.add("cambiando");
    setTimeout(() => {
      const listo = () => img.classList.remove("cambiando");
      img.onload = listo; img.onerror = listo;
      img.src = src;
      if(img.complete) listo();
    }, 160);
  }
  botones.forEach((b, i) => {
    b.tabIndex = b.classList.contains("on") ? 0 : -1;
    b.addEventListener("click", () => { precargar(); elegir(b); });
    // Grupo de opciones: flechas para moverse, como cualquier selector
    b.addEventListener("keydown", e => {
      const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if(!paso) return;
      e.preventDefault();
      const sig = botones[(i + paso + botones.length) % botones.length];
      sig.focus(); precargar(); elegir(sig);
    });
  });

  // Barra superior con borde al bajar · botón fijo en el celular después de la portada
  const barra = document.getElementById("barra");
  const flotante = document.getElementById("flotante");
  const portada = document.querySelector(".portada");
  const cierre = document.querySelector(".cierre");
  let pasoPortada = false, enCierre = false;
  const pintar = () => {
    barra.classList.toggle("con-borde", scrollY > 8);
    flotante.classList.toggle("visible", pasoPortada && !enCierre);
  };
  if("IntersectionObserver" in window){
    new IntersectionObserver(([e]) => { pasoPortada = !e.isIntersecting && e.boundingClientRect.top < 0; pintar(); }).observe(portada);
    new IntersectionObserver(([e]) => { enCierre = e.isIntersecting; pintar(); }, { threshold: .2 }).observe(cierre);
  }
  addEventListener("scroll", pintar, { passive: true });
  pintar();
})();
