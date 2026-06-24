const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const legacyRoot = path.join(root, "legacy/assets/clients");
const legacyOriginal = path.join(legacyRoot, "original");
const publicRoot = path.join(root, "public/assets/clients");
const publicOriginal = path.join(publicRoot, "original");

/** Uploaded filename → canonical lowercase filename on site */
const ROOT_TO_CANONICAL = {
  "19.png": "mcit.png",
  "mcit.png": "mcit.png",
  "abukir.png": "abu-qir.png",
  "abu-qir.png": "abu-qir.png",
  "banque-misr.png": "banque-misr.png",
  "bue.png": "bue.png",
  "capmas.png": "capmas.png",
  "cgc.png": "cgc.png",
  "edgepro.png": "edgepro.png",
  "egypt-post.png": "egypt-post.png",
  "elsewedy-electric.png": "elsewedy-electric.png",
  "errada.png": "erada.png",
  "erada.png": "erada.png",
  "fab.png": "fab.png",
  "isdb.png": "isdb.png",
  "kandil-steel.png": "kandil-steel.png",
  "mansour-group.png": "mansour-group.png",
  "mped.png": "mped.png",
  "nexta.png": "nexta.png",
  "nppa.png": "nppa.png",
  "schindler.png": "schindler.png",
  "takaful.png": "takaful.png",
  "viatris.png": "viatris.png",
};

const CANONICAL_ORDER = [
  "mcit.png",
  "abu-qir.png",
  "banque-misr.png",
  "bue.png",
  "capmas.png",
  "cgc.png",
  "edgepro.png",
  "egypt-post.png",
  "elsewedy-electric.png",
  "erada.png",
  "fab.png",
  "isdb.png",
  "kandil-steel.png",
  "mansour-group.png",
  "mped.png",
  "nexta.png",
  "schindler.png",
  "takaful.png",
  "viatris.png",
];

/** User-uploaded PascalCase names → normalize to lowercase canonical */
const CASE_RENAMES = [
  ["MCIT.png", "mcit.png"],
  ["MPED.png", "mped.png"],
  ["Schindler.png", "schindler.png"],
  ["Errada.png", "erada.png"],
  ["Takaful.png", "takaful.png"],
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function renameCaseOnly(dir, from, to) {
  const fromPath = path.join(dir, from);
  const toPath = path.join(dir, to);
  if (!fs.existsSync(fromPath) || from === to) return;
  if (fs.existsSync(toPath) && from.toLowerCase() === to.toLowerCase()) {
    const temp = path.join(dir, `__tmp_${to}`);
    fs.renameSync(fromPath, temp);
    fs.renameSync(temp, toPath);
    return;
  }
  fs.renameSync(fromPath, toPath);
}

function normalizeUploadNames(dir) {
  if (!fs.existsSync(dir)) return;
  for (const [from, to] of CASE_RENAMES) {
    renameCaseOnly(dir, from, to);
  }
}

function collectSources() {
  const map = new Map();
  const dirs = [legacyOriginal, legacyRoot];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    for (const file of fs.readdirSync(dir)) {
      if (!/\.png$/i.test(file) || file.includes(" (") || file.startsWith("__tmp_")) continue;
      const full = path.join(dir, file);
      if (!fs.statSync(full).isFile()) continue;

      const canonical = ROOT_TO_CANONICAL[file.toLowerCase()];
      if (!canonical) continue;

      const existing = map.get(canonical);
      if (!existing || fs.statSync(full).mtimeMs > fs.statSync(existing).mtimeMs) {
        map.set(canonical, full);
      }
    }
  }

  return map;
}

function readPngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function trimLogos(dir) {
  if (!fs.existsSync(dir)) return;
  const escaped = dir.replace(/'/g, "''");
  const ps = `
Add-Type -AssemblyName System.Drawing
function Trim-Png($path) {
  $img = [System.Drawing.Bitmap]::FromFile($path)
  $w = $img.Width; $h = $img.Height
  $minX = $w; $minY = $h; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
      $c = $img.GetPixel($x, $y)
      if ($c.A -gt 20 -and ($c.R + $c.G + $c.B) -gt 40) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt $minX) { $img.Dispose(); return }
  $pad = 2
  $minX = [Math]::Max(0, $minX - $pad)
  $minY = [Math]::Max(0, $minY - $pad)
  $maxX = [Math]::Min($w - 1, $maxX + $pad)
  $maxY = [Math]::Min($h - 1, $maxY + $pad)
  $cw = $maxX - $minX + 1
  $ch = $maxY - $minY + 1
  $crop = New-Object System.Drawing.Bitmap $cw, $ch
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $src = New-Object System.Drawing.Rectangle $minX, $minY, $cw, $ch
  $dst = New-Object System.Drawing.Rectangle 0, 0, $cw, $ch
  $g.DrawImage($img, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose(); $img.Dispose()
  $tmp = "$path.__trim.png"
  $crop.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
  Move-Item -Force $tmp $path
}
Get-ChildItem '${escaped}' -Filter *.png | ForEach-Object { Trim-Png $_.FullName }
`;
  execFileSync("powershell", ["-NoProfile", "-Command", ps], { stdio: "pipe" });
}

function writeOriginalSet(sources, outDir) {
  ensureDir(outDir);
  const written = [];

  for (const canonical of CANONICAL_ORDER) {
    const src = sources.get(canonical);
    if (!src) continue;
    fs.copyFileSync(src, path.join(outDir, canonical));
    written.push(canonical);
  }

  for (const file of fs.readdirSync(outDir)) {
    if (!/\.png$/i.test(file) || file.startsWith("__tmp_")) continue;
    const lower = file.toLowerCase();
    if (!CANONICAL_ORDER.includes(lower)) {
      fs.unlinkSync(path.join(outDir, file));
    }
  }

  return written;
}

function copyRootUploads(outDir) {
  ensureDir(outDir);
  if (!fs.existsSync(legacyRoot)) return;

  for (const file of fs.readdirSync(legacyRoot)) {
    const full = path.join(legacyRoot, file);
    if (!/\.png$/i.test(file) || !fs.statSync(full).isFile()) continue;
    fs.copyFileSync(full, path.join(outDir, file));
  }
}

function main() {
  normalizeUploadNames(legacyOriginal);

  const sources = collectSources();
  const legacyWritten = writeOriginalSet(sources, legacyOriginal);
  const publicWritten = writeOriginalSet(sources, publicOriginal);
  trimLogos(legacyOriginal);
  trimLogos(publicOriginal);
  copyRootUploads(publicRoot);

  console.log(`Synced ${legacyWritten.length} original logos (trimmed)`);
  console.log(legacyWritten.join(", "));

  const missing = CANONICAL_ORDER.filter((name) => !sources.has(name));
  if (missing.length) console.log("not found:", missing.join(", "));
}

main();
