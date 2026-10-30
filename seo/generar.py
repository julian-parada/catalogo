#!/usr/bin/env python3
"""Genera las páginas por búsqueda (pagina-web-para-mi-tienda.html, tienda-online-ocana.html…)
con el mismo diseño y las mismas secciones compartidas de inicio.html.

Uso (desde la carpeta del proyecto):  python3 seo/generar.py
Escribe los .html en la raíz y funciones-lib/paginas-seo.js (lista para el sitemap y las rutas).
"""
import html, json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from paginas import PAGINAS

ORIGEN = "https://exhibepro.pages.dev"
e = lambda s: html.escape(str(s), quote=True)

base = open(os.path.join(RAIZ, "inicio.html"), encoding="utf-8").read()

def entre(a, b):
    i = base.index(a); j = base.index(b, i)
    return base[i:j]

ICONO_WA = re.search(r'<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">.*?</svg>', base, re.S).group(0)
FAVICONS = re.search(r'  <link rel="icon" href="/favicon.ico".*?<link rel="manifest" href="/site.webmanifest">\n', base, re.S).group(0)
BARRA = entre('  <a class="saltar"', '  <main id="contenido">')
BARRA = BARRA.replace('<a href="#funciones">Funciones</a>', '<a href="/">Exhibe Pro</a>').replace('href="/" aria-label="Exhibe Pro, inicio"', 'href="/" aria-label="Exhibe Pro, página principal"')
COMO = entre('    <!-- ============ CÓMO LLEGA UN PEDIDO ============ -->', '    <!-- ============ FUNCIONES ============ -->')
PRECIO = entre('    <!-- ============ PRECIO ============ -->', '    <!-- ============ PREGUNTAS ============ -->')
CIERRE = base[base.index('    <!-- ============ CIERRE ============ -->'):]
CIERRE = CIERRE.replace('</main>', '</main>', 1)

IMG_ALT = {
  "tienda-rosa": "Catálogo de una tienda de ropa hecho con Exhibe Pro, visto en el celular",
  "tienda-noche_dorada": "Catálogo virtual con colores negro y dorado, visto en el celular",
  "tienda-grafito_lima": "Tienda en línea con colores grafito y lima, vista en el celular",
  "tienda-cielo_limpio": "Tienda online con colores claros y azul, vista en el celular",
  "tienda-durazno_fresco": "Catálogo en línea con colores durazno, visto en el celular",
  "tienda-perla_oro": "Catálogo elegante con colores perla, visto en el celular",
  "pedido": "Resumen de un pedido que llega a la tienda por WhatsApp",
  "ficha": "Ficha de una prenda con fotos, precio y tallas",
  "compartir": "Opciones para compartir un producto por WhatsApp, Facebook e historias",
}

