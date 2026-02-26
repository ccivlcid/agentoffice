#!/usr/bin/env node

/**
 * HyperClaw setup script
 *
 * Prepends CEO directive + orchestration rules to the user's AGENTS.md.
 * This is an UPDATE, not an OVERWRITE — existing content is preserved.
 *
 * Usage:
 *   node scripts/setup.mjs [--agents-path /path/to/AGENTS.md] [--port 8790]
 *   pnpm setup [-- --agents-path /path/to/AGENTS.md --port 8790]
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "..", "templates", "AGENTS-empire.md");
const START_MARKER = "<!-- BEGIN hyperclaw orchestration rules -->";
const END_MARKER = "<!-- END hyperclaw orchestration rules -->";

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { agentsPath: null, port: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agents-path" && args[i + 1]) {
      result.agentsPath = path.resolve(args[++i]);
    } else if (args[i] === "--port" && args[i + 1]) {
      result.port = args[++i];
    }
  }
  return result;
}

function detectPort() {
  // 1. CLI arg (handled by caller)
  // 2. .env file in project root
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const match = envContent.match(/^PORT\s*=\s*(\d+)/m);
    if (match) return match[1];
  }
  // 3. Default
  return "8790";
}

function findAgentsPath() {
  return path.join(process.cwd(), "AGENTS.md");
}

function main() {
  const args = parseArgs();
  const agentsPath = args.agentsPath || findAgentsPath();
  const port = args.port || detectPort();

  let templateContent = fs.readFileSync(TEMPLATE_PATH, "utf8");
  templateContent = templateContent.replace(/__PORT__/g, port);

  console.log(`[HyperClaw] Setting up orchestration rules`);
  console.log(`[HyperClaw] Target: ${agentsPath}`);
  console.log(`[HyperClaw] Port: ${port}`);

  // Read existing content
  let existingContent = "";
  if (fs.existsSync(agentsPath)) {
    existingContent = fs.readFileSync(agentsPath, "utf8");
  }

  // Check if already installed — offer update
  if (existingContent.includes(START_MARKER) && existingContent.includes(END_MARKER)) {
    const startIdx = existingContent.indexOf(START_MARKER);
    const endIdx = existingContent.indexOf(END_MARKER) + END_MARKER.length;
    const before = existingContent.slice(0, startIdx);
    const after = existingContent.slice(endIdx);
    const newContent = before + templateContent + after;
    fs.writeFileSync(agentsPath, newContent, "utf8");
    console.log(`[HyperClaw] Updated existing orchestration rules in ${agentsPath}`);
    console.log(`[HyperClaw] Done!`);
    return;
  }

  // Prepend template to existing content
  const newContent = templateContent + "\n\n" + existingContent;

  // Ensure parent directory exists
  const dir = path.dirname(agentsPath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(agentsPath, newContent, "utf8");
  console.log(`[HyperClaw] Orchestration rules added to top of ${agentsPath}`);
  console.log(`[HyperClaw] Your existing AGENTS.md content is preserved below.`);
  console.log(`[HyperClaw] Done!`);
}

main();
