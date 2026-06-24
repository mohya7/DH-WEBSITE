const fs = require("fs");

const raw = fs.readFileSync("index.html", "utf8");
const scripts = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
fs.writeFileSync("public/js/home-page.js", scripts.join("\n\n"));
console.log(`Wrote ${scripts.length} inline script blocks to public/js/home-page.js`);
