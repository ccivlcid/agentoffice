// @ts-nocheck
/**
 * Scan project rule files (.cursor/rules/*.mdc, CLAUDE.md, AGENTS.md).
 */

import fs from "node:fs";
import path from "node:path";

const MANAGED_MARKER = "<!-- managed-by: climpire-library -->";

export interface ScannedRule {
  name: string;
  title: string;
  description: string;
  content: string;
  category: string;
  globs: string[];
  alwaysApply: boolean;
  source: string;
}

function parseMdcFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val: unknown = line.slice(idx + 1).trim();
    if (val === "true") val = true;
    else if (val === "false") val = false;
    else if (typeof val === "string" && val.startsWith("[")) {
      try {
        val = JSON.parse(val);
      } catch {
        /* keep string */
      }
    }
    meta[key] = val;
  }
  return { meta, body: m[2].replace(MANAGED_MARKER, "").trim() };
}

export function scanProjectRules(): ScannedRule[] {
  const cwd = process.cwd();
  const results: ScannedRule[] = [];

  // 1. .cursor/rules/*.mdc
  const cursorDir = path.join(cwd, ".cursor", "rules");
  try {
    for (const f of fs.readdirSync(cursorDir)) {
      if (!f.endsWith(".mdc")) continue;
      const raw = fs.readFileSync(path.join(cursorDir, f), "utf-8");
      if (raw.includes(MANAGED_MARKER)) continue; // skip managed
      const { meta, body } = parseMdcFrontmatter(raw);
      const name = f.replace(/\.mdc$/, "");
      results.push({
        name,
        title: String(meta.description || name),
        description: String(meta.description || ""),
        content: body,
        category: "general",
        globs: Array.isArray(meta.globs) ? meta.globs : [],
        alwaysApply: meta.alwaysApply === true,
        source: `cursor:${f}`,
      });
    }
  } catch {
    /* dir may not exist */
  }

  // 2. CLAUDE.md
  scanSingleFile(cwd, "CLAUDE.md", "claude", results);
  // 3. AGENTS.md
  scanSingleFile(cwd, "AGENTS.md", "claude", results);

  return results;
}

function scanSingleFile(cwd: string, filename: string, src: string, out: ScannedRule[]): void {
  const fp = path.join(cwd, filename);
  try {
    if (!fs.existsSync(fp)) return;
    const raw = fs.readFileSync(fp, "utf-8");
    if (raw.includes(MANAGED_MARKER)) return;
    const name = filename.replace(/\.md$/, "").toLowerCase();
    out.push({
      name,
      title: filename,
      description: `Imported from ${filename}`,
      content: raw.slice(0, 8000), // limit size
      category: "general",
      globs: [],
      alwaysApply: true,
      source: `${src}:${filename}`,
    });
  } catch {
    /* ignore */
  }
}
