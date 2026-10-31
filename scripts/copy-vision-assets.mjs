import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptsDirectory, "..");
const source = resolve(projectRoot, "assets");
const destination = resolve(projectRoot, "apps/desktop/out/renderer");

await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
console.log(`Copied vision assets to ${destination}`);
