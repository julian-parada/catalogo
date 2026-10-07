let categoriasCache = [];
let prendasCache = [];

async function revisarSesion(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if(session) mostrarPanel();
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const errorBox = document.getElementById("loginError");

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if(error){ errorBox.textContent = "Correo o contraseña incorrectos."; return; }
  mostrarPanel();
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  location.reload();
});

async function mostrarPanel(){
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("panel").style.display = "block";
  await cargarPrendas();
}

async function cargarPrendas(){
  const { data, error } = await supabaseClient
    .from("prendas")
    .select(`id, nombre, precio, imagen, categorias(nombre), tallas(id, talla, disponible)`)
    .order("creado_en", { ascending: false });

  if(error){ console.error(error); return; }
  prendasCache = data;
  renderPrendas();
}

function renderPrendas(){
  const cont = document.getElementById("listaPrendas");
  cont.innerHTML = prendasCache.map(p => `
    <div class="admin-item">
      <img src="${p.imagen}" alt="${p.nombre}">
      <div class="admin-item-body">
        <h3>${p.nombre} — $${Number(p.precio).toLocaleString("es-CO")}</h3>
        <p style="color:var(--muted);margin:0 0 6px">${p.categorias ? p.categorias.nombre : "Sin categoría"}</p>
        <div>
          ${p.tallas.map(t => `
            <label class="talla-chip">
              <input type="checkbox" data-talla="${t.id}" ${t.disponible ? "checked" : ""}>
              ${t.talla}
            </label>
          `).join("")}
        </div>
      </div>
      <div class="item-actions">
        <a href="editarPrenda.html?id=${p.id}" class="edit-link">Editar</a>
        <button class="delete-btn" data-prenda="${p.id}">Eliminar</button>
      </div>
    </div>
  `).join("") || "<p style='color:var(--muted)'>Todavía no has agregado ninguna prenda.</p>";
}

document.getElementById("listaPrendas").addEventListener("change", async (e) => {
  if(e.target.matches("[data-talla]")){
    const { error } = await supabaseClient
      .from("tallas")
      .update({ disponible: e.target.checked })
      .eq("id", e.target.dataset.talla);
    if(error) alert("Error al actualizar: " + error.message);
  }
});

document.getElementById("listaPrendas").addEventListener("click", async (e) => {
  if(e.target.matches("[data-prenda]")){
    if(!confirm("¿Eliminar esta prenda y todas sus tallas?")) return;
    const prendaId = e.target.dataset.prenda;
    await supabaseClient.from("tallas").delete().eq("prenda_id", prendaId);
    const { error } = await supabaseClient.from("prendas").delete().eq("id", prendaId);
    if(error){ alert("Error al eliminar: " + error.message); return; }
    cargarPrendas();
  }
});

revisarSesion();