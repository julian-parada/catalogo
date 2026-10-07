const WHATSAPP = "573247348475";

const SUPABASE_URL = "https://txnvsigmwshwduhearvz.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnZzaWdtd3Nod2R1aGVhcnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2NDMzMjgsImV4cCI6MjEwNjIxOTMyOH0.JhO4JYOUTh13aZfDT4eDCioTjShcJsVjgxIXcOOS-uQ";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
function renderFiltroCategorias(){
  const categoriasUnicas = [...new Set(products.map(p => p.category))].sort();
  const select = document.getElementById("categoryFilter");
  const valorActual = select.value;

  select.innerHTML = `<option value="all">Todas</option>` +
    categoriasUnicas.map(c => `<option value="${c}">${c}</option>`).join("");

  // Si la categoría que tenía seleccionada el cliente todavía existe, se la respeta
  if(categoriasUnicas.includes(valorActual)) select.value = valorActual;
}

let products = [];

async function cargarProductos(){
  const { data, error } = await supabaseClient
    .from("prendas")
    .select(`id, nombre, precio, precio_oferta, imagen, categoria_id, categorias(nombre), tallas(id, talla, disponible), imagenes_prenda(url, orden)`);

// ...dentro del .map(p => ({...
 

  if(error){ console.error(error); return; }

  products = data
    .map(p => ({
      id: p.id,
      name: p.nombre,
      category: p.categorias ? p.categorias.nombre : "Otros",
       price: p.precio_oferta ? p.precio_oferta : p.precio,
  originalPrice: p.precio_oferta ? p.precio : null,
      img: p.imagen,
      gallery: [p.imagen, ...p.imagenes_prenda.sort((a,b)=>a.orden-b.orden).map(i=>i.url)],
      sizes: p.tallas.filter(t => t.disponible)
    }))
    .filter(p => p.sizes.length > 0);
  renderFiltroCategorias();
  renderProducts();
  updateCount();
}





let cart = JSON.parse(localStorage.getItem("capCart") || "[]");

const money = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);

function renderProducts(){
  const term = document.getElementById("searchInput").value.toLowerCase();
  const category = document.getElementById("categoryFilter").value;
  const filtered = products.filter(p =>
    (category === "all" || p.category === category) &&
    (p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term))
  );
  const container = document.getElementById("products");
  container.innerHTML = filtered.length ? filtered.map(p => `
  <article class="product">
    <img class="product-img" src="${p.img}" alt="${p.name}" onclick="openGallery(${p.id})" onerror="this.src='img/placeholder.jpg'">
    <div class="product-body">
      <h3>${p.name}</h3>
      <p>${p.category}</p>
      <div class="price">
  ${p.originalPrice ? `<span class="price-old">${money(p.originalPrice)}</span>` : ""}
  ${money(p.price)}
  ${p.originalPrice ? `<span class="price-badge">OFERTA</span>` : ""}
</div>
      ${p.sizes.length > 1 ? `
  <select class="talla-select" id="talla-${p.id}">
    ${p.sizes.map(s => `<option value="${s.id}">Talla ${s.talla}</option>`).join("")}
  </select>
` : `
  <p class="talla-unica">Talla: ${p.sizes[0].talla}</p>
  <input type="hidden" id="talla-${p.id}" value="${p.sizes[0].id}">
`}
      <button class="add" onclick="addToCart(${p.id})">AÑADIR <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cart4" viewBox="0 0 16 16">
  <path d="M0 2.5A.5.5 0 0 1 .5 2H2a.5.5 0 0 1 .485.379L2.89 4H14.5a.5.5 0 0 1 .485.621l-1.5 6A.5.5 0 0 1 13 11H4a.5.5 0 0 1-.485-.379L1.61 3H.5a.5.5 0 0 1-.5-.5M3.14 5l.5 2H5V5zM6 5v2h2V5zm3 0v2h2V5zm3 0v2h1.36l.5-2zm1.11 3H12v2h.61zM11 8H9v2h2zM8 8H6v2h2zM5 8H3.89l.5 2H5zm0 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0m9-1a1 1 0 1 0 0 2 1 1 0 0 0 0-2m-2 1a2 2 0 1 1 4 0 2 2 0 0 1-4 0"/>
</svg></button>
    </div>
  </article>
`).join("") : `<div class="empty">No encontramos productos con esa búsqueda.</div>`;
}

