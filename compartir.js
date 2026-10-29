// compartir.js — compartir un producto (catálogo y panel de la tienda).
//
//   Compartir.abrir({ url, nombre, precio, precioAntes, imagen, tienda })
//     → ventana con: WhatsApp · Facebook · Copiar enlace · Imagen para historias · Más opciones
//   Compartir.urlProducto(slug, id) → https://…/slug?p=id
//
// El link de cada producto (/tienda?p=ID) lo arma el servidor con la foto, el nombre y el
// precio, así que en WhatsApp y Facebook se ve la vista previa del producto.
// Instagram no permite links en publicaciones: para eso está la "imagen para historias",
// que se sube a la historia y se le pone el sticker "Enlace" con el link (queda copiado).
(function(){
  "use strict";

  const SVG = (d, extra = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
  const ICONOS = {
    whatsapp: SVG('<path fill="currentColor" d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.34.16 11.9c0 2.1.55 4.14 1.6 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.56 0 11.9-5.34 11.9-11.9 0-3.18-1.24-6.17-3.45-8.44ZM12.07 21.8h-.01a9.88 9.88 0 0 1-5.04-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 7c0 5.45-4.44 9.89-9.88 9.89Zm5.42-7.41c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35Z"/>'),
    facebook: SVG('<path fill="currentColor" d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07Z"/>'),
    enlace: SVG('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M10 14a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5M14 10a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/>'),
    historia: SVG('<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.3" fill="currentColor"/>'),
    mas: SVG('<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>'),
    cerrar: SVG('<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6 6l12 12M18 6 6 18"/>'),
    listo: SVG('<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5 10 17l9-10"/>')
  };

  const pesos = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const urlProducto = (slug, id) => `${location.origin}/${encodeURIComponent(slug)}?p=${encodeURIComponent(id)}`;

  let hoja = null, datos = null, ultimoFoco = null;

  function crearHoja(){
    if(hoja) return hoja;
    hoja = document.createElement("div");
    hoja.className = "cp-fondo";
    hoja.id = "compartirModal";
    hoja.hidden = true;
    hoja.innerHTML = `
      <div class="cp-hoja" role="dialog" aria-modal="true" aria-labelledby="cpTitulo">
        <button type="button" class="cp-cerrar" data-cp="cerrar" aria-label="Cerrar">${ICONOS.cerrar}</button>
        <span class="cp-tirador" aria-hidden="true"></span>
        <h2 class="cp-titulo" id="cpTitulo">Compartir producto</h2>
        <div class="cp-producto">
          <img class="cp-foto" alt="">
          <div class="cp-info"><strong class="cp-nombre"></strong><span class="cp-precio"></span></div>
        </div>
        <div class="cp-opciones">
          <button type="button" class="cp-op cp-wa" data-cp="whatsapp"><span class="cp-ico">${ICONOS.whatsapp}</span>WhatsApp</button>
          <button type="button" class="cp-op cp-fb" data-cp="facebook"><span class="cp-ico">${ICONOS.facebook}</span>Facebook</button>
          <button type="button" class="cp-op cp-ig" data-cp="historia"><span class="cp-ico">${ICONOS.historia}</span>Historia</button>
          <button type="button" class="cp-op cp-mas" data-cp="nativo" hidden><span class="cp-ico">${ICONOS.mas}</span>Más</button>
        </div>
        <div class="cp-enlace">
          <input type="text" class="cp-url" readonly aria-label="Enlace del producto">
          <button type="button" class="cp-copiar" data-cp="copiar">${ICONOS.enlace}<span>Copiar</span></button>
        </div>
        <p class="cp-ayuda">En WhatsApp y Facebook se ve con la foto y el precio. Para Instagram usa <b>Historia</b>: descarga la imagen y el enlace queda copiado para el sticker «Enlace».</p>
      </div>`;
    document.body.appendChild(hoja);

    hoja.addEventListener("click", e => {
      if(e.target === hoja) return cerrar();
      const b = e.target.closest("[data-cp]");
      if(!b) return;
      const accion = b.dataset.cp;
      if(accion === "cerrar") cerrar();
      if(accion === "whatsapp") abrirVentana(`https://api.whatsapp.com/send?text=${encodeURIComponent(textoMensaje())}`);
      if(accion === "facebook") abrirVentana(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(datos.url)}`);
      if(accion === "copiar") copiar(datos.url, b);
      if(accion === "nativo") compartirNativo();
      if(accion === "historia") hacerHistoria(b);
    });
    document.addEventListener("keydown", e => {
      if(!hoja.hidden && e.key === "Escape"){ e.stopPropagation(); cerrar(); }
    }, true);
    return hoja;
  }

  function textoMensaje(){
    const precio = datos.precioAntes ? `${pesos(datos.precio)} (antes ${pesos(datos.precioAntes)})` : pesos(datos.precio);
    return `*${datos.nombre}*\n${precio}\n\nMíralo en ${datos.tienda}: ${datos.url}`;
  }

  function abrirVentana(url){
    const v = window.open(url, "_blank", "noopener");
    if(!v) location.href = url;   // si el navegador bloquea la ventana, se abre aquí mismo
  }

  async function copiar(texto, boton){
    let ok = false;
    try{ await navigator.clipboard.writeText(texto); ok = true; }
    catch(e){
      const campo = hoja.querySelector(".cp-url");
      campo.focus(); campo.select();
      try{ ok = document.execCommand("copy"); }catch(_){ ok = false; }
    }
    if(boton){
      const t = boton.querySelector("span");
      boton.classList.toggle("ok", ok);
      if(t) t.textContent = ok ? "¡Copiado!" : "Cópialo";
      clearTimeout(boton._t);
      boton._t = setTimeout(() => { boton.classList.remove("ok"); if(t) t.textContent = "Copiar"; }, 1800);
    }
    return ok;
  }

  async function compartirNativo(){
    try{ await navigator.share({ title: datos.nombre, text: `${datos.nombre} · ${pesos(datos.precio)} en ${datos.tienda}`, url: datos.url }); }
    catch(e){ /* el usuario canceló */ }
  }

  function abrir(d){
    datos = {
      url: d.url, nombre: String(d.nombre || "Producto"), tienda: String(d.tienda || "la tienda"),
      precio: Number(d.precio) || 0, precioAntes: Number(d.precioAntes) || 0, imagen: d.imagen || ""
    };
    crearHoja();
    const foto = hoja.querySelector(".cp-foto");
    foto.src = datos.imagen || "img/placeholder.jpg";
    foto.onerror = () => { foto.onerror = null; foto.src = "img/placeholder.jpg"; };
    hoja.querySelector(".cp-nombre").textContent = datos.nombre;
    hoja.querySelector(".cp-precio").innerHTML = datos.precioAntes
      ? `<s>${esc(pesos(datos.precioAntes))}</s> ${esc(pesos(datos.precio))}` : esc(pesos(datos.precio));
    hoja.querySelector(".cp-url").value = datos.url;
    hoja.querySelector('[data-cp="nativo"]').hidden = !navigator.share;
    const avisoViejo = hoja.querySelector(".cp-aviso"); if(avisoViejo) avisoViejo.remove();
    ultimoFoco = document.activeElement;
    hoja.hidden = false;
    requestAnimationFrame(() => hoja.classList.add("ver"));
    document.documentElement.classList.add("cp-abierto");
    setTimeout(() => hoja.querySelector(".cp-wa").focus({ preventScroll: true }), 50);
  }

  function cerrar(){
    if(!hoja || hoja.hidden) return;
    hoja.classList.remove("ver");
    document.documentElement.classList.remove("cp-abierto");
    setTimeout(() => { hoja.hidden = true; }, 180);
    if(ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
  }

  /* =========================================================
     IMAGEN PARA HISTORIAS (1080 × 1920)
     Usa los colores y la letra de la tienda. Se dibuja en el navegador:
     no se sube a ningún lado.
     ========================================================= */
  function cargarImagen(src){
    return new Promise((ok, mal) => {
      const img = new Image();
      img.crossOrigin = "anonymous";       // las fotos de Supabase permiten esto: así se puede exportar
      img.onload = () => ok(img);
      img.onerror = () => mal(new Error("No se pudo cargar la foto"));
      img.src = src;
    });
  }
  function variable(nombre, respaldo){
    const v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    return v || respaldo;
  }
  function rgb(nombre, respaldo){ return variable(nombre, respaldo).replace(/\s/g, ""); }
  function lineas(ctx, texto, ancho, max){
    const palabras = String(texto).split(/\s+/);
    const salida = [];
    let actual = "";
    for(const p of palabras){
      const prueba = actual ? actual + " " + p : p;
      if(ctx.measureText(prueba).width <= ancho) actual = prueba;
      else{ if(actual) salida.push(actual); actual = p; }
    }
    if(actual) salida.push(actual);
    if(salida.length > max){
      salida.length = max;
      let u = salida[max - 1];
      while(u.length && ctx.measureText(u + "…").width > ancho) u = u.slice(0, -1);
      salida[max - 1] = u.trimEnd() + "…";
    }
    return salida;
  }
  function rectRedondo(ctx, x, y, w, h, r){
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function generarHistoria(d){
    const W = 1080, H = 1920;
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const ctx = c.getContext("2d");

    const fondo = variable("--black", "#0b0b10");
    const acento = variable("--pink", "#ff1493");
    const textoAcento = variable("--texto-acento", "#ffffff");
    const texto = variable("--white", "#ffffff");
    const suave = variable("--muted", "#a0a0aa");
    const acRGB = rgb("--pink-rgb", "255,20,147");
    const secRGB = rgb("--yellow-rgb", "255,200,0");
    const fTitulo = variable("--font-titulo", "Impact, sans-serif");
    const fTexto = variable("--font-texto", "system-ui, sans-serif");
    const pesoTitulo = variable("--font-titulo-peso", "700");
    const mayus = variable("--titulo-transform", "uppercase") !== "none";
    try{ await Promise.all([document.fonts.load(`${pesoTitulo} 80px ${fTitulo}`), document.fonts.load(`700 40px ${fTexto}`)]); }catch(e){}

    // Fondo: color de la tienda con luces del color principal y el secundario
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W * .78, H * .3, 0, W * .78, H * .3, W * .95);
    g.addColorStop(0, `rgba(${acRGB},.55)`); g.addColorStop(1, `rgba(${acRGB},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W * .1, H * .82, 0, W * .1, H * .82, W * .8);
    g.addColorStop(0, `rgba(${secRGB},.28)`); g.addColorStop(1, `rgba(${secRGB},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // Nombre de la tienda arriba
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillStyle = texto;
    ctx.font = `${pesoTitulo} 64px ${fTitulo}`;
    const nombreTienda = mayus ? d.tienda.toUpperCase() : d.tienda;
    ctx.fillText(lineas(ctx, nombreTienda, W - 160, 1)[0], W / 2, 170);
    ctx.fillStyle = acento; rectRedondo(ctx, W / 2 - 50, 205, 100, 8, 4); ctx.fill();

    // Foto del producto: completa, sobre una tarjeta con la misma foto desenfocada de fondo
    const fx = 90, fy = 270, fw = W - 180, fh = 1130;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    rectRedondo(ctx, fx, fy, fw, fh, 48); ctx.fillStyle = "#f2f0ec"; ctx.fill();
    ctx.restore();
    if(d.imagen){
      const img = await cargarImagen(d.imagen);
      ctx.save(); rectRedondo(ctx, fx, fy, fw, fh, 48); ctx.clip();
      const cubre = Math.max(fw / img.width, fh / img.height) * 1.15;
      ctx.filter = "blur(40px) brightness(.9)";
      ctx.drawImage(img, fx + (fw - img.width * cubre) / 2, fy + (fh - img.height * cubre) / 2, img.width * cubre, img.height * cubre);
      ctx.filter = "none";
      const cabe = Math.min(fw / img.width, fh / img.height);
      ctx.drawImage(img, fx + (fw - img.width * cabe) / 2, fy + (fh - img.height * cabe) / 2, img.width * cabe, img.height * cabe);
      ctx.restore();
    }
    // Insignia de descuento
    if(d.precioAntes > d.precio){
      const pct = Math.round((1 - d.precio / d.precioAntes) * 100);
      ctx.font = `800 46px ${fTexto}`;
      const tx = `-${pct}%`, tw = ctx.measureText(tx).width + 56;
      ctx.fillStyle = `rgb(${secRGB})`; rectRedondo(ctx, fx + 36, fy + 36, tw, 82, 41); ctx.fill();
      ctx.fillStyle = variable("--texto-secundario", "#111"); ctx.textAlign = "left"; ctx.fillText(tx, fx + 64, fy + 93);
      ctx.textAlign = "center";
    }

    // Nombre del producto y precio
    ctx.fillStyle = texto;
    ctx.font = `${pesoTitulo} 76px ${fTitulo}`;
    const nombreProd = mayus ? d.nombre.toUpperCase() : d.nombre;
    const ls = lineas(ctx, nombreProd, W - 160, 2);
    let y = 1500;
    ls.forEach(l => { ctx.fillText(l, W / 2, y); y += 86; });
    y += 14;
    ctx.font = `800 84px ${fTexto}`;
    const precioTxt = pesos(d.precio);
    if(d.precioAntes > d.precio){
      const antes = pesos(d.precioAntes);
      ctx.font = `600 48px ${fTexto}`;
      const aw = ctx.measureText(antes).width;
      ctx.font = `800 84px ${fTexto}`;
      const pw = ctx.measureText(precioTxt).width;
      const total = aw + 28 + pw, x0 = (W - total) / 2;
      ctx.textAlign = "left";
      ctx.fillStyle = suave; ctx.font = `600 48px ${fTexto}`; ctx.fillText(antes, x0, y);
      ctx.fillRect(x0, y - 16, aw, 4);
      ctx.fillStyle = acento; ctx.font = `800 84px ${fTexto}`; ctx.fillText(precioTxt, x0 + aw + 28, y);
      ctx.textAlign = "center";
    }else{
      ctx.fillStyle = acento; ctx.fillText(precioTxt, W / 2, y);
    }

    // Botón "Pídelo por WhatsApp" y la dirección de la tienda
    ctx.font = `800 40px ${fTexto}`;
    const cta = "Pídelo por WhatsApp";
    const cw = ctx.measureText(cta).width + 110;
    ctx.fillStyle = acento; rectRedondo(ctx, (W - cw) / 2, 1720, cw, 96, 48); ctx.fill();
    ctx.fillStyle = textoAcento; ctx.fillText(cta, W / 2, 1781);
    ctx.fillStyle = suave; ctx.font = `600 32px ${fTexto}`;
    ctx.fillText(d.url.replace(/^https?:\/\//, "").replace(/\?p=.*$/, ""), W / 2, 1870);

    return new Promise((ok, mal) => c.toBlob(b => b ? ok(b) : mal(new Error("No se pudo crear la imagen")), "image/png"));
  }

  async function hacerHistoria(boton){
    const original = boton.innerHTML;
    boton.disabled = true;
    boton.classList.add("cargando");
    try{
      const blob = await generarHistoria(datos);
      const nombreArchivo = `${datos.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "producto"}-historia.png`;
      const archivo = new File([blob], nombreArchivo, { type: "image/png" });
      await copiar(datos.url);   // el link queda listo para el sticker «Enlace»
      if(navigator.canShare && navigator.canShare({ files: [archivo] })){
        try{ await navigator.share({ files: [archivo], title: datos.nombre }); }
        catch(e){ if(e && e.name !== "AbortError") descargar(blob, nombreArchivo); }
      }else{
        descargar(blob, nombreArchivo);
      }
      aviso("Imagen lista. El enlace quedó copiado: pégalo con el sticker «Enlace» en tu historia.");
    }catch(e){
      console.error(e);
      aviso("No se pudo crear la imagen. Intenta de nuevo.");
    }finally{
      boton.disabled = false;
      boton.classList.remove("cargando");
      boton.innerHTML = original;
    }
  }
  function descargar(blob, nombre){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function aviso(texto){
    let t = hoja.querySelector(".cp-aviso");
    if(!t){ t = document.createElement("p"); t.className = "cp-aviso"; t.setAttribute("role", "status"); hoja.querySelector(".cp-hoja").appendChild(t); }
    t.textContent = texto;
  }

  window.Compartir = { abrir, cerrar, urlProducto, generarHistoria, ICONO: ICONOS.mas };
})();
