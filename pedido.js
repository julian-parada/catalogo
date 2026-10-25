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

const ICONO_WA = `<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232"/></svg>`;

async function cargarPedido(){
  const wrap = document.getElementById("pedidoWrap");

  if(!codigo){
    wrap.innerHTML = `<div class="pedido-error"><p>No se encontró ningún pedido en este link.</p></div>`;
    return;
  }

  // El pedido se consulta por su código con una función del servidor (las tablas no son públicas)
  const [{ data: pedido, error: errorPedido }, cfg] = await Promise.all([
    supabaseClient.rpc("obtener_pedido", { p_codigo: codigo }),
    window.configTienda
  ]);

  if(errorPedido || !pedido){
    wrap.innerHTML = `<div class="pedido-error"><p>No se encontró este pedido. Puede que el link esté incompleto.</p></div>`;
    return;
  }

  const items = pedido.items || [];
  const nombreTienda = (cfg && cfg.nombre_tienda) || "";
  if(nombreTienda) document.title = `Pedido | ${nombreTienda}`;

  // La fecha llega sin zona horaria (UTC): se marca como UTC para mostrarla en tu hora local
  const creado = String(pedido.creado_en || "");
  const creadoUtc = /[zZ]$|[+-]\d\d(:?\d\d)?$/.test(creado) ? creado : creado + "Z";
  const fecha = new Date(creadoUtc).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "short" });

  const cliente = String(pedido.cliente_nombre || "").trim();
  const titulo = cliente ? `Pedido de <b>${escapeHtml(cliente)}</b>` : "Resumen del pedido";
  const unidades = items.reduce((a, it) => a + (Number(it.cantidad) || 0), 0);

  wrap.innerHTML = `
    ${marcaTienda(cfg)}

    <section class="pedido-hero">
      <span class="pedido-ok"><i>✓</i> Pedido registrado</span>
      <h1>${titulo}</h1>
      <p class="pedido-fecha">${escapeHtml(fecha)}</p>
      <div class="pedido-chips">
        ${chipsEntrega(pedido).map(t => `<span>${t}</span>`).join("")}
        <span>${unidades} ${unidades === 1 ? "producto" : "productos"}</span>
      </div>
    </section>

    ${items.map(item => {
      const cant = Number(item.cantidad) || 0;
      const precio = Number(item.precio_unitario) || 0;
      return `
      <div class="pedido-item">
        <img src="${safeUrl(item.imagen)}" alt="${escapeHtml(item.nombre)}" onerror="this.style.visibility='hidden'">
        <div class="pedido-item-body">
          <h3>${escapeHtml(item.nombre)}</h3>
          <p>${esOpcionUnica(item.talla) ? "" : `${escapeHtml(item.talla)} · `}${cant} × ${money(precio)}</p>
        </div>
        <span class="pedido-item-precio">${money(precio * cant)}</span>
      </div>`;
    }).join("")}

    <div class="pedido-total">
      <span>Total</span>
      <span>${money(Number(pedido.total) || 0)}</span>
    </div>

    <div class="pedido-acciones">
      ${botonWhatsapp(cfg, cliente)}
      <a class="pedido-seguir" href="${escapeHtml(linkTienda("index.html"))}">Seguir viendo la tienda</a>
    </div>
    <p class="pedido-nota">La tienda confirma la disponibilidad y el valor del envío por WhatsApp.</p>
  `;
}

function marcaTienda(cfg){
  if(!cfg || !cfg.nombre_tienda) return "";
  const logo = safeUrl(cfg.logo_url);
  return `<a class="pedido-marca" href="${escapeHtml(linkTienda("index.html"))}">
    ${logo ? `<img src="${logo}" alt="">` : ""}
    ${!logo || cfg.mostrar_nombre ? `<span>${escapeHtml(cfg.nombre_tienda)}</span>` : ""}
  </a>`;
}

// La dirección no se muestra aquí: este link lo puede abrir cualquiera que lo tenga
function chipsEntrega(p){
  const entrega = { domicilio: "🛵 Domicilio", recoger: "🏪 Recoge en tienda" }[p.entrega];
  const pago = { efectivo: "💵 Efectivo", nequi: "📱 Nequi", transferencia: "🏦 Transferencia" }[p.pago];
  return [entrega, pago].filter(Boolean);
}

function botonWhatsapp(cfg, cliente){
  const n = String((cfg && cfg.whatsapp) || "").replace(/\D/g, "");
  if(n.length < 10 || n === "573000000000") return "";
  const texto = `Hola${cfg.nombre_tienda ? " " + cfg.nombre_tienda : ""}, ${cliente ? `soy ${cliente}, ` : ""}te escribo por mi pedido: ${location.href}`;
  const url = `https://api.whatsapp.com/send?phone=${n}&text=${encodeURIComponent(texto)}`;
  return `<a class="pedido-wa" href="${escapeHtml(url)}" target="_blank" rel="noopener">${ICONO_WA} Escribir a la tienda</a>`;
}

cargarPedido();
