// script.js — catálogo público.
// Se carga al final del <body>, DESPUÉS de tienda.js.
// Necesita antes: supabase-js, supabaseConfig.js (supabaseClient), tema.js y tienda.js (window.CFG).

const DIAS_NUEVO = 15; // una prenda cuenta como "nueva" durante estos días desde que se agrega

let products = [];
let categoriasMenu = [];
let currentCategory = "all"; // "all", "__nuevos__", "__promos__" o el id de una categoría

// Carrito guardado en el navegador. Se descartan restos de versiones viejas (sin cartId).
let cart = [];
const CART_KEY = claveLocal("capCart");   // cada tienda tiene su carrito (claveLocal viene de tema.js)
try{ cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]"); }catch(e){ cart = []; }
if(!Array.isArray(cart)) cart = [];
cart = cart.filter(x => x && x.cartId);

const money = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);

// Evita que un nombre con comillas o < > rompa el HTML de las tarjetas
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => (
  { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]
));

/* ---------------------------------------------------------
   PRENDAS NUEVAS
   --------------------------------------------------------- */
// creado_en es TIMESTAMP sin zona: llega sin "Z" pero está en UTC.
function fechaDe(valor){
  if(!valor) return null;
  let s = String(valor).replace(" ", "T").replace(/(\.\d{3})\d+/, "$1");
  if(!/(Z|[+-]\d\d:?\d\d)$/i.test(s)) s += "Z";
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function esNuevo(p){
  const f = fechaDe(p.creado);
  if(!f) return false;
  return (Date.now() - f.getTime()) / 86400000 <= DIAS_NUEVO;
}

/* ---------------------------------------------------------
   CARGA DE DATOS
   --------------------------------------------------------- */
async function cargarProductos(){
  const tienda = await window.tiendaActual;
  if(!tienda){ pantallaBloqueo("noExiste"); return; }
  if(!tienda.activa){ pantallaBloqueo("suspendida"); return; }

  const { data, error } = await supabaseClient
    .from("prendas")
    .select(`id, nombre, precio, precio_oferta, imagen, creado_en, categoria_id, categorias(nombre), tallas(id, talla, disponible), imagenes_prenda(url, orden)`)
    .eq("tienda_id", tienda.id)
    .order("creado_en", { ascending: false });

  if(error){ console.error(error); return; }

  products = data
    .map(p => ({
      id: p.id,
      name: p.nombre,
      category: p.categorias ? p.categorias.nombre : "Otros",
      categoryId: p.categoria_id,
      price: p.precio_oferta ? p.precio_oferta : p.precio,
      originalPrice: p.precio_oferta ? p.precio : null,
      img: p.imagen,
      creado: p.creado_en,
      gallery: [p.imagen, ...p.imagenes_prenda.sort((a,b)=>a.orden-b.orden).map(i=>i.url)],
      sizes: p.tallas.filter(t => t.disponible)
    }))
    .filter(p => p.sizes.length > 0);

  // Categorías que el cliente quiere ver en el menú
  const { data: cats, error: errorCats } = await supabaseClient
    .from("categorias")
    .select("id, nombre")
    .eq("tienda_id", tienda.id)
    .eq("en_menu", true)
    .order("orden")
    .order("id");

  if(errorCats) console.error(errorCats);
  categoriasMenu = cats || [];

  renderNav();
  renderProducts();
  updateCount();
}

/* ---------------------------------------------------------
   BARRA SUPERIOR: Categorías ▾ | Nuevos | Promociones
   --------------------------------------------------------- */
function renderNav(){
  const conProductos = new Set(products.map(p => String(p.categoryId)));
  const items = categoriasMenu.filter(c => conProductos.has(String(c.id)));
  const hayPromos = products.some(p => p.originalPrice);
  const hayNuevos = products.some(esNuevo);

  // Menú desplegable de categorías (cada una con cuántas prendas tiene)
  const menu = document.getElementById("catMenu");
  menu.textContent = "";

  const agregar = (valor, texto, cantidad) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat-item" + (currentCategory === valor ? " active" : "");
    b.dataset.cat = valor;

    const t = document.createElement("span");
    t.textContent = texto;
    b.appendChild(t);

    const n = document.createElement("small");
    n.textContent = cantidad;
    b.appendChild(n);

    menu.appendChild(b);
  };

  agregar("all", "Ver todo el catálogo", products.length);
  items.forEach(c => {
    agregar(String(c.id), c.nombre, products.filter(p => String(p.categoryId) === String(c.id)).length);
  });

  // El botón muestra la categoría elegida
  const elegida = items.find(c => String(c.id) === currentCategory);
  document.getElementById("catTriggerLabel").textContent = elegida ? elegida.nombre : "Categorías";
  document.getElementById("catTrigger").classList.toggle("active", Boolean(elegida));
  document.getElementById("catDropdown").hidden = items.length === 0;

  const btnNuevos = document.getElementById("btnNuevos");
  btnNuevos.hidden = !hayNuevos;
  btnNuevos.classList.toggle("active", currentCategory === "__nuevos__");

  const btnPromos = document.getElementById("btnPromos");
  btnPromos.hidden = !hayPromos;
  btnPromos.classList.toggle("active", currentCategory === "__promos__");

  renderFooterCats(items, hayPromos, hayNuevos);
}

