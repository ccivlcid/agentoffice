#!/usr/bin/env node
/**
 * Polls API health until ready (or timeout), then runs the remaining args as a command.
 * Used so Vite starts after the API server is listening (avoids ECONNREFUSED on first load).
 */

const API_HEALTH_URL = process.env.VITE_API_PROXY_TARGET
  ? `${process.env.VITE_API_PROXY_TARGET.replace(/\/$/, "")}/api/health`
  : "http://127.0.0.1:8790/api/health";
const POLL_MS = 500;
const MAX_WAIT_MS = 60_000;

async function waitForApi() {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const res = await fetch(API_HEALTH_URL);
      if (res.ok) return true;
    } catch {
      // ECONNREFUSED or other - API not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  return false;
}

(async () => {
  const rest = process.argv.slice(2);
  if (rest.length === 0) {
    process.exit(0);
    return;
  }
  process.stdout.write("[wait-for-api] Waiting for API at " + API_HEALTH_URL + " ...");
  const ok = await waitForApi();
  if (!ok) {
    process.stderr.write(" timeout.\n");
    process.exit(1);
  }
  process.stdout.write(" ok.\n");
  const { spawn } = await import("node:child_process");
  const [cmd, ...args] = rest;
  const child = spawn(cmd, args, { stdio: "inherit", shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
})();
