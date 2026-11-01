// ventas.js — Historial de ventas del panel (pestaña "Ventas" de admin.html).
// Se llena con el botón "Vendido" de cada producto (admin.js llama a Ventas.registrar).
// Necesita la tabla "ventas" (sql/008_ventas.sql).
(function(){
  "use strict";

  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const pesos = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-CO");
  const urlFoto = u => (typeof safeUrl === "function" ? safeUrl(u) : (/^https?:\/\//i.test(u || "") ? u : "")) || "img/placeholder.jpg";
  const $ = id => document.getElementById(id);
  const aviso = (t, a) => (typeof avisar === "function" ? avisar(t, a) : null);

  // ---------- Fechas en hora de Colombia (UTC-5, sin horario de verano) ----------
  const ZONA = "America/Bogota";
  const diaDe = fecha => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fecha));
  const hoy = () => diaDe(new Date());
  const sumarDias = (dia, n) => { const [a, m, d] = dia.split("-").map(Number); return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10); };
  const inicioDe = dia => `${dia}T00:00:00-05:00`;          // el día empieza a medianoche en Colombia
  const nombreDia = dia => {
    if(dia === hoy()) return "Hoy";
    if(dia === sumarDias(hoy(), -1)) return "Ayer";
    const t = new Date(dia + "T12:00:00-05:00").toLocaleDateString("es-CO", { timeZone: ZONA, weekday: "long", day: "numeric", month: "long" });
    return t.charAt(0).toUpperCase() + t.slice(1);
  };
  const horaDe = f => new Date(f).toLocaleTimeString("es-CO", { timeZone: ZONA, hour: "numeric", minute: "2-digit" });
  const mesCorto = dia => new Date(dia + "T12:00:00-05:00").toLocaleDateString("es-CO", { timeZone: ZONA, month: "short" }).replace(".", "");

  // Periodos: [desde, hasta) como días YYYY-MM-DD
  function rango(clave){
    const h = hoy(), [a, m] = h.split("-").map(Number);
    const mes = (anio, mesN) => `${anio}-${String(mesN).padStart(2, "0")}-01`;
    switch(clave){
      case "hoy":     return [h, sumarDias(h, 1)];
      case "7":       return [sumarDias(h, -6), sumarDias(h, 1)];
      case "30":      return [sumarDias(h, -29), sumarDias(h, 1)];
      case "mes":     return [mes(a, m), sumarDias(h, 1)];
      case "pasado":  return m === 1 ? [mes(a - 1, 12), mes(a, 1)] : [mes(a, m - 1), mes(a, m)];
      case "anio":    return [`${a}-01-01`, sumarDias(h, 1)];
      case "rango": {
        const d = $("vDesde").value || h, hs = $("vHasta").value || h;
        return d <= hs ? [d, sumarDias(hs, 1)] : [hs, sumarDias(d, 1)];
      }
    }
    return [mes(a, m), sumarDias(h, 1)];
  }
  const diasEntre = (d, h) => Math.round((Date.parse(h) - Date.parse(d)) / 86400000);

  // ---------- Estado ----------
  let periodo = "mes";
  let ventas = [];          // del periodo elegido
  let anteriores = null;    // totales del periodo anterior (para comparar)
  let cargando = false, sinTabla = false, iniciado = false;

  async function tiendaId(){ const t = await window.tiendaActual; return t && t.id; }

  // ---------- API para admin.js ----------
  async function registrar(d){
    const id = await tiendaId();
    if(!id) return null;
    const fila = {
      tienda_id: id, prenda_id: d.prendaId || null, talla_id: d.tallaId || null,
      producto: String(d.producto || "Producto").slice(0, 200),
      opcion: d.opcion ? String(d.opcion).slice(0, 80) : null,
      categoria: d.categoria ? String(d.categoria).slice(0, 80) : null,
      imagen: /^https?:\/\//i.test(d.imagen || "") ? String(d.imagen).slice(0, 1000) : null,
      precio: Math.max(0, Math.round(Number(d.precio) || 0)), cantidad: 1
    };
    const { data, error } = await supabaseClient.from("ventas").insert(fila).select("id").single();
    if(error){
      console.error(error);
      if(esSinTabla(error)){ sinTabla = true; return null; }
      return null;
    }
    iniciado && cargar();
    return data.id;
  }
  async function borrar(id){
    if(!id) return true;
    const { error } = await supabaseClient.from("ventas").delete().eq("id", id);
    if(error){ console.error(error); return false; }
    iniciado && cargar();
    return true;
  }
  // La tabla todavía no existe (falta correr sql/008_ventas.sql)
  const esSinTabla = e => e && (e.code === "42P01" || e.code === "PGRST205" || (/ventas/i.test(e.message || "") && /does not exist|could not find|schema cache/i.test(e.message || "")));

  // ---------- Carga ----------
  async function cargar(){
    const id = await tiendaId();
    if(!id || cargando) return;
    cargando = true;
    const [d, h] = rango(periodo);
    const n = diasEntre(d, h);
    const [r, rAnt] = await Promise.all([
      supabaseClient.from("ventas")
        .select("id, prenda_id, talla_id, producto, opcion, categoria, imagen, precio, cantidad, vendido_en")
        .eq("tienda_id", id).gte("vendido_en", inicioDe(d)).lt("vendido_en", inicioDe(h))
        .order("vendido_en", { ascending: false }).limit(3000),
      supabaseClient.from("ventas").select("precio, cantidad")
        .eq("tienda_id", id).gte("vendido_en", inicioDe(sumarDias(d, -n))).lt("vendido_en", inicioDe(d)).limit(3000)
    ]);
    cargando = false;
    if(r.error){
      console.error(r.error);
      sinTabla = esSinTabla(r.error);
      pintarError(sinTabla ? "El historial de ventas todavía no está activado. Escríbele a LinkTalogo para activarlo." : "No se pudieron cargar las ventas. Recarga la página.");
      return;
    }
    sinTabla = false;
    ventas = r.data || [];
    anteriores = rAnt.error ? null : (rAnt.data || []);
    pintar();
  }

  // ---------- Pintar ----------
  const totalDe = lista => lista.reduce((a, v) => a + Number(v.precio) * (v.cantidad || 1), 0);
  const unidadesDe = lista => lista.reduce((a, v) => a + (v.cantidad || 1), 0);

  function pintarError(texto){
    $("vResumen").innerHTML = "";
    $("vGrafica").innerHTML = "";
    $("vRankings").hidden = true;
    $("vLista").innerHTML = `<p class="lista-vacia error">${esc(texto)}</p>`;
    $("vExportar").disabled = true;
  }

  function pintar(){
    const [d, h] = rango(periodo);
    const total = totalDe(ventas), unidades = unidadesDe(ventas);
    $("vExportar").disabled = !ventas.length;
    $("vPeriodoTxt").textContent = textoPeriodo(d, h);

    // Comparación con el periodo anterior de la misma duración
    let comp = "";
    if(anteriores && periodo !== "rango"){
      const antes = totalDe(anteriores);
      if(antes > 0){
        const cambio = Math.round((total - antes) / antes * 100);
        comp = `<small class="v-comp ${cambio >= 0 ? "sube" : "baja"}">${cambio >= 0 ? "▲" : "▼"} ${Math.abs(cambio)} % vs. periodo anterior</small>`;
      }else if(total > 0) comp = `<small class="v-comp sube">Primeras ventas del periodo</small>`;
    }

    // Día con más ventas
    const porDia = {};
    ventas.forEach(v => { const k = diaDe(v.vendido_en); porDia[k] = (porDia[k] || 0) + Number(v.precio) * (v.cantidad || 1); });
    const mejor = Object.entries(porDia).sort((a, b) => b[1] - a[1])[0];

    $("vResumen").innerHTML = `
      <div class="v-dato v-dato-grande"><span>Total vendido</span><strong>${pesos(total)}</strong>${comp}</div>
      <div class="v-dato"><span>Productos vendidos</span><strong>${unidades}</strong></div>
      <div class="v-dato"><span>Venta promedio</span><strong>${ventas.length ? pesos(total / ventas.length) : "—"}</strong></div>
      <div class="v-dato"><span>Mejor día</span><strong>${mejor ? esc(nombreDia(mejor[0])) : "—"}</strong>${mejor ? `<small>${pesos(mejor[1])}</small>` : ""}</div>`;

    pintarGrafica(d, h, porDia);
    pintarRankings();
    pintarLista();
  }

  function textoPeriodo(d, h){
    const fin = sumarDias(h, -1);
    const f = dia => new Date(dia + "T12:00:00-05:00").toLocaleDateString("es-CO", { timeZone: ZONA, day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
    return d === fin ? f(d) : `${f(d)} – ${f(fin)}`;
  }

  // Barras por día (o por mes si el periodo es largo)
  function pintarGrafica(d, h, porDia){
    const n = diasEntre(d, h);
    let barras = [];
    if(n <= 62){
      for(let i = 0; i < n; i++){
        const dia = sumarDias(d, i);
        barras.push({ clave: dia, valor: porDia[dia] || 0, etiqueta: String(Number(dia.slice(8))), titulo: nombreDia(dia) });
      }
    }else{
      const porMes = {};
      Object.entries(porDia).forEach(([dia, v]) => { porMes[dia.slice(0, 7)] = (porMes[dia.slice(0, 7)] || 0) + v; });
      let cursor = d.slice(0, 7);
      const ultimo = sumarDias(h, -1).slice(0, 7);
      while(cursor <= ultimo){
        barras.push({ clave: cursor, valor: porMes[cursor] || 0, etiqueta: mesCorto(cursor + "-15"), titulo: cursor });
        const [a, m] = cursor.split("-").map(Number);
        cursor = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
      }
    }
    const max = Math.max(...barras.map(b => b.valor), 0);
    if(!max){ $("vGrafica").innerHTML = ""; $("vGrafica").hidden = true; return; }
    $("vGrafica").hidden = false;
    const cadaCuanto = barras.length > 16 ? Math.ceil(barras.length / 8) : 1;
    $("vGrafica").innerHTML = `
      <div class="v-graf-cab"><span>${n <= 62 ? "Ventas por día" : "Ventas por mes"}</span><span>Máximo ${pesos(max)}</span></div>
      <div class="v-barras" style="--n:${barras.length}">
        ${barras.map((b, i) => `
          <div class="v-barra ${b.valor ? "" : "cero"}" title="${esc(b.titulo)}: ${pesos(b.valor)}">
            <i style="height:${b.valor ? Math.max(4, b.valor / max * 100) : 0}%"></i>
            <span>${i % cadaCuanto === 0 ? esc(b.etiqueta) : ""}</span>
          </div>`).join("")}
      </div>`;
  }

  function ranking(lista, clave, max = 5){
    const m = new Map();
    lista.forEach(v => {
      const k = clave(v); if(!k) return;
      const x = m.get(k) || { nombre: k, unidades: 0, total: 0, imagen: v.imagen };
      x.unidades += v.cantidad || 1; x.total += Number(v.precio) * (v.cantidad || 1);
      m.set(k, x);
    });
    return [...m.values()].sort((a, b) => b.unidades - a.unidades || b.total - a.total).slice(0, max);
  }

  function pintarRankings(){
    const top = ranking(ventas, v => v.producto);
    const cats = ranking(ventas, v => v.categoria || "Sin categoría", 6);
    const tallas = ranking(ventas, v => v.opcion && v.opcion.toLowerCase() !== "única" ? v.opcion : "", 8);
    $("vRankings").hidden = !ventas.length;
    if(!ventas.length) return;
    const maxTop = Math.max(...top.map(x => x.unidades), 1);
    const totalGen = totalDe(ventas) || 1;
    $("vTop").innerHTML = top.map((x, i) => `
      <li>
        <span class="v-pos">${i + 1}</span>
        <img src="${esc(urlFoto(x.imagen))}" alt="" loading="lazy" onerror="this.src='img/placeholder.jpg'">
        <span class="v-top-txt"><b>${esc(x.nombre)}</b><small>${x.unidades} ${x.unidades === 1 ? "vendido" : "vendidos"} · ${pesos(x.total)}</small>
          <i class="v-prop"><i style="width:${x.unidades / maxTop * 100}%"></i></i></span>
      </li>`).join("");
    $("vCats").innerHTML = cats.map(x => `
      <li><span>${esc(x.nombre)}</span><b>${Math.round(x.total / totalGen * 100)} %</b><i class="v-prop"><i style="width:${x.total / totalGen * 100}%"></i></i></li>`).join("");
    $("vTallasBox").hidden = !tallas.length;
    $("vTallas").innerHTML = tallas.map(x => `<li><b>${esc(x.nombre)}</b><span>${x.unidades}</span></li>`).join("");
  }

  function pintarLista(){
    if(!ventas.length){
      $("vLista").innerHTML = `<div class="lista-vacia v-vacio"><b>No hay ventas en este periodo</b><span>Cuando vendas algo, toca <em>Vendido</em> en el producto (pestaña Productos) y aparece aquí con la fecha y el precio.</span></div>`;
      return;
    }
    const grupos = new Map();
    ventas.forEach(v => { const k = diaDe(v.vendido_en); if(!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(v); });
    $("vLista").innerHTML = [...grupos.entries()].map(([dia, lista]) => `
      <section class="v-dia">
        <h4><span>${esc(nombreDia(dia))}</span><small>${unidadesDe(lista)} ${unidadesDe(lista) === 1 ? "venta" : "ventas"} · <b>${pesos(totalDe(lista))}</b></small></h4>
        <ul>
          ${lista.map(v => `
            <li class="v-fila" data-venta="${v.id}">
              <img src="${esc(urlFoto(v.imagen))}" alt="" loading="lazy" onerror="this.src='img/placeholder.jpg'">
              <span class="v-fila-txt"><b>${esc(v.producto)}</b><small>${[v.opcion && v.opcion.toLowerCase() !== "única" ? esc(v.opcion) : "", v.categoria ? esc(v.categoria) : "", horaDe(v.vendido_en)].filter(Boolean).join(" · ")}</small></span>
              <span class="v-precio">${pesos(Number(v.precio) * (v.cantidad || 1))}</span>
              <span class="v-acciones">
                <button type="button" data-v-editar title="Cambiar el precio (si hiciste descuento)" aria-label="Cambiar precio de ${esc(v.producto)}">✎</button>
                <button type="button" data-v-borrar title="Quitar del historial" aria-label="Quitar ${esc(v.producto)} del historial">✕</button>
              </span>
            </li>`).join("")}
        </ul>
      </section>`).join("");
  }

  // ---------- Exportar a Excel (CSV) ----------
  function exportar(){
    if(!ventas.length) return;
    const celda = s => { const t = String(s ?? ""); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const filas = [["Fecha", "Hora", "Producto", "Opción", "Categoría", "Cantidad", "Precio", "Total"]];
    ventas.slice().reverse().forEach(v => filas.push([diaDe(v.vendido_en), horaDe(v.vendido_en), v.producto, v.opcion || "", v.categoria || "",
      v.cantidad || 1, Math.round(Number(v.precio)), Math.round(Number(v.precio) * (v.cantidad || 1))]));
    // Punto y coma + BOM: así Excel en español lo abre con columnas y tildes bien
    const csv = "﻿" + filas.map(f => f.map(celda).join(";")).join("\r\n");
    const [d, h] = rango(periodo);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `ventas-${d}-a-${sumarDias(h, -1)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    aviso("Archivo descargado: ábrelo con Excel o Google Sheets.");
  }

  // ---------- Eventos ----------
  function iniciar(){
    if(iniciado) return;
    iniciado = true;
    $("vPeriodos").addEventListener("click", e => {
      const b = e.target.closest("[data-periodo]"); if(!b) return;
      periodo = b.dataset.periodo;
      document.querySelectorAll("#vPeriodos [data-periodo]").forEach(x => x.classList.toggle("activo", x === b));
      $("vRango").hidden = periodo !== "rango";
      if(periodo === "rango" && !$("vDesde").value){ $("vDesde").value = sumarDias(hoy(), -6); $("vHasta").value = hoy(); }
      cargar();
    });
    ["vDesde", "vHasta"].forEach(id => $(id).addEventListener("change", () => periodo === "rango" && cargar()));
    $("vExportar").addEventListener("click", exportar);
    $("vLista").addEventListener("click", async e => {
      const fila = e.target.closest("[data-venta]"); if(!fila) return;
      const v = ventas.find(x => String(x.id) === fila.dataset.venta); if(!v) return;
      if(e.target.closest("[data-v-borrar]")){
        if(!confirm(`¿Quitar "${v.producto}" del historial? El producto no se vuelve a publicar.`)) return;
        if(await borrar(v.id)) aviso("Venta quitada del historial.");
        else alert("No se pudo quitar. Intenta de nuevo.");
      }
      if(e.target.closest("[data-v-editar]")){
        const precio = fila.querySelector(".v-precio");
        if(precio.querySelector("input")) return;
        precio.innerHTML = `<input type="number" min="0" step="100" inputmode="numeric" value="${Math.round(Number(v.precio))}" aria-label="Nuevo precio"><button type="button" data-v-guardar>Guardar</button>`;
        const input = precio.querySelector("input"); input.focus(); input.select();
        const guardar = async () => {
          const nuevo = Math.round(Number(input.value));
          if(!(nuevo >= 0)){ input.focus(); return; }
          const { error } = await supabaseClient.from("ventas").update({ precio: nuevo }).eq("id", v.id);
          if(error){ alert("No se pudo guardar: " + error.message); return; }
          aviso("Precio actualizado."); cargar();
        };
        precio.querySelector("[data-v-guardar]").addEventListener("click", guardar);
        input.addEventListener("keydown", ev => { if(ev.key === "Enter") guardar(); if(ev.key === "Escape") pintarLista(); });
      }
    });
  }

  window.Ventas = {
    registrar, borrar,
    mostrar(){ iniciar(); cargar(); },
    get sinTabla(){ return sinTabla; }
  };
})();