function renderFooterCats(items, hayPromos, hayNuevos){
  const ul = document.getElementById("footerCats");
  if(!ul) return;
  ul.textContent = "";

  const agregar = (valor, texto) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.cat = valor;
    b.textContent = texto;
    li.appendChild(b);
    ul.appendChild(li);
  };

  agregar("all", "Todo el catálogo");
  if(hayNuevos) agregar("__nuevos__", "Nuevos");
  if(hayPromos) agregar("__promos__", "Promociones");
  items.forEach(c => agregar(String(c.id), c.nombre));
}

function abrirMenuCategorias(){
  document.getElementById("catMenu").hidden = false;
  document.getElementById("catTrigger").setAttribute("aria-expanded", "true");
}

function cerrarMenuCategorias(){
  document.getElementById("catMenu").hidden = true;
  document.getElementById("catTrigger").setAttribute("aria-expanded", "false");
}

function seleccionarCategoria(valor){
  currentCategory = valor;
  cerrarMenuCategorias();
  renderNav();
  renderProducts();
  irAlCatalogo();
}

function irAlCatalogo(){
  document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
}

/* ---------------------------------------------------------
   TARJETAS DE PRODUCTOS
   --------------------------------------------------------- */
function renderProducts(){
  const term = document.getElementById("searchInput").value.toLowerCase();

  const filtered = products.filter(p => {
    const coincideCategoria =
      currentCategory === "all" ? true :
      currentCategory === "__nuevos__" ? esNuevo(p) :
      currentCategory === "__promos__" ? Boolean(p.originalPrice) :
      String(p.categoryId) === currentCategory;
    const coincideTexto =
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term);
    return coincideCategoria && coincideTexto;
  });

  const container = document.getElementById("products");
  container.innerHTML = filtered.length ? filtered.map(p => `
  <article class="product">
    <img class="product-img" src="${esc(p.img)}" alt="${esc(p.name)}" onclick="openGallery(${p.id})" onerror="this.src='img/placeholder.jpg'">
    <div class="product-body">
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.category)}</p>
      <div class="price">
        ${p.originalPrice ? `<span class="price-old">${money(p.originalPrice)}</span>` : ""}
        ${money(p.price)}
        ${p.originalPrice ? `<span class="price-badge">OFERTA</span>` : ""}
      </div>
      ${p.sizes.length > 1 ? `
        <select class="talla-select" id="talla-${p.id}">
          ${p.sizes.map(s => `<option value="${s.id}">Talla ${esc(s.talla)}</option>`).join("")}
        </select>
      ` : `
        <p class="talla-unica">Talla: ${esc(p.sizes[0].talla)}</p>
        <input type="hidden" id="talla-${p.id}" value="${p.sizes[0].id}">
      `}
      <button class="add" onclick="addToCart(${p.id})">AÑADIR <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cart4" viewBox="0 0 16 16">
        <path d="M0 2.5A.5.5 0 0 1 .5 2H2a.5.5 0 0 1 .485.379L2.89 4H14.5a.5.5 0 0 1 .485.621l-1.5 6A.5.5 0 0 1 13 11H4a.5.5 0 0 1-.485-.379L1.61 3H.5a.5.5 0 0 1-.5-.5M3.14 5l.5 2H5V5zM6 5v2h2V5zm3 0v2h2V5zm3 0v2h1.36l.5-2zm1.11 3H12v2h.61zM11 8H9v2h2zM8 8H6v2h2zM5 8H3.89l.5 2H5zm0 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0m9-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0"/>
      </svg></button>
    </div>
  </article>
  `).join("") : `<div class="empty">No encontramos productos con esa búsqueda.</div>`;
}

/* ---------------------------------------------------------
   CARRITO
   --------------------------------------------------------- */
function save(){ try{ localStorage.setItem(CART_KEY, JSON.stringify(cart)); }catch(e){} updateCount(); }

function addToCart(id){
  const p = products.find(x => x.id === id);
  if(!p) return;

  const campoTalla = document.getElementById(`talla-${id}`);
  const tallaId = campoTalla.value;
  const tallaObj = p.sizes.find(s => String(s.id) === String(tallaId));
  if(!tallaObj) return;

  const cartId = `${id}_${tallaId}`;
  const found = cart.find(x => x.cartId === cartId);
  if(found) found.qty++;
  else cart.push({
    cartId, id: p.id, tallaId,
    name: p.name, talla: tallaObj.talla,
    price: p.price, img: p.img, qty: 1
  });

  save();
  renderCart();

  const btn = document.getElementById("openCart");
  btn.classList.remove("bump");
  void btn.offsetWidth;
  btn.classList.add("bump");

  showToast(`${p.name} agregado al carrito ✓`);
}

