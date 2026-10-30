#!/bin/sh
# Comando de "build" de Cloudflare Pages: copia SOLO lo que la página necesita a dist/
# (deja fuera sql/, README, .vscode y demás archivos internos)
# La carpeta functions/ NO se copia: Cloudflare la toma sola desde la raíz del repositorio.
set -e
rm -rf dist
mkdir -p dist
cp *.html *.js *.css _headers robots.txt dist/
# Íconos (pestaña del navegador, Google, iPhone/Android)
cp favicon.ico favicon.svg favicon-48.png icon-192.png icon-512.png apple-touch-icon.png site.webmanifest dist/
cp -r img dist/
rm -f dist/publicar.sh

# Cada publicación le pone una versión a los .css y .js propios (style.css?v=abc123):
# así ningún navegador (Brave, Safari…) mezcla el HTML nuevo con un estilo viejo guardado.
V=$(printf '%s' "${CF_PAGES_COMMIT_SHA:-$(date +%s)}" | cut -c1-8)
for h in dist/*.html; do
  sed -i -E "s#(href|src)=\"([A-Za-z0-9_-]+\.(css|js))\"#\1=\"\2?v=$V\"#g" "$h"
done

# _routes.json: el código del servidor (functions/) solo corre en las direcciones de tiendas,
# en "/" y en /sitemap.xml. Los archivos (css, js, imágenes) y las páginas del panel se
# entregan directo, sin gastar el límite diario gratis de Cloudflare.
{
  printf '{\n  "version": 1,\n  "include": ["/*"],\n  "exclude": [\n'
  primero=1
  for f in $(cd dist && ls -1 | grep -v '^_'); do
    if [ -d "dist/$f" ]; then rutas="/$f/*"; else rutas="/$f"; fi
    case "$f" in *.html) n="${f%.html}"; [ "$n" != "index" ] && rutas="$rutas /$n";; esac
    for r in $rutas; do
      [ $primero -eq 1 ] && primero=0 || printf ',\n'
      printf '    "%s"' "$r"
    done
  done
  printf '\n  ]\n}\n'
} > dist/_routes.json

echo "Publicado: $(ls dist | wc -l) archivos + img/ ($(grep -c '"/' dist/_routes.json) rutas sin servidor)"
