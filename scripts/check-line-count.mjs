#!/usr/bin/env node
/**
 * 단일 파일 300줄 이하 달성 여부 점검.
 * server/ 및 src/ 내 .ts, .tsx, .js, .jsx, .mjs 파일을 검사하고,
 * 300줄 초과 파일 목록을 출력합니다.
 *
 * 사용: node scripts/check-line-count.mjs [--json] [dir]
 *   dir 기본값: server src (둘 다 검사)
 *   --json: JSON 배열로 출력 (파일경로, 줄수)
 */

import fs from "node:fs";
import path from "node:path";

const MAX_LINES = 300;
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ROOT = path.resolve(process.cwd());

function* walk(dir, base = "") {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "dist" || e.name === ".git") continue;
      yield* walk(path.join(dir, e.name), rel);
    } else if (EXTENSIONS.has(path.extname(e.name))) {
      yield path.join(dir, e.name);
    }
  }
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return content.split(/\r?\n/).length;
}

function main() {
  const args = process.argv.slice(2);
  const jsonOut = args.includes("--json");
  const dirs = args.filter((a) => a !== "--json");
  const targets = dirs.length ? dirs : ["server", "src"];

  const over = [];
  let totalFiles = 0;

  for (const dir of targets) {
    const absDir = path.isAbsolute(dir) ? dir : path.join(ROOT, dir);
    for (const file of walk(absDir)) {
      totalFiles++;
      const lines = countLines(file);
      if (lines > MAX_LINES) {
        const relative = path.relative(ROOT, file);
        over.push({ path: relative, lines });
      }
    }
  }

  over.sort((a, b) => b.lines - a.lines);

  if (jsonOut) {
    console.log(JSON.stringify(over, null, 0));
    process.exit(over.length > 0 ? 1 : 0);
  }

  console.log(`[check-line-count] Scanned ${totalFiles} files (max ${MAX_LINES} lines).`);
  if (over.length === 0) {
    console.log("All files within limit.");
    process.exit(0);
  }

  console.log(`\n${over.length} file(s) over ${MAX_LINES} lines:\n`);
  const table = over.map(({ path: p, lines }) => ({ path: p, lines }));
  const maxPath = Math.max(...table.map((r) => r.path.length), 10);
  for (const { path: p, lines } of table) {
    console.log(`  ${p.padEnd(maxPath)}  ${lines}`);
  }
  console.log("");
  process.exit(1);
}

main();
