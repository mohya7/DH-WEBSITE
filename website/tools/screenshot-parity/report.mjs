import fs from "node:fs";
import path from "node:path";

/** How many of the least similar images the report lists. */
export const WORST_IMAGES = 10;

/** The least similar image pairs across all captures, worst first. Reported, never failed. */
export function worstImages(results, count = WORST_IMAGES) {
  return results
    .flatMap((result) => (result.scores ?? []).filter((score) => score.similarity !== null).map((score) => ({ ...score, old: result.old, width: result.width, browser: result.browser })))
    .sort((a, b) => a.similarity - b.similarity)
    .slice(0, count);
}

export function writeReport(outDir, { results, threshold, masks, register }) {
  fs.mkdirSync(outDir, { recursive: true });
  const count = (status) => results.filter((result) => result.status === status).length;
  const failed = results.filter((result) => !["match", "absent-accepted"].includes(result.status));
  const worst = worstImages(results);

  const rows = results.map((result) => {
    const cls = result.status === "match" || result.status === "absent-accepted" ? "ok" : "bad";
    const pixels = result.differentPixels == null ? "—" : String(result.differentPixels);
    const size = result.sizeMismatch ? `size ${result.imageWidth}×${result.imageHeight} against ${result.otherWidth}×${result.otherHeight}` : "";
    const note = [size, ...result.problems, ...result.notes].filter(Boolean).join("; ");
    return `<tr><td>${esc(result.old)}</td><td>${esc(result.new)}</td><td>${result.width}</td><td>${esc(result.browser)}</td><td class="${cls}">${esc(result.status)}</td><td>${pixels}</td><td>${esc(result.register.join(", "))}</td><td>${esc(note)}</td></tr>`;
  }).join("");

  const blocks = failed.filter((result) => result.files).map((result) => `
    <section>
      <h2>${esc(result.browser)} · ${result.width}px · ${esc(result.old)}</h2>
      <p>${esc(result.status)}${result.differentPixels == null ? "" : ` · ${result.differentPixels} pixels`}</p>
      ${result.problems.length ? `<ul>${result.problems.map((problem) => `<li>${esc(problem)}</li>`).join("")}</ul>` : ""}
      <div class="row">
        <figure><figcaption>Old</figcaption><img src="${esc(result.files.old)}" alt="Old capture"></figure>
        <figure><figcaption>New</figcaption><img src="${esc(result.files.new)}" alt="New capture"></figure>
        <figure><figcaption>Difference</figcaption>${result.files.diff ? `<img src="${esc(result.files.diff)}" alt="Difference">` : "<p>The two captures are different sizes, so there is no pixel diff.</p>"}</figure>
      </div>
    </section>`).join("");

  const maskList = masks.map((mask) => `<li><code>${esc(mask.selector)}</code> — ${esc(mask.reason)}</li>`).join("");
  const registerList = register.differences.length === 0
    ? "<p>No register entries.</p>"
    : `<ul>${register.differences.map((entry) => `<li><code>${esc(entry.id)}</code>: hides <code>${esc(entry.selectors.join(", "))}</code> — ${esc(entry.reason)}</li>`).join("")}</ul>`;
  const worstRows = worst.map((score) => `<tr><td>${score.similarity.toFixed(4)}</td><td>${esc(score.old)}</td><td>${score.width}</td><td>${esc(score.browser)}</td><td>${score.index} ${esc(score.element)}</td><td>${esc(score.oldSrc)}</td><td>${esc(score.newSrc)}</td></tr>`).join("");

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
<p class="totals"><strong class="${failed.length === 0 ? "ok" : "bad"}">${count("match")} of ${results.length}</strong> match. ${count("absent-accepted")} absent and accepted. ${count("differs")} differ, ${count("unstable")} unstable, ${count("error")} errors.</p>
<p>${esc(threshold.explanation)}</p>
<h2>Masks</h2>
<ul>${maskList}</ul>
<h2>Register entries</h2>
${registerList}
<h2>Least similar images (reported, not failed)</h2>
<p>Image pixels are flattened before the diff, because the media pipeline re-encodes them. Each image is also scaled to 32×32 on both sides and compared: 1 is identical. A wrong image shows up here.</p>
<table><tr><th>Similarity</th><th>Page</th><th>Width</th><th>Browser</th><th>Image</th><th>Old source</th><th>New source</th></tr>${worstRows}</table>
<table>
<tr><th>Old</th><th>New</th><th>Width</th><th>Browser</th><th>Status</th><th>Pixels</th><th>Register</th><th>Problems and notes</th></tr>
${rows}
</table>
${blocks || "<p>No failing captures.</p>"}
</body>`;

  const reportPath = path.join(outDir, "report.html");
  fs.writeFileSync(reportPath, html);
  const summary = { matched: count("match"), absentAccepted: count("absent-accepted"), differs: count("differs"), unstable: count("unstable"), errors: count("error"), worstImages: worst, results: results.map(({ scores, ...rest }) => rest) };
  fs.writeFileSync(path.join(outDir, "results.json"), JSON.stringify(summary, null, 2));
  return reportPath;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
