import fs from "node:fs";
import { e2eEnv } from "./env";

export default async function globalSetup() {
  const { mediaRoot } = e2eEnv();
  fs.rmSync(mediaRoot, { recursive: true, force: true });
  fs.mkdirSync(mediaRoot, { recursive: true });
}