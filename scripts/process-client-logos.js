/**
 * Convert black-background client logos → white marks on transparent PNG.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SRC = path.join(__dirname, '../legacy/assets/clients');
const OUT = path.join(SRC, 'white');

const THRESHOLD = 14;
const GAMMA = 0.58;
const CONTRAST = 2.6;

async function processLogo(file) {
  const input = path.join(SRC, file);

  const { data, info } = await sharp(input)
    .trim({ threshold: 8 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.alloc(data.length);

  for (let i = 0; i < data.length; i += channels) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = Math.min(255, Math.pow(r / 255, GAMMA) * 255 * CONTRAST);
    g = Math.min(255, Math.pow(g / 255, GAMMA) * 255 * CONTRAST);
    b = Math.min(255, Math.pow(b / 255, GAMMA) * 255 * CONTRAST);

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    if (lum < THRESHOLD) {
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = 0;
    } else {
      const alpha = Math.min(255, Math.round(Math.pow((lum - THRESHOLD) / (255 - THRESHOLD), 0.75) * 255));
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = alpha;
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(path.join(OUT, file));

  console.log('  ✓', file);
}

async function main() {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

  const files = fs.readdirSync(SRC).filter((f) => {
    const full = path.join(SRC, f);
    return /\.png$/i.test(f) && fs.statSync(full).isFile();
  });

  console.log(`Processing ${files.length} logos → legacy/assets/clients/white/`);

  for (const file of files) {
    await processLogo(file);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