function removeFromCart(cartId){
  cart = cart.filter(x => x.cartId !== cartId);
  save(); renderCart();
}

function changeQty(cartId, delta){
  const item = cart.find(x => x.cartId === cartId);
  if(!item) return;
  item.qty += delta;
  if(item.qty <= 0){ removeFromCart(cartId); return; }
  save();
  renderCart();
}

function renderCart(){
  const box = document.getElementById("cartItems");
  if(!cart.length){
    box.innerHTML = '<p class="note">Todavía no has seleccionado ninguna prenda.</p>';
    document.getElementById("cartTotal").textContent = money(0);
    return;
  }
  box.innerHTML = cart.map(x => `
    <div class="cart-row">
      <img src="${esc(x.img)}" alt="${esc(x.name)}">
      <div class="cart-info">
        <strong>${esc(x.name)}</strong>
        <small>Talla: ${esc(x.talla)} · ${money(x.price)} c/u</small>
        <div class="qty">
          <button onclick="changeQty('${esc(x.cartId)}',-1)">−</button>
          <span>${x.qty}</span>
          <button onclick="changeQty('${esc(x.cartId)}',1)">+</button>
        </div>
      </div>
      <button class="remove" onclick="removeFromCart('${esc(x.cartId)}')">Eliminar</button>
    </div>`).join("");
  document.getElementById("cartTotal").textContent = money(cart.reduce((a,x) => a + x.price * x.qty, 0));
}

function updateCount(){
  document.getElementById("cartCount").textContent = cart.reduce((a,x) => a + x.qty, 0);
}

/* ---------------------------------------------------------
   ENVIAR PEDIDO POR WHATSAPP
   --------------------------------------------------------- */
