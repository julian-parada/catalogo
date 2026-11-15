// promos.js — ventana de promociones al entrar a la tienda (estilo historias).
// Solo se activa si la tienda tiene el paquete "promos" (sql/013); si no, no hace nada.
// Imágenes: pasan solas a los 5 s. Videos: esperan a que termine el video.
// Necesita antes: script.js (FUNC, products, seleccionarCategoria, abrirFicha).
(function(){
  const SEG_IMAGEN = 5000;
  const VISTA_KEY = claveLocal("promoVista");
  const hoyCO = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const params = new URLSearchParams(location.search);
  const forzada = params.get("promo") === "ver";      // vista previa desde el panel

  const arrancar = () => { iniciar().catch(err => console.warn("Promociones:", err)); };
  // El catálogo pudo terminar de cargar antes de que este archivo corriera
  if(window.catalogoListo) arrancar();
  else document.addEventListener("catalogo-listo", arrancar, { once: true });

  async function iniciar(){
    if(typeof FUNC === "undefined" || !FUNC.promos) return;
    // Si llegó por el link de un producto, no se le tapa el producto (salvo vista previa)
    if(!forzada && (params.get("p") || window.PRODUCTO_ID)) return;

    const tienda = await window.tiendaActual;
    if(!tienda) return;
    const [aj, lam] = await Promise.all([
      supabaseClient.from("promo_ajustes").select("encendida, desde, hasta, frecuencia, mostrar_cuenta").eq("tienda_id", tienda.id).maybeSingle(),
      supabaseClient.from("promociones").select("id, orden, tipo, url, titulo, boton_texto, boton_destino, destino_id").eq("tienda_id", tienda.id).order("orden").order("id").limit(5)
    ]);
    if(aj.error || lam.error) return;
    const ajustes = aj.data || { encendida: true, frecuencia: "dia", mostrar_cuenta: true };
    const laminas = (lam.data || []).filter(l => safeUrl(l.url));
    if(!laminas.length) return;

    const hoy = hoyCO();
    if(!forzada){
      if(ajustes.encendida === false) return;
      if(ajustes.desde && hoy < ajustes.desde) return;
      if(ajustes.hasta && hoy > ajustes.hasta) return;
      if(ajustes.frecuencia !== "siempre"){
        let vista = "";
        try{ vista = localStorage.getItem(VISTA_KEY) || ""; }catch(e){}
        if(vista === hoy) return;
      }
    }
    // "Termina en…": hasta la fecha de la ventana o, si no tiene, hasta que acabe el paquete
    const fechas = [ajustes.hasta, FUNC.promos].filter(Boolean).map(f => String(f).slice(0, 10)).sort();
    const fin = ajustes.mostrar_cuenta !== false && fechas.length ? new Date(fechas[0] + "T23:59:59-05:00").getTime() : 0;

    await cargarCss();
    // Un respiro para que el cliente vea la tienda detrás antes de abrir
    setTimeout(() => abrir(laminas, fin), forzada ? 150 : 700);
    try{ if(ajustes.frecuencia !== "siempre" && !forzada) localStorage.setItem(VISTA_KEY, hoy); }catch(e){}
  }

  function cargarCss(){
    return new Promise(ok => {
      if(document.querySelector('link[href="promos.css"]')) return ok();
      const l = document.createElement("link");
      l.rel = "stylesheet"; l.href = "promos.css";
      l.onload = l.onerror = () => ok();
      document.head.appendChild(l);
      setTimeout(ok, 2500);
    });
  }

  const TEXTO_BOTON = { ofertas: "Ver ofertas", categoria: "Ver productos", producto: "Ver producto", cerrar: "" };

  function abrir(laminas, fin){
    if(document.getElementById("promoVentana")) return;
    const previoFoco = document.activeElement;
    const caja = document.createElement("div");
    caja.id = "promoVentana";
    caja.className = "pv";
    caja.setAttribute("role", "dialog");
    caja.setAttribute("aria-modal", "true");
    caja.setAttribute("aria-label", "Promociones de la tienda");
    caja.innerHTML = `
      <div class="pv-card">
        <div class="pv-barras">${laminas.map(() => `<span class="pv-barra"><i></i></span>`).join("")}</div>
        <div class="pv-arriba">
          ${fin ? `<span class="pv-cuenta" data-fin-promo="${fin}">⏳ Termina en <b></b></span>` : "<span></span>"}
          <span class="pv-btns">
            <button type="button" class="pv-sonido" aria-label="Activar sonido" hidden>🔇</button>
            <button type="button" class="pv-cerrar" aria-label="Cerrar promociones">✕</button>
          </span>
        </div>
        <div class="pv-medios">${laminas.map((l, i) => `
          <div class="pv-lamina" data-i="${i}" hidden>
            ${l.tipo === "video"
              ? `<video data-src="${esc(l.url)}" muted playsinline preload="none"></video>`
              : `<img data-src="${esc(l.url)}" alt="${esc(l.titulo || "Promoción")}">`}
          </div>`).join("")}
        </div>
        <button type="button" class="pv-zona pv-ant" aria-label="Anterior"></button>
        <button type="button" class="pv-zona pv-sig" aria-label="Siguiente"></button>
        <div class="pv-abajo">
          <p class="pv-titulo"></p>
          <button type="button" class="pv-accion" hidden></button>
          <button type="button" class="pv-tienda">Ir a la tienda</button>
        </div>
      </div>`;
    document.body.appendChild(caja);
    document.documentElement.classList.add("promo-abierta");

    const $ = s => caja.querySelector(s);
    const barras = [...caja.querySelectorAll(".pv-barra i")];
    const nodos = [...caja.querySelectorAll(".pv-lamina")];
    const btnSonido = $(".pv-sonido");
    let actual = -1, inicio = 0, transcurrido = 0, pausado = false, raf = 0, conSonido = false, cerrada = false, espera = 0;

    function cargarMedio(i){
      const n = nodos[i]; if(!n) return;
      const m = n.querySelector("[data-src]");
      if(m && !m.src){ m.src = m.dataset.src; if(m.tagName === "VIDEO") m.preload = "auto"; }
    }
    const video = () => nodos[actual] && nodos[actual].querySelector("video");

    function mostrar(i){
      if(i < 0) i = 0;
      if(i >= laminas.length){ cerrar(); return; }
      const v0 = video(); if(v0){ v0.pause(); }
      clearTimeout(espera);
      actual = i;
      nodos.forEach((n, k) => { n.hidden = k !== i; });
      barras.forEach((b, k) => { b.style.width = k < i ? "100%" : "0%"; });
      cargarMedio(i); cargarMedio(i + 1);

      const l = laminas[i];
      $(".pv-titulo").textContent = l.titulo || "";
      $(".pv-titulo").hidden = !l.titulo;
      const accion = $(".pv-accion");
      const texto = (l.boton_texto || "").trim() || TEXTO_BOTON[l.boton_destino] || "";
      accion.hidden = !texto;
      accion.textContent = texto;

      transcurrido = 0; inicio = performance.now();
      const v = video();
      btnSonido.hidden = !v;
      if(v){
        v.muted = !conSonido;
        v.currentTime = 0;
        v.onended = () => mostrar(actual + 1);
        v.onerror = () => { espera = setTimeout(() => mostrar(actual + 1), 800); };
        const intento = v.play();
        if(intento && intento.catch) intento.catch(() => { v.muted = true; conSonido = false; pintarSonido(); v.play().catch(() => {}); });
        // Si el video no arranca (señal muy lenta), se pasa a la siguiente
        espera = setTimeout(() => { if(v.readyState < 2 && actual === i) mostrar(actual + 1); }, 10000);
      }
      pintarSonido();
    }

    function animar(ahora){
      if(cerrada) return;
      raf = requestAnimationFrame(animar);
      tickCuenta();
      if(pausado || actual < 0) return;
      const v = video();
      let avance;
      if(v){
        avance = v.duration > 0 ? v.currentTime / v.duration : 0;
      }else{
        transcurrido += ahora - inicio;
        avance = transcurrido / SEG_IMAGEN;
        if(avance >= 1){ inicio = ahora; mostrar(actual + 1); return; }
      }
      inicio = ahora;
      barras[actual].style.width = Math.min(100, avance * 100) + "%";
    }

    let ultimaCuenta = 0;
    function tickCuenta(){
      const el = $(".pv-cuenta");
      if(!el || Date.now() - ultimaCuenta < 500) return;
      ultimaCuenta = Date.now();
      const resta = Number(el.dataset.finPromo) - Date.now();
      if(resta <= 0){ el.hidden = true; return; }
      const t = Math.floor(resta / 1000), d = Math.floor(t / 86400), h = Math.floor(t % 86400 / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
      const dd = n => String(n).padStart(2, "0");
      el.querySelector("b").textContent = d ? `${d}d ${dd(h)}h ${dd(m)}m` : `${dd(h)}:${dd(m)}:${dd(s)}`;
    }

    function pintarSonido(){
      btnSonido.textContent = conSonido ? "🔊" : "🔇";
      btnSonido.setAttribute("aria-label", conSonido ? "Quitar sonido" : "Activar sonido");
    }
    btnSonido.addEventListener("click", e => {
      e.stopPropagation();
      conSonido = !conSonido;
      const v = video(); if(v){ v.muted = !conSonido; if(conSonido) v.play().catch(() => {}); }
      pintarSonido();
    });

    function pausar(si){
      pausado = si;
      const v = video();
      if(v){ if(si) v.pause(); else v.play().catch(() => {}); }
      inicio = performance.now();
    }
    // Mantener presionado pausa (como en las historias); un toque corto avanza o retrocede
    let presion = 0, largo = false;
    caja.querySelectorAll(".pv-zona").forEach(z => {
      z.addEventListener("pointerdown", () => { largo = false; presion = setTimeout(() => { largo = true; pausar(true); }, 250); });
      const soltar = () => { clearTimeout(presion); if(largo) pausar(false); };
      z.addEventListener("pointerup", soltar);
      z.addEventListener("pointercancel", soltar);
      z.addEventListener("pointerleave", soltar);
      z.addEventListener("click", e => {
        if(largo){ largo = false; return; }
        mostrar(actual + (z.classList.contains("pv-ant") ? -1 : 1));
      });
      z.addEventListener("contextmenu", e => e.preventDefault());
    });

    function cerrar(){
      if(cerrada) return;
      cerrada = true;
      cancelAnimationFrame(raf);
      clearTimeout(espera);
      const v = video(); if(v) v.pause();
      document.removeEventListener("keydown", teclas);
      document.removeEventListener("visibilitychange", visible);
      caja.classList.add("pv-saliendo");
      document.documentElement.classList.remove("promo-abierta");
      setTimeout(() => caja.remove(), 220);
      if(previoFoco && previoFoco.focus) previoFoco.focus({ preventScroll: true });
    }
    function irA(l){
      cerrar();
      if(l.boton_destino === "ofertas"){
        if(products.some(p => p.originalPrice)) seleccionarCategoria("__promos__"); else irAlCatalogo();
      }else if(l.boton_destino === "categoria" && l.destino_id){
        if(products.some(p => String(p.categoryId) === String(l.destino_id))) seleccionarCategoria(String(l.destino_id)); else irAlCatalogo();
      }else if(l.boton_destino === "producto" && l.destino_id){
        if(!abrirFicha(l.destino_id)) irAlCatalogo();
      }
    }

    $(".pv-cerrar").addEventListener("click", cerrar);
    $(".pv-tienda").addEventListener("click", cerrar);
    $(".pv-accion").addEventListener("click", () => irA(laminas[actual]));
    caja.addEventListener("click", e => { if(e.target === caja) cerrar(); });
    function teclas(e){
      if(e.key === "Escape") cerrar();
      if(e.key === "ArrowRight") mostrar(actual + 1);
      if(e.key === "ArrowLeft") mostrar(actual - 1);
    }
    function visible(){ pausar(document.hidden); }
    document.addEventListener("keydown", teclas);
    document.addEventListener("visibilitychange", visible);

    mostrar(0);
    tickCuenta();
    raf = requestAnimationFrame(t => { inicio = t; animar(t); });
    setTimeout(() => $(".pv-cerrar").focus({ preventScroll: true }), 50);
  }
})();
