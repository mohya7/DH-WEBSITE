const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const gen = execSync("node scripts/gen-trust-logos.js", { cwd: root, encoding: "utf8" });
const file = path.join(root, "legacy/index.html");
let html = fs.readFileSync(file, "utf8");

const open = /<div class="trust-track">\r?\n/;
const start = html.search(open);
if (start === -1) throw new Error("trust-track not found");

const openMatch = html.match(open);
const contentStart = start + openMatch[0].length;

let end = html.indexOf("    </div>\r\n  </div>\r\n</section>", contentStart);
if (end === -1) end = html.indexOf("    </div>\n  </div>\n</section>", contentStart);
if (end === -1) throw new Error("trust-track end not found");

html = html.slice(0, contentStart) + gen + html.slice(end);
fs.writeFileSync(file, html);
console.log("Updated legacy/index.html trust logos");
