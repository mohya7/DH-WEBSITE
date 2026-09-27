'use strict';

/**
 * Generates the dot-matrix EMEA map used by the About Us hero.
 *
 * Output:
 *   assets/about/emea-dots.svg  — every land dot (served as a static <img>)
 *   stdout                      — the Egypt / Saudi Arabia dot paths and the
 *                                 Cairo / KSA anchor points to paste into the
 *                                 inline overlay in about-us.html
 *
 * Both layers share one viewBox, so the inline overlay lines up exactly with
 * the image underneath it.
 *
 * Data: Natural Earth 1:50m via world-atlas. Not a runtime dependency, so it is
 * not in package.json. Install it for a one-off run:
 *   npm i --no-save world-atlas@2 topojson-client@3
 *   node scripts/gen-emea-map.js
 */

const fs = require('fs');
const path = require('path');
const { feature } = require('topojson-client');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'assets', 'about', 'emea-dots.svg');

// Crop: Iberia/West Africa to Iran, Scandinavia to the Cape.
const LON_MIN = -20;
const LON_MAX = 62;
const LAT_MIN = -36;
const LAT_MAX = 63;
// Equirectangular with a 30° standard parallel keeps Egypt/KSA close to true shape.
const X_SCALE = Math.cos((30 * Math.PI) / 180);
const STEP_DEG = 1.5; // grid pitch in degrees of latitude
const UNIT = 10; // viewBox units per grid step, so every dot lands on an integer

const EGYPT_ID = '818';
const KSA_ID = '682';
const CAIRO = [31.24, 30.04];
const KSA_CENTROID = [44.6, 23.9]; // country-level marker, not a city claim

const project = ([lon, lat]) => [
  ((lon - LON_MIN) * X_SCALE / STEP_DEG) * UNIT,
  ((LAT_MAX - lat) / STEP_DEG) * UNIT,
];

const WIDTH = Math.round(project([LON_MAX, LAT_MIN])[0]);
const HEIGHT = Math.round(project([LON_MAX, LAT_MIN])[1]);

function rings(geometry) {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat();
  return [];
}

// Even-odd ray cast across every ring, so holes (lakes, enclaves) fall out.
function contains(ringList, lon, lat) {
  let inside = false;
  for (const ring of ringList) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

// Row-major relative path: "M x y h0" then "m dx dy h0" — round caps draw the dots.
function dotPath(points) {
  if (!points.length) return '';
  let out = '';
  let px = 0;
  let py = 0;
  points.forEach(([x, y], index) => {
    out += index === 0 ? `M${x} ${y}h0` : `m${x - px} ${y - py}h0`;
    px = x;
    py = y;
  });
  return out;
}

function main() {
  const land = require('world-atlas/land-50m.json');
  const countries = require('world-atlas/countries-50m.json');

  const landRings = rings(feature(land, land.objects.land).features[0].geometry);
  const countryFeatures = feature(countries, countries.objects.countries).features;
  const egyptRings = rings(countryFeatures.find((f) => f.id === EGYPT_ID).geometry);
  const ksaRings = rings(countryFeatures.find((f) => f.id === KSA_ID).geometry);

  const base = [];
  const egypt = [];
  const ksa = [];
  const cols = Math.floor(WIDTH / UNIT);
  const rows = Math.floor(HEIGHT / UNIT);

  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) {
      const x = col * UNIT;
      const y = row * UNIT;
      const lon = LON_MIN + (col * STEP_DEG) / X_SCALE;
      const lat = LAT_MAX - row * STEP_DEG;
      if (contains(egyptRings, lon, lat)) egypt.push([x, y]);
      else if (contains(ksaRings, lon, lat)) ksa.push([x, y]);
      else if (contains(landRings, lon, lat)) base.push([x, y]);
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">`,
    `<path d="${dotPath(base)}" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/>`,
    '</svg>',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, svg);

  const round = ([x, y]) => [Math.round(x), Math.round(y)];
  console.log(JSON.stringify({
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    counts: { base: base.length, egypt: egypt.length, ksa: ksa.length },
    bytes: Buffer.byteLength(svg),
    cairo: round(project(CAIRO)),
    ksa: round(project(KSA_CENTROID)),
    egyptPath: dotPath(egypt),
    ksaPath: dotPath(ksa),
  }, null, 2));
}

main();