function save(){localStorage.setItem("capCart",JSON.stringify(cart));updateCount()}
function addToCart(id){
  const p = products.find(x=>x.id===id);
  const tallaId = document.getElementById(`talla-${id}`).value;
  const tallaObj = p.sizes.find(s => String(s.id) === String(tallaId));
  const cartId = `${id}_${tallaId}`;

  const found = cart.find(x=>x.cartId===cartId);
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
  cart = cart.filter(x=>x.cartId!==cartId);
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
  const box=document.getElementById("cartItems");
  if(!cart.length){
    box.innerHTML='<p class="note">Todavía no has seleccionado ninguna prenda.</p>';
    document.getElementById("cartTotal").textContent=money(0);
    return;
  }
  box.innerHTML=cart.map(x=>`
    <div class="cart-row">
      <img src="${x.img}" alt="${x.name}">
      <div class="cart-info">
        <strong>${x.name}</strong>
        <small>Talla: ${x.talla} · ${money(x.price)} c/u</small>
        <div class="qty">
          <button onclick="changeQty('${x.cartId}',-1)">−</button>
          <span>${x.qty}</span>
          <button onclick="changeQty('${x.cartId}',1)">+</button>
        </div>
      </div>
      <button class="remove" onclick="removeFromCart('${x.cartId}')">Eliminar</button>
    </div>`).join("");
  document.getElementById("cartTotal").textContent=money(cart.reduce((a,x)=>a+x.price*x.qty,0));
}





function updateCount(){document.getElementById("cartCount").textContent=cart.reduce((a,x)=>a+x.qty,0)}

async function sendWhatsapp(){
  if(!cart.length){alert("Agrega al menos una prenda al pedido.");return}

  const btn = document.getElementById("sendWhatsapp");
  btn.disabled = true;
  btn.textContent = "Generando pedido...";

  const total = cart.reduce((a,x)=>a+x.price*x.qty,0);

  // 1. Crear el pedido "padre"
  const { data: pedidoNuevo, error: errorPedido } = await supabaseClient
    .from("pedidos")
    .insert({ total })
    .select()
    .single();

  if(errorPedido){
    alert("No se pudo generar el pedido, intenta de nuevo.");
    btn.disabled = false;
    btn.textContent = "ENVIAR PEDIDO POR WHATSAPP";
    return;
  }

  // 2. Crear el detalle: una fila por cada producto del carrito
  const filas = cart.map(x => ({
    pedido_id: pedidoNuevo.id,
    prenda_id: x.id,
    nombre: x.name,
    talla: x.talla,
    precio_unitario: x.price,
    cantidad: x.qty,
    imagen: x.img
  }));

  const { error: errorDetalle } = await supabaseClient.from("detalle_pedido").insert(filas);

  if(errorDetalle){
    alert("El pedido se creó pero hubo un error al guardar los productos.");
    btn.disabled = false;
    btn.textContent = "ENVIAR PEDIDO POR WHATSAPP";
    return;
  }

  // 3. Armar el link y abrir WhatsApp con un mensaje corto
  const urlPedido = `${window.location.origin}${window.location.pathname.replace("index.html","")}pedido.html?codigo=${pedidoNuevo.codigo}`;

  const textoPlano = `Hola, buen día 👋 Quiero hacer este pedido:\n\n${urlPedido}\n\nTotal estimado: ${money(total)}\n\n¿Me confirman disponibilidad y tiempo de envío? Gracias.`;
  const msg = encodeURIComponent(textoPlano);

  window.open(`https://wa.me/${WHATSAPP}?text=${msg}`,"_blank");

  btn.disabled = false;
  btn.textContent = "ENVIAR PEDIDO POR WHATSAPP";
}
let toastTimeout;
function showToast(texto){
  const toast = document.getElementById("toast");
  toast.textContent = texto;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 1800);
}

let currentGallery = [];
let currentIndex = 0;

function openGallery(id){
  const p = products.find(x => x.id === id);
  currentGallery = p.gallery.length ? p.gallery : [p.img];
  currentIndex = 0;
  renderGallery();
  document.getElementById("imgModal").classList.add("show");
}

function renderGallery(){
  document.getElementById("imgBig").src = currentGallery[currentIndex];
  document.getElementById("imgThumbs").innerHTML = currentGallery.length > 1
    ? currentGallery.map((url, i) => `
        <img src="${url}" class="thumb ${i === currentIndex ? 'active' : ''}"
             onclick="event.stopPropagation(); selectThumb(${i})">
      `).join("")
    : "";
}

function selectThumb(i){
  currentIndex = i;
  renderGallery();
}
document.getElementById("imgModal").addEventListener("click", e => {
  e.currentTarget.classList.remove("show");
});
document.getElementById("searchInput").addEventListener("input",renderProducts);
document.getElementById("categoryFilter").addEventListener("change",renderProducts);
document.getElementById("openCart").onclick=()=>{renderCart();document.getElementById("cartModal").classList.add("show")}

document.getElementById("closeCart").onclick=()=>document.getElementById("cartModal").classList.remove("show");
document.getElementById("cartModal").addEventListener("click",e=>{if(e.target.id==="cartModal")e.currentTarget.classList.remove("show")});
document.getElementById("sendWhatsapp").onclick=sendWhatsapp;

cargarProductos();
renderCart();
