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

  const { data: pedido, error: errorPedido } = await supabaseClient
    .from("pedidos")
    .select("id, codigo, total, creado_en")
    .eq("codigo", codigo)
    .single();

  if(errorPedido || !pedido){
    wrap.innerHTML = `<div class="pedido-error"><p>No se encontró este pedido. Puede que el link esté incompleto.</p></div>`;
    return;
  }

  const { data: items, error: errorItems } = await supabaseClient
    .from("detalle_pedido")
    .select("nombre, talla, precio_unitario, cantidad, imagen")
    .eq("pedido_id", pedido.id);

  if(errorItems){
    wrap.innerHTML = `<div class="pedido-error"><p>Hubo un problema al cargar los productos de este pedido.</p></div>`;
    return;
  }

  const fecha = new Date(pedido.creado_en).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  wrap.innerHTML = `
    <h1>Resumen del pedido</h1>
    <p class="pedido-fecha">Pedido realizado el ${fecha}</p>

    ${items.map(item => `
      <div class="pedido-item">
        <img src="${safeUrl(item.imagen)}" alt="${escapeHtml(item.nombre)}">
        <div class="pedido-item-body">
          <h3>${escapeHtml(item.nombre)}</h3>
          <p>Talla: ${escapeHtml(item.talla)} · Cantidad: ${Number(item.cantidad) || 0}</p>
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

cargarPedido();