async function sendWhatsapp(){
  if(!cart.length){ alert("Agrega al menos una prenda al pedido."); return; }

  const numero = window.CFG && window.CFG.whatsapp;
  if(!numero){ alert("La tienda todavía no tiene un número de WhatsApp configurado."); return; }
  const saludo = window.CFG.mensaje_saludo || "Hola, quiero hacer este pedido:";

  

  const btn = document.getElementById("sendWhatsapp");
  btn.disabled = true;
  btn.textContent = "Generando pedido...";

  const total = cart.reduce((a,x) => a + x.price * x.qty, 0);

  // El pedido se crea en el servidor: él valida las prendas y calcula el total con los precios reales
  const items = cart.map(x => ({ prenda_id: x.id, talla_id: x.tallaId, cantidad: x.qty }));
  const { data: codigoPedido, error: errorPedido } = await supabaseClient
    .rpc("crear_pedido", { p_items: items });

  if(errorPedido || !codigoPedido){
    console.error(errorPedido);
    const noDisponible = errorPedido && /Talla no disponible|Prenda no existe|Tienda no disponible/.test(errorPedido.message || "");
    alert(noDisponible
      ? "Alguna prenda de tu pedido ya no está disponible. Recarga el catálogo y vuelve a intentar."
      : "No se pudo generar el pedido, intenta de nuevo.");
    btn.disabled = false;
    btn.textContent = "ENVIAR PEDIDO POR WHATSAPP";
    return;
  }

  // Total real calculado por el servidor (si esta consulta falla, se usa el del carrito)
  let totalFinal = total;
  const { data: resumen } = await supabaseClient.rpc("obtener_pedido", { p_codigo: codigoPedido });
  if(resumen && resumen.total != null) totalFinal = Number(resumen.total);

  const base = `${window.location.origin}${window.location.pathname.replace(/index\.html$/, "")}`;
  const urlPedido = base + linkTienda("pedido.html", { codigo: codigoPedido });

  const textoPlano = `${saludo}\n\n${urlPedido}\n\nTotal estimado: ${money(totalFinal)}\n\n¿Me confirman disponibilidad y tiempo de envío? Gracias.`;
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(textoPlano)}`, "_blank");

  btn.disabled = false;
  btn.textContent = "ENVIAR PEDIDO POR WHATSAPP";
}

/* ---------------------------------------------------------
   AVISO "AGREGADO AL CARRITO"
   --------------------------------------------------------- */
let toastTimeout;
function showToast(texto){
  const toast = document.getElementById("toast");
  toast.textContent = texto;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 1800);
}

/* ---------------------------------------------------------
   GALERÍA DE FOTOS
   --------------------------------------------------------- */
let currentGallery = [];
let currentIndex = 0;

function openGallery(id){
  const p = products.find(x => x.id === id);
  if(!p) return;
  currentGallery = p.gallery.length ? p.gallery : [p.img];
  currentIndex = 0;
  renderGallery();
  document.getElementById("imgModal").classList.add("show");
}

function renderGallery(){
  document.getElementById("imgBig").src = currentGallery[currentIndex];
  document.getElementById("imgThumbs").innerHTML = currentGallery.length > 1
    ? currentGallery.map((url, i) => `
        <img src="${esc(url)}" class="thumb ${i === currentIndex ? "active" : ""}"
             onclick="event.stopPropagation(); selectThumb(${i})">
      `).join("")
    : "";
}

function selectThumb(i){
  currentIndex = i;
  renderGallery();
}

/* ---------------------------------------------------------
   EVENTOS
   --------------------------------------------------------- */
document.getElementById("imgModal").addEventListener("click", e => {
  e.currentTarget.classList.remove("show");
});

// Menú desplegable de categorías
document.getElementById("catTrigger").addEventListener("click", e => {
  e.stopPropagation();
  const menu = document.getElementById("catMenu");
  if(menu.hidden) abrirMenuCategorias(); else cerrarMenuCategorias();
});
document.addEventListener("click", e => {
  if(!e.target.closest("#catDropdown")) cerrarMenuCategorias();
});
document.addEventListener("keydown", e => {
  if(e.key === "Escape") cerrarMenuCategorias();
});

// Categorías, Nuevos y Promociones (barra de arriba y pie de página)
document.getElementById("catNav").addEventListener("click", e => {
  const btn = e.target.closest("[data-cat]");
  if(btn) seleccionarCategoria(btn.dataset.cat);
});
document.getElementById("footerCats").addEventListener("click", e => {
  const btn = e.target.closest("[data-cat]");
  if(btn) seleccionarCategoria(btn.dataset.cat);
});

// Buscador
document.getElementById("searchInput").addEventListener("input", e => {
  renderProducts();
  if(e.target.value.trim()) irAlCatalogo();
});

// Carrito
document.getElementById("openCart").onclick = () => {
  renderCart();
  document.getElementById("cartModal").classList.add("show");
};
document.getElementById("closeCart").onclick = () =>
  document.getElementById("cartModal").classList.remove("show");
document.getElementById("cartModal").addEventListener("click", e => {
  if(e.target.id === "cartModal") e.currentTarget.classList.remove("show");
});
document.getElementById("sendWhatsapp").onclick = sendWhatsapp;
// Navegación con teclado en la galería
document.addEventListener("keydown", (e) => {
  const modal = document.getElementById("imgModal");
  if(!modal.classList.contains("show")) return;

  if(e.key === "ArrowRight" && currentGallery.length > 1){
    currentIndex = (currentIndex + 1) % currentGallery.length;
    renderGallery();
  }
  if(e.key === "ArrowLeft" && currentGallery.length > 1){
    currentIndex = (currentIndex - 1 + currentGallery.length) % currentGallery.length;
    renderGallery();
  }
  if(e.key === "Escape"){
    modal.classList.remove("show");
  }
});
(function(){
  const barra = document.querySelector(".topbar");
  if(!barra) return;
  const medir = () => document.documentElement.style.setProperty("--topbar-h", barra.offsetHeight + "px");
  medir();
  window.addEventListener("resize", medir);
  if(window.ResizeObserver) new ResizeObserver(medir).observe(barra);
})();


/* ---------------------------------------------------------
   TIENDA NO ENCONTRADA / SUSPENDIDA
   El bloqueo real lo hace el servidor (no entrega el catálogo de una tienda
   vencida); esto solo muestra un mensaje claro en vez de una página vacía.
   --------------------------------------------------------- */
function pantallaBloqueo(motivo){
  const textos = {
    noExiste:   ["TIENDA NO ENCONTRADA", "Revisa que el link esté completo."],
    suspendida: ["SERVICIO SUSPENDIDO", "Esta tienda se encuentra temporalmente inactiva."]
  };
  const [titulo, detalle] = textos[motivo] || textos.noExiste;

  document.documentElement.style.visibility = "";
  document.body.textContent = "";
  const caja = document.createElement("div");
  caja.style.cssText = "display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:100vh;background:#070707;color:#fff;text-align:center;font-family:sans-serif;padding:20px";
  const h1 = document.createElement("h1");
  h1.style.cssText = "font-size:2.6rem;color:#ff1493;font-family:'Bebas Neue',sans-serif;margin:0 0 12px";
  h1.textContent = titulo;
  const p = document.createElement("p");
  p.style.cssText = "font-size:1.1rem;max-width:420px;margin:0";
  p.textContent = detalle;
  caja.append(h1, p);
  document.body.appendChild(caja);
}




cargarProductos();
renderCart();
