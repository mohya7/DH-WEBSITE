/*
 * npm run prepare:design — runs before `next build` and `next dev`.
 *
 * Copies website/design/ to public/design/<hash>/, byte for byte, with its
 * layout unchanged. The hash covers every file, so a changed file gives a new
 * folder and the old one is never served stale.
 */
import { publishDesign } from "../src/design/folder";

const { hash, files } = publishDesign();
console.log(`Design: ${files} files copied to public/design/${hash}/`);
