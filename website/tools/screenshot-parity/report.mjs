import fs from "node:fs";
import path from "node:path";

export function writeReport(outDir, { results, threshold, masks }) {
  fs.mkdirSync(outDir, { recursive: true });
  const failed = results.filter((result) => result.status === "differs" || result.status === "error");
  const matched = results.filter((result) => result.status === "match").length;
  const accepted = results.filter((result) => result.status === "accepted").length;

  const rows = results.map((result) => {
    const cls = result.status === "match" || result.status === "accepted" ? "ok" : "bad";
    const pixels = result.differentPixels == null ? "—" : String(result.differentPixels);
    const note = result.error ?? (result.sizeMismatch ? `size ${result.imageWidth}×${result.imageHeight} against ${result.otherWidth}×${result.otherHeight}` : "");
    return `<tr><td>${esc(result.old)}</td><td>${esc(result.new)}</td><td>${result.width}</td><td>${esc(result.browser)}</td><td class="${cls}">${esc(result.status)}</td><td>${pixels}</td><td>${esc(note)}</td></tr>`;
  }).join("");

  const blocks = failed.filter((result) => result.files).map((result) => `
    <section>
      <h2>${esc(result.browser)} · ${result.width}px · ${esc(result.old)}</h2>
      <p>${esc(result.status)}${result.differentPixels == null ? "" : ` · ${result.differentPixels} pixels`}${result.error ? ` · ${esc(result.error)}` : ""}</p>
      <div class="row">
        <figure><figcaption>Old</figcaption><img src="${esc(result.files.old)}" alt="Old capture"></figure>
        <figure><figcaption>New</figcaption><img src="${esc(result.files.new)}" alt="New capture"></figure>
        <figure><figcaption>Difference</figcaption>${result.files.diff ? `<img src="${esc(result.files.diff)}" alt="Difference">` : "<p>The two captures are different sizes, so there is no pixel diff.</p>"}</figure>
      </div>
    </section>`).join("");

  const maskList = masks.map((mask) => `<li><code>${esc(mask.selector)}</code> — ${esc(mask.reason)}</li>`).join("");

  const html = `<!doctype html>
<meta charset="utf-8">
<title>Screenshot parity</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; padding: 24px; background: #0d1117; color: #e6edf3; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p, li { color: #c9d1d9; }
  table { border-collapse: collapse; margin: 16px 0 28px; }
  th, td { text-align: left; padding: 4px 14px 4px 0; vertical-align: top; }
  th { color: #8b949e; font-weight: 600; }
  .ok { color: #3fb950; } .bad { color: #f85149; }
  .totals { font-size: 18px; }
  .row { display: flex; gap: 12px; align-items: flex-start; overflow-x: auto; }
  figure { margin: 0; }
  figcaption { color: #8b949e; margin-bottom: 4px; }
  img { max-width: 360px; height: auto; background: #fff; }
  code { color: #e6edf3; }
</style>
<body>
<h1>Screenshot parity</h1>
<p class="totals"><strong class="${failed.length === 0 ? "ok" : "bad"}">${matched} of ${results.length}</strong> match. ${failed.length} fail. ${accepted} accepted.</p>
<p>${esc(threshold.explanation)}</p>
<h2>Masks</h2>
<ul>${maskList}</ul>
<table>
<tr><th>Old</th><th>New</th><th>Width</th><th>Browser</th><th>Status</th><th>Pixels</th><th>Note</th></tr>
${rows}
</table>
${blocks || "<p>No failing captures.</p>"}
</body>`;

  const reportPath = path.join(outDir, "report.html");
  fs.writeFileSync(reportPath, html);
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify({ matched, accepted, failed: failed.length, results }, null, 2));
  return reportPath;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