def pagina(p):
    url = f"{ORIGEN}/{p['slug']}"
    otras = [q for q in PAGINAS if q["slug"] != p["slug"]]
    ciudad = p.get("ciudad")

    datos = {
      "@context": "https://schema.org",
      "@graph": [
        {"@type": "WebPage", "@id": url + "#pagina", "url": url, "name": p["titulo"], "description": p["descripcion"],
         "inLanguage": "es-CO", "isPartOf": {"@id": ORIGEN + "/#web"}, "about": {"@id": ORIGEN + "/#org"},
         "primaryImageOfPage": f"{ORIGEN}/img/exhibe/og.jpg"},
        {"@type": "BreadcrumbList", "itemListElement": [
          {"@type": "ListItem", "position": 1, "name": "Exhibe Pro", "item": ORIGEN + "/"},
          {"@type": "ListItem", "position": 2, "name": p["corto"], "item": url}]},
        {"@type": "Service", "name": p["corto"], "serviceType": "Página web y catálogo en línea para tiendas",
         "provider": {"@type": "Organization", "@id": ORIGEN + "/#org", "name": "Exhibe Pro", "url": ORIGEN + "/", "logo": ORIGEN + "/icon-512.png"},
         "areaServed": ({"@type": "City", "name": ciudad} if ciudad else {"@type": "Country", "name": "Colombia"}),
         "offers": {"@type": "Offer", "price": "39900", "priceCurrency": "COP", "description": "15 días gratis. Después, $39.900 al mes. Sin permanencia."}},
        {"@type": "FAQPage", "mainEntity": [
          {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": r}} for q, r in p["faq"]]},
      ]
    }
    ld = json.dumps(datos, ensure_ascii=False, indent=2).replace("</", "<\\/")

    problemas = "\n".join(f'          <li><b>{e(t)}</b>{e(d)}</li>' for t, d in p["problemas"])
    lista = "\n".join(f'              <li>{e(x)}</li>' for x in p["beneficio_lista"])
    faq = "\n".join(f'''          <details>
            <summary>{e(q)}</summary>
            <p>{e(r)}</p>
          </details>''' for q, r in p["faq"])
    enlaces = "\n".join(f'          <li><a href="/{q["slug"]}">{e(q["corto"])}</a></li>' for q in otras)
    img = p["imagen"]
    img2 = "tienda-noche_dorada" if img == "tienda-cielo_limpio" else "tienda-cielo_limpio"

    return f'''<!DOCTYPE html>
<html lang="es-CO">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(p["titulo"])}</title>
  <meta name="description" content="{e(p["descripcion"])}">
  <link rel="canonical" href="{url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#1b1446">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Exhibe Pro">
  <meta property="og:locale" content="es_CO">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{e(p["titulo"])}">
  <meta property="og:description" content="{e(p["descripcion"])}">
  <meta property="og:image" content="{ORIGEN}/img/exhibe/og.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{ORIGEN}/img/exhibe/og.jpg">

{FAVICONS}  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&display=swap">
  <link rel="stylesheet" href="inicio.css">
  <!-- Generada con seo/generar.py: edita seo/paginas.py y vuelve a generarla -->
  <script type="application/ld+json">
{ld}
  </script>
</head>
<body>
{BARRA}  <main id="contenido">
    <section class="portada">
      <div class="envoltura portada-in">
        <div class="portada-texto">
          <nav class="migas" aria-label="Ubicación"><a href="/">Exhibe Pro</a><span aria-hidden="true">/</span><span>{e(p["corto"])}</span></nav>
          <p class="sello"><span class="sello-punto" aria-hidden="true"></span>{e(p["sello"])}</p>
          <h1>{e(p["h1"])}</h1>
          <p class="portada-sub">{e(p["sub"])}</p>
          <div class="acciones">
            <a class="btn btn-wa" data-wa="portada" href="https://api.whatsapp.com/send?phone=573247348475" target="_blank" rel="noopener">
              {ICONO_WA}
              Quiero mis 15 días gratis
            </a>
            <a class="btn btn-linea" href="/lookshop" target="_blank" rel="noopener">Ver una tienda de ejemplo</a>
          </div>
          <p class="portada-nota">15 días gratis, después $39.900 al mes. Sin comisiones por venta y sin permanencia.</p>
        </div>
        <div class="escena">
          <div class="telefono telefono-grande">
            <img src="img/exhibe/{img}.webp" width="640" height="1385" alt="{e(IMG_ALT.get(img, p["corto"]))}" fetchpriority="high">
          </div>
        </div>
      </div>
    </section>

    <section class="seccion seccion-funciones" aria-labelledby="problemas-t">
      <div class="envoltura">
        <div class="cabeza"><h2 id="problemas-t">{e(p["problemas_t"])}</h2></div>
        <ul class="extras extras-sola">
{problemas}
        </ul>
      </div>
    </section>

{COMO}
    <section class="seccion seccion-funciones" aria-labelledby="beneficio-t">
      <div class="envoltura">
        <article class="fila fila-sola">
          <div class="fila-texto">
            <h2 id="beneficio-t" class="fila-h2">{e(p["beneficio_t"])}</h2>
            <p>{e(p["beneficio"])}</p>
            <ul class="lista-check">
{lista}
            </ul>
          </div>
          <div class="fila-media">
            <div class="telefono"><img src="img/exhibe/{img2}.webp" width="640" height="1385" loading="lazy" alt="{e(IMG_ALT[img2])}"></div>
          </div>
        </article>
      </div>
    </section>

{PRECIO}
    <section class="seccion" id="preguntas" aria-labelledby="preguntas-t">
      <div class="envoltura envoltura-angosta">
        <div class="cabeza"><h2 id="preguntas-t">Preguntas frecuentes</h2></div>
        <div class="faq">
{faq}
        </div>
      </div>
    </section>

    <section class="seccion seccion-enlaces" aria-labelledby="enlaces-t">
      <div class="envoltura">
        <h2 id="enlaces-t" class="enlaces-t">También te puede interesar</h2>
        <ul class="enlaces">
          <li><a href="/">Exhibe Pro: página web para almacenes</a></li>
{enlaces}
        </ul>
      </div>
    </section>

{CIERRE}'''

def main():
    for p in PAGINAS:
        ruta = os.path.join(RAIZ, p["slug"] + ".html")
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(pagina(p))
        print("✓", p["slug"] + ".html")
    with open(os.path.join(RAIZ, "funciones-lib", "paginas-seo.js"), "w", encoding="utf-8") as f:
        f.write("// Generado por seo/generar.py: páginas de búsqueda (sitemap y rutas reservadas)\n")
        f.write("export const PAGINAS_SEO = " + json.dumps([p["slug"] for p in PAGINAS], ensure_ascii=False, indent=2) + ";\n")
    print("✓ funciones-lib/paginas-seo.js")

if __name__ == "__main__":
    main()
