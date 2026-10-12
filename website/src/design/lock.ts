/*
 * The locked design set: one record of every ported file and the source hash
 * website/scripts/design-sources.ts checks. The website design check and the
 * Studio build both use lockedDesignProblems, so a changed, deleted, or added
 * file fails either build and the message names the file.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { designFileList, designSourceDir } from "./folder.ts";

export type DesignSource =
  | { file: string }
  | { page: string; style: number }
  | { page: string; script: number };

export interface DesignFile {
  /** Path inside website/design/, mirroring the source layout. */
  dest: string;
  from: DesignSource;
  /** SHA-256 of the source bytes on feature/interviewer-portal at eb05f064. */
  sourceSha256: string;
  change?: { line: number; before: string; after: string; reason: string };
}

export const designFiles: DesignFile[] = [
  { dest: "css/about-page.css", from: { file: "css/about-page.css" }, sourceSha256: "ac09553e7c31f58346ec25afc86f61ba520f510f693d03e979cdb90df4369c03" },
  { dest: "css/careers-page.css", from: { file: "css/careers-page.css" }, sourceSha256: "26a62fba8533acd4faadd8fd33e0866b4e688f1da353fa34561e78e7473d71df" },
  { dest: "css/hub-pages.css", from: { file: "css/hub-pages.css" }, sourceSha256: "881cc633c3e8410ca7c1e6d003ebc021e3a642228cb83a98c17b25f4e427367d" },
  { dest: "css/responsive.css", from: { file: "css/responsive.css" }, sourceSha256: "123997876c5c939d1f6c41d0851eb2fce9e87570fa2bb7cc68717bb703718f06" },
  { dest: "css/service-page.css", from: { file: "css/service-page.css" }, sourceSha256: "53d9eed5f6813a5f2c9729ff4d6aea4735c5cc7d8fca5b29394883369a9f0e83" },
  { dest: "css/shared.css", from: { file: "css/shared.css" }, sourceSha256: "ace9983cbce214d60096754dd560d8b7fe59b757200cf97191a9697a93f53a47" },
  { dest: "css/tv.css", from: { file: "css/tv.css" }, sourceSha256: "301f869ad918c2bdb4bfb1170da4b9333caab7c160b6f01cc53ea630b59ffcd7" },
  { dest: "index.inline.css", from: { page: "index.html", style: 1 }, sourceSha256: "fe9c34b90fbf1dec08b3fc08c67dfa5051104916e30fe239ac5e06e3fd132421" },
  { dest: "get-in-touch.inline.css", from: { page: "get-in-touch.html", style: 1 }, sourceSha256: "7c9e59a23146f54ab4c94f7611bd03efeaef915ba1a59819e6145a8c150834ea" },
  { dest: "assets/careers/apply-now.svg", from: { file: "assets/careers/apply-now.svg" }, sourceSha256: "76e20114689e8e8a201c573044255fe821d36a5663f621a81ede44971857d574" },
  { dest: "assets/careers/hero.webp", from: { file: "assets/careers/hero.webp" }, sourceSha256: "8e901f6f85744e6cf77d970a2aeb5bd8015d9f143acf7f3f63bb769fb19cbe25" },
  { dest: "js/shared.js", from: { file: "js/shared.js" }, sourceSha256: "1e06a346b3f6f74bf5be5c9be0a393956460fc77560fd283bc02917c557ddece" },
  { dest: "js/nav-stay-on-page.js", from: { file: "js/nav-stay-on-page.js" }, sourceSha256: "363dccceebac9347aa1abfcc6d1290d28f1dd9bb1147a5216114d7fc13179e04" },
  { dest: "js/hub-pages.js", from: { file: "js/hub-pages.js" }, sourceSha256: "b09a0c7338468b59f9c565b0904a750de57f62402e00db47d7b4459b93c7097f" },
  { dest: "js/about-page.js", from: { file: "js/about-page.js" }, sourceSha256: "78a17b61b2157248f0d8a2c5db581877aabd0e4c4050063f2b1771b27a1240cb" },
  { dest: "js/service-page.js", from: { file: "js/service-page.js" }, sourceSha256: "7a8fa7b9156ebbcececfcf0a09cc91e461c3dfe3e328cfeac728dbddebc3a18d" },
  { dest: "js/careers-apply.js", from: { file: "js/careers-apply.js" }, sourceSha256: "6c4840eafe407cbb2084289343296e0c89970f4dc65e220e6e2e7d6df66c9e59" },
  { dest: "js/webgl-fluid-lib.js", from: { file: "js/webgl-fluid-lib.js" }, sourceSha256: "027c72aa44b3eea2b36308fb9a9ab95785f07f02faf5043cb3e833599d6a33b3" },
  {
    dest: "js/hero-fluid.js",
    from: { file: "js/hero-fluid.js" },
    sourceSha256: "36e1e57c754537e63fd96f6329620615ed921a583c123180df9d0def26f7ffc7",
    change: {
      line: 7,
      before: 'import WebGLFluid from "./webgl-fluid-lib.js?v=26";',
      after: 'import WebGLFluid from "./webgl-fluid-lib.js";',
      reason: "No ?v= query strings anywhere (Section 2.6). The design folder is content-hashed instead.",
    },
  },
  { dest: "index.inline-1.js", from: { page: "index.html", script: 1 }, sourceSha256: "71f75819a7efe0ac2646704e088e69b345f01c8b19fcfd5c475ddd90eb2d2e87" },
  { dest: "index.inline-2.js", from: { page: "index.html", script: 2 }, sourceSha256: "34ffe53e5e4463e16375a5c7ce12d9378362885f6bcad375556529dd4ea5e2b9" },
  { dest: "index.inline-3.js", from: { page: "index.html", script: 3 }, sourceSha256: "4f1937dd027e8aa00a86a7a20e4f1d43df0c34cfc98d1d3d038b64ada8ad7bb4" },
  { dest: "index.inline-4.js", from: { page: "index.html", script: 4 }, sourceSha256: "25e5bcaa6ac2342db2eef3238cb0b443455b9f95e8abd85771afd2636a0cbcfc" },
  { dest: "index.inline-5.js", from: { page: "index.html", script: 5 }, sourceSha256: "b9a30aae1ba2368ea454f942b0f66b756673ee632361e62c66f23771d0764284" },
  { dest: "index.inline-6.js", from: { page: "index.html", script: 6 }, sourceSha256: "f3f460eb0bc30ed1f6d0ec12ee29c78f1c043b50d06f9577886aad49bdd0a609" },
];

export function sha256(data: Buffer | string): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/** Names every file that is not the locked design set. */
export function lockedDesignProblems(dir: string = designSourceDir): string[] {
  const problems: string[] = [];
  const present = new Set(fs.existsSync(dir) ? designFileList(dir) : []);
  for (const file of designFiles) {
    present.delete(file.dest);
    const destPath = path.join(dir, ...file.dest.split("/"));
    if (!fs.existsSync(destPath)) {
      problems.push(`missing: ${file.dest}`);
      continue;
    }
    const bytes = fs.readFileSync(destPath);
    const comparable = file.change ? undoRecordedChange(file.change, bytes) : bytes;
    if (sha256(comparable) !== file.sourceSha256) problems.push(`differs: ${file.dest}`);
  }
  for (const name of [...present].sort()) problems.push(`extra: ${name}`);
  return problems;
}

function undoRecordedChange(change: { line: number; before: string; after: string }, bytes: Buffer): Buffer {
  const lines = bytes.toString("utf8").split("\n");
  const index = change.line - 1;
  if (lines[index] === change.after) lines[index] = change.before;
  return Buffer.from(lines.join("\n"), "utf8");
}
