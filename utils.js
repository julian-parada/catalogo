


// utils.js — helpers compartidos

function escapeHtml(str){
  if(str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeUrl(url){
  if(!url) return "";
  const u = String(url).trim();
  if(/^(https?:|data:image\/)/i.test(u)) return escapeHtml(u);
  return "";
}

/* ---------------------------------------------------------
   COMPRIMIR IMÁGENES ANTES DE SUBIRLAS
   Una foto de celular (3–5 MB, 4000px) queda en ~150–300 KB a 1200px,
   sin diferencia visible en el catálogo. Se hace en el navegador.
   - maxLado: lado más largo final en px
   - Si algo falla o no se gana espacio, se sube el archivo original
   --------------------------------------------------------- */
async function comprimirImagen(archivo, maxLado = 1200, calidad = 0.82){
  if(!archivo || !archivo.type || !archivo.type.startsWith("image/")) return archivo;
  if(archivo.type === "image/gif") return archivo;          // los GIF pueden ser animados

  try{
    const imagen = await new Promise((ok, mal) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error("No se pudo leer la imagen")); };
      img.src = url;
    });

    const escala = Math.min(1, maxLado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
    const alto  = Math.max(1, Math.round(imagen.naturalHeight * escala));

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    canvas.getContext("2d").drawImage(imagen, 0, 0, ancho, alto);

    // WebP: más liviano y conserva transparencia (logos). Si el navegador no lo soporta, JPEG.
    const aBlob = tipo => new Promise(ok => canvas.toBlob(ok, tipo, calidad));
    let blob = await aBlob("image/webp");
    if(!blob || blob.type !== "image/webp"){
      if(archivo.type === "image/png") return archivo;      // JPEG perdería la transparencia
      blob = await aBlob("image/jpeg");
    }
    if(!blob || blob.size >= archivo.size) return archivo;  // no ganó nada: se deja la original

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const base = (archivo.name || "foto").replace(/\.[^.]+$/, "");
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  }catch(err){
    console.warn("No se pudo comprimir, se sube la original:", err);
    return archivo;
  }
}
