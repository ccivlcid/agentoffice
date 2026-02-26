/**
 * Bundle server for Electron packaged app.
 * Output: dist-server/index.cjs (CommonJS) so require("node:...") in deps works.
 */
import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outFile = join(root, "dist-server", "index.cjs");

mkdirSync(dirname(outFile), { recursive: true });

const nodeBuiltins = [
  "node:assert", "node:buffer", "node:child_process", "node:crypto", "node:events",
  "node:fs", "node:http", "node:net", "node:path", "node:stream", "node:url", "node:util",
  "node:sqlite", "node:os",
];

await esbuild.build({
  entryPoints: [join(root, "server", "index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  outfile: outFile,
  external: nodeBuiltins,
  sourcemap: true,
  minify: false,
  // CJS에서는 __dirname 사용하므로 import.meta.url 분기는 실행되지 않음. 경고 제거용.
  define: { "import.meta.url": "undefined" },
});

console.log("[build-server] Wrote", outFile);
