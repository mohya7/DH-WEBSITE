const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const originalDir = path.join(root, "legacy/assets/clients/original");

const clients = [
  { file: "elsewedy-electric.png", alt: "Elsewedy Electric", nudgeY: 6 },
  { file: "fab.png", alt: "FAB Misr" },
  { file: "mcit.png", alt: "Ministry of Communications and Information Technology", medium: true },
  { file: "abu-qir.png", alt: "Abu Qir Petroleum", large: true },
  { file: "banque-misr.png", alt: "Banque Misr" },
  { file: "bue.png", alt: "BUE" },
  { file: "capmas.png", alt: "CAPMAS" },
  { file: "cgc.png", alt: "Credit Guarantee Company" },
  { file: "edgepro.png", alt: "Edge-Pro" },
  { file: "egypt-post.png", alt: "Egypt Post" },
  { file: "isdb.png", alt: "Islamic Development Bank" },
  { file: "kandil-steel.png", alt: "Kandil Steel" },
  { file: "mansour-group.png", alt: "Mansour Group" },
  { file: "mped.png", alt: "Ministry of Planning and Economic Development", boost: true },
  { file: "nexta.png", alt: "Nexta", small: true },
  { file: "schindler.png", alt: "Schindler", large: true },
  { file: "takaful.png", alt: "Takaful", large: true },
  { file: "viatris.png", alt: "Viatris" },
];

function readPngSize(file) {
  const filePath = path.join(originalDir, file);
  const buf = fs.readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const aspectRatios = {};
for (const client of clients) {
  const { w, h } = readPngSize(client.file);
  aspectRatios[client.file] = w / h;
}

function logoHeight(client) {
  if (client.xl) return 99;
  if (client.boost) return 63;
  if (client.medium) return 60;
  if (client.large) return 56;
  if (client.small) return 36;
  return 48;
}

function logoWidth(client, h) {
  return Math.round(h * aspectRatios[client.file]);
}

function item(client, hidden) {
  const hiddenAttr = hidden ? ' aria-hidden="true"' : "";
  const altText = hidden ? "" : client.alt;
  let itemClass = "trust-item";
  if (client.large) itemClass += " trust-item--lg";
  if (client.small) itemClass += " trust-item--sm";
  if (client.medium) itemClass += " trust-item--md";
  if (client.boost) itemClass += " trust-item--boost";
  if (client.xl) itemClass += " trust-item--xl";
  const h = logoHeight(client);
  const w = logoWidth(client, h);
  const nudge = client.nudgeY ? ` style="--logo-nudge:${client.nudgeY}px"` : "";
  return `      <span class="${itemClass}"${nudge}${hiddenAttr}><img class="trust-item__logo" src="assets/clients/original/${client.file}" alt="${altText}" width="${w}" height="${h}" loading="lazy" decoding="async"></span>`;
}

const lines = [
  ...clients.map((c) => item(c, false)),
  ...clients.map((c) => item(c, true)),
];
process.stdout.write(lines.join("\n"));
