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
        <img src="${item.imagen}" alt="${item.nombre}">
        <div class="pedido-item-body">
          <h3>${item.nombre}</h3>
          <p>Talla: ${item.talla} · Cantidad: ${item.cantidad}</p>
          <p>${money(item.precio_unitario)} c/u</p>
        </div>
      </div>
    `).join("")}

    <div class="pedido-total">
      <span>Total</span>
      <span>${money(pedido.total)}</span>
    </div>
  `;
}

cargarPedido();