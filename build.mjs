// Assemble the deployable static bundle in site/ from the repository's runtime assets.
//
// Framepick is a no-transpile static app, so "building" is just gathering the files a browser
// actually loads (index.html + its styles, source modules, and the vendored demuxer) into one
// directory. The publish step deploys site/ verbatim, which keeps the test suite, docs, and dev
// config out of the public bundle. Run it with `node build.mjs`.

import { cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, "site");

// Everything the running page references, and nothing else.
const RUNTIME = ["index.html", "styles", "src", "vendor"];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const entry of RUNTIME) {
  cpSync(join(root, entry), join(out, entry), { recursive: true });
}

console.log(`built site/ from ${RUNTIME.join(", ")}`);
