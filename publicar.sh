#!/bin/sh
# Comando de "build" de Cloudflare Pages: copia SOLO lo que la página necesita a dist/
# (deja fuera sql/, README, .vscode y demás archivos internos)
# La carpeta functions/ NO se copia: Cloudflare la toma sola desde la raíz del repositorio.
set -e
rm -rf dist
mkdir -p dist
cp *.html *.js *.css _headers robots.txt dist/
cp -r img dist/
rm -f dist/publicar.sh

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
