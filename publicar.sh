#!/bin/sh
# Comando de "build" de Cloudflare Pages: copia SOLO lo que la página necesita a dist/
# (deja fuera sql/, README, .vscode y demás archivos internos)
set -e
rm -rf dist
mkdir -p dist
cp *.html *.js *.css _headers dist/
cp -r img dist/
rm -f dist/publicar.sh
echo "Publicado: $(ls dist | wc -l) archivos + img/"
