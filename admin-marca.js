// admin-marca.js — pone el nombre y el logo de la tienda en las páginas del admin.
// Va al final del <body> de cada página del admin (admin, agregarPrenda, editarPrenda, ajustes).
// Necesita tema.js en el <head> (aporta window.configTienda).
//
// No hace falta cambiar el HTML: busca el encabezado por sus clases (.brand-icon, .brand h1)
// y, si existe, el nombre de la pantalla de login (.brand-mark).

(function(){
  // Caché separada por tienda (claveLocal viene de tema.js)
  const tituloBase = document.title.split(" — ")[0]; // "Agregar prenda — Admin" -> "Agregar prenda"

  function urlSegura(u){
    return typeof u === "string" && /^https?:\/\//i.test(u.trim()) ? u.trim() : null;
  }

  function pintar(cfg){
    if(!cfg) return;
    const nombre = String(cfg.nombre_tienda || "Mi tienda").trim();
    const logo = urlSegura(cfg.logo_url);

    // Encabezado del panel: logo o, si no hay, la inicial del nombre
    document.querySelectorAll(".brand-icon").forEach(icono => {
      icono.textContent = "";
      if(logo){
        const img = document.createElement("img");
        img.src = logo;
        img.alt = "";
        img.style.objectFit = "contain";
        img.style.padding = "6px";
        icono.appendChild(img);
        icono.style.background = "var(--card, #131317)"; // fondo neutro para que el logo se vea bien
      }else{
        icono.textContent = nombre.charAt(0).toUpperCase();
        icono.style.background = ""; // vuelve al degradado de la paleta
      }
    });

    document.querySelectorAll(".brand h1").forEach(h => {
      h.textContent = nombre.toUpperCase();
    });

    // Pantalla de login: el texto pequeño de arriba pasa a ser el nombre de la tienda...
    const marcaLogin = document.querySelector(".brand-mark");
    if(marcaLogin){
      const conTexto = [...marcaLogin.childNodes].filter(n =>
        !(n.nodeType === 1 && n.classList.contains("brand-line")) && n.textContent.trim());
      if(conTexto.length) conTexto[conTexto.length - 1].textContent = nombre.toUpperCase();

      // ...y, si hay logo, aparece encima
      const previo = document.querySelector("[data-login-logo]");
      if(previo) previo.remove();
      if(logo){
        const img = document.createElement("img");
        img.src = logo;
        img.alt = nombre;
        img.setAttribute("data-login-logo", "");
        img.style.cssText = "display:block;height:56px;max-width:180px;object-fit:contain;margin-bottom:20px";
        marcaLogin.parentNode.insertBefore(img, marcaLogin);
      }
    }

    document.title = `${tituloBase} — ${nombre}`;
  }

  // Para que ajustes.js pueda repintar el encabezado apenas se guarda
  window.pintarMarcaAdmin = pintar;

  // 1) Lo último guardado en este navegador (evita ver un nombre equivocado un instante)
  try{
    const guardada = JSON.parse(localStorage.getItem(claveLocal("tiendaCfg")));
    if(guardada) pintar(guardada);
  }catch(e){ /* caché dañado: se ignora */ }

  // 2) Lo que hay ahora en Supabase
  if(window.configTienda){
    window.configTienda.then(cfg => {
      if(!cfg) return;
      pintar(cfg);
      try{ localStorage.setItem(claveLocal("tiendaCfg"), JSON.stringify(cfg)); }catch(e){}
    });
  }
})();
