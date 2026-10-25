// seguridad.js — reglas y ayudas de seguridad del acceso al panel.
// Lo usan admin.html (login y cambio de contraseña) y restablecer.html.
//
// La seguridad de verdad la pone Supabase (contraseñas cifradas, límite de
// intentos por IP, links de un solo uso). Esto suma: contraseñas fuertes,
// freno de intentos en el navegador y CAPTCHA opcional.

/* =========================================================
   CAPTCHA (opcional) — Cloudflare Turnstile, gratis
   1. Crea el widget en dash.cloudflare.com → Turnstile y pega aquí la "Site Key"
   2. En Supabase → Authentication → Attack Protection → activa CAPTCHA,
      elige Turnstile y pega la "Secret Key"
   Mientras esté vacío, no se usa. OJO: si lo activas en Supabase, pon la
   Site Key aquí el mismo día, o nadie podrá entrar.
   ========================================================= */
const TURNSTILE_SITE_KEY = "";

const SEG = {
  MIN_LARGO: 10,
  MAX_INTENTOS: 5,           // fallos seguidos antes de frenar
  ESPERA_BASE: 30,           // segundos de la primera espera (luego se duplica)
  ESPERA_MAX: 15 * 60        // nunca más de 15 minutos
};

/* ---------- Reglas de contraseña ---------- */
// Devuelve la lista de reglas con si se cumplen o no (para mostrarlas en vivo)
function reglasContrasena(clave, correo){
  const c = String(clave || "");
  const usuario = String(correo || "").split("@")[0].toLowerCase();
  return [
    { ok: c.length >= SEG.MIN_LARGO, texto: `Al menos ${SEG.MIN_LARGO} caracteres` },
    { ok: /[a-záéíóúñ]/i.test(c) && /\d/.test(c), texto: "Letras y números" },
    { ok: /[a-záéíóúñ]/.test(c) && /[A-ZÁÉÍÓÚÑ]/.test(c) || /[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/.test(c), texto: "Una mayúscula o un símbolo" },
    { ok: !(usuario.length >= 3 && c.toLowerCase().includes(usuario)) && !/^(.)\1+$/.test(c) && !/(123456|abcdef|qwerty|contrase|password)/i.test(c), texto: "Que no sea fácil de adivinar" }
  ];
}
const contrasenaValida = (clave, correo) => reglasContrasena(clave, correo).every(r => r.ok);

// Pinta las reglas y una barra de fuerza dentro de `contenedor`
function pintarFuerza(contenedor, clave, correo){
  if(!contenedor) return;
  const reglas = reglasContrasena(clave, correo);
  const cumplidas = reglas.filter(r => r.ok).length;
  const extra = String(clave || "").length >= 14 ? 1 : 0;
  const nivel = clave ? Math.min(4, cumplidas + extra - (cumplidas < reglas.length ? 1 : 0)) : 0;
  const nombres = ["", "Débil", "Regular", "Buena", "Muy fuerte"];
  contenedor.innerHTML = `
    <div class="fuerza-barra" data-nivel="${nivel}"><i></i><i></i><i></i><i></i></div>
    <span class="fuerza-texto">${clave ? nombres[Math.max(1, nivel)] : ""}</span>
    <ul class="fuerza-reglas">${reglas.map(r => `<li class="${r.ok ? "ok" : ""}">${r.ok ? "✓" : "○"} ${r.texto}</li>`).join("")}</ul>`;
}

/* ---------- Mostrar / ocultar contraseña ---------- */
function activarOjos(raiz = document){
  raiz.querySelectorAll("[data-ojo]").forEach(btn => {
    if(btn.dataset.listo) return;
    btn.dataset.listo = "1";
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.ojo);
      const ver = input.type === "password";
      input.type = ver ? "text" : "password";
      btn.textContent = ver ? "Ocultar" : "Ver";
      btn.setAttribute("aria-label", ver ? "Ocultar contraseña" : "Mostrar contraseña");
      input.focus();
    });
  });
}

/* ---------- Freno de intentos fallidos (en este navegador) ---------- */
const CLAVE_INTENTOS = "intentosLogin";
function leerIntentos(){
  try{ return JSON.parse(localStorage.getItem(CLAVE_INTENTOS)) || { n: 0, hasta: 0 }; }
  catch(e){ return { n: 0, hasta: 0 }; }
}
function segundosBloqueo(){
  const { hasta } = leerIntentos();
  return Math.max(0, Math.ceil((hasta - Date.now()) / 1000));
}
function registrarFallo(){
  const it = leerIntentos();
  it.n += 1;
  if(it.n >= SEG.MAX_INTENTOS){
    const espera = Math.min(SEG.ESPERA_MAX, SEG.ESPERA_BASE * 2 ** (it.n - SEG.MAX_INTENTOS));
    it.hasta = Date.now() + espera * 1000;
  }
  try{ localStorage.setItem(CLAVE_INTENTOS, JSON.stringify(it)); }catch(e){}
  return segundosBloqueo();
}
function limpiarIntentos(){ try{ localStorage.removeItem(CLAVE_INTENTOS); }catch(e){} }
function textoEspera(seg){
  return seg >= 60 ? `${Math.ceil(seg / 60)} min` : `${seg} s`;
}

/* ---------- CAPTCHA ---------- */
let captchaListo = null;
function cargarCaptcha(){
  if(!TURNSTILE_SITE_KEY) return Promise.resolve(false);
  if(captchaListo) return captchaListo;
  captchaListo = new Promise(ok => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => ok(true);
    s.onerror = () => ok(false);
    document.head.appendChild(s);
  });
  return captchaListo;
}
// Dibuja el CAPTCHA en `caja` y devuelve una función que entrega el token
const SIN_CAPTCHA = { token: () => undefined, reiniciar: () => {} };
async function prepararCaptcha(caja){
  if(!caja || !(await cargarCaptcha()) || !window.turnstile) return SIN_CAPTCHA;
  caja.hidden = false;
  let token;
  const id = window.turnstile.render(caja, {
    sitekey: TURNSTILE_SITE_KEY,
    language: "es",
    callback: t => { token = t; },
    "expired-callback": () => { token = undefined; }
  });
  return {
    token: () => token,
    reiniciar: () => { token = undefined; window.turnstile.reset(id); }
  };
}

/* ---------- Mensajes de error de Supabase en español ---------- */
function errorAmigable(err){
  const m = String((err && (err.message || err.error_description)) || "").toLowerCase();
  if(m.includes("invalid login") || m.includes("invalid credentials")) return "Correo o contraseña incorrectos.";
  if(m.includes("email not confirmed")) return "Tu correo todavía no está confirmado. Escríbele al administrador.";
  if(m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Demasiados intentos. Espera unos minutos y vuelve a intentar.";
  if(m.includes("captcha")) return "Completa la verificación de seguridad.";
  if(m.includes("same") && m.includes("password")) return "La nueva contraseña debe ser distinta a la anterior.";
  if(m.includes("weak") || m.includes("pwned") || m.includes("leaked")) return "Esa contraseña es muy común o apareció en filtraciones. Usa otra.";
  if(m.includes("expired") || m.includes("invalid") && m.includes("token")) return "El link ya venció o ya se usó. Pide uno nuevo.";
  if(m.includes("network") || m.includes("fetch")) return "Sin conexión. Revisa tu internet.";
  return "No se pudo completar. Intenta de nuevo.";
}

/* ---------- Link para restablecer contraseña ---------- */
function urlRestablecer(){
  return new URL("restablecer.html", location.href.split("#")[0].split("?")[0]).href;
}
