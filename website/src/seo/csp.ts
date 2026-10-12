import { createHash } from "node:crypto";

/** The JSON-LD script bodies in a built page, in order. */
export function jsonLdBodies(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]);
}

/** CSP3 sha256 source hash of one script body, without the sha256- prefix. */
export function scriptHash(body: string): string {
  return createHash("sha256").update(body).digest("base64");
}

/** Home (index.html) and every other page, so each policy allows the scripts it serves. */
export function jsonLdHashes(files: readonly { path: string; html: string }[]): { home: string[]; pages: string[] } {
  const home = new Set<string>();
  const pages = new Set<string>();
  for (const file of files) {
    const target = file.path === "index.html" ? home : pages;
    for (const body of jsonLdBodies(file.html)) target.add(scriptHash(body));
  }
  return { home: [...home].sort(), pages: [...pages].sort() };
}

export function withScriptHashes(policy: string, hashes: readonly string[]): string {
  if (hashes.length === 0) return policy;
  const tokens = hashes.map((hash) => `'sha256-${hash}'`).join(" ");
  return policy.replace("script-src ", `script-src ${tokens} `);
}
