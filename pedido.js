// pedido.html no carga utils.js, por eso estas funciones van aquí (así el archivo es autónomo).
function escapeHtml(str){
  if(str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Solo deja pasar links http(s) o imágenes data:image; lo demás queda vacío
function safeUrl(url){
  if(!url) return "";
  const u = String(url).trim();
  if(/^(https?:|data:image\/)/i.test(u)) return escapeHtml(u);
  return "";
}

const params = new URLSearchParams(window.location.search);
const codigo = params.get("codigo");

const money = n => new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);

async function cargarPedido(){
  const wrap = document.getElementById("pedidoWrap");

  if(!codigo){
    wrap.innerHTML = `<div class="pedido-error"><p>No se encontró ningún pedido en este link.</p></div>`;
    return;
  }

  // El pedido se consulta por su código con una función del servidor (las tablas no son públicas)
  const { data: pedido, error: errorPedido } = await supabaseClient
    .rpc("obtener_pedido", { p_codigo: codigo });

  if(errorPedido || !pedido){
    wrap.innerHTML = `<div class="pedido-error"><p>No se encontró este pedido. Puede que el link esté incompleto.</p></div>`;
    return;
  }

  const items = pedido.items || [];
  const op = textoOpcion(await window.configTienda);   // tema.js

  // La fecha llega sin zona horaria (UTC): se marca como UTC para mostrarla en tu hora local
  const creado = String(pedido.creado_en || "");
  const creadoUtc = /[zZ]$|[+-]\d\d(:?\d\d)?$/.test(creado) ? creado : creado + "Z";
  const fecha = new Date(creadoUtc).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  wrap.innerHTML = `
    <h1>Resumen del pedido</h1>
    <p class="pedido-fecha">Pedido realizado el ${fecha}${detalleEntrega(pedido)}</p>

    ${items.map(item => `
      <div class="pedido-item">
        <img src="${safeUrl(item.imagen)}" alt="${escapeHtml(item.nombre)}">
        <div class="pedido-item-body">
          <h3>${escapeHtml(item.nombre)}</h3>
          <p>${esOpcionUnica(item.talla) ? "" : `${escapeHtml(op.singular)}: ${escapeHtml(item.talla)} · `}Cantidad: ${Number(item.cantidad) || 0}</p>
          <p>${money(Number(item.precio_unitario) || 0)} c/u</p>
        </div>
      </div>
    `).join("")}

    <div class="pedido-total">
      <span>Total</span>
      <span>${money(Number(pedido.total) || 0)}</span>
    </div>
  `;
}

// "· 🛵 Domicilio · 💳 Nequi" (la dirección no se muestra aquí: este link lo puede abrir cualquiera que lo tenga)
function detalleEntrega(p){
  const entrega = { domicilio: "🛵 Domicilio", recoger: "🏪 Recoge en tienda" }[p.entrega];
  const pago = { efectivo: "💵 Efectivo", nequi: "📱 Nequi", transferencia: "🏦 Transferencia" }[p.pago];
  return [entrega, pago].filter(Boolean).map(t => " · " + t).join("");
}

cargarPedido();
