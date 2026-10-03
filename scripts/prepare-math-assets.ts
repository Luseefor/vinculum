import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = resolve(root, "apps/graph/public/mathlive/fonts");
await mkdir(destination, { recursive: true });
await cp(resolve(root, "apps/graph/node_modules/mathlive/fonts"), destination, { recursive: true });
console.log("Prepared local math editor fonts.");
