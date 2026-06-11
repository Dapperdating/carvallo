#!/bin/sh
set -eu

rm -rf public
mkdir -p public/data public/admin public/assets

cp index.html auto.html admin.html privacy.html termini.html cookie.html styles.css script.js admin.js config.js favicon.png robots.txt sitemap.xml public/
cp data/cars.js public/data/cars.js
cp admin/index.html public/admin/index.html
cp -R assets/logos public/assets/logos
cp -R assets/fonts public/assets/fonts
cp -R assets/cars public/assets/cars
