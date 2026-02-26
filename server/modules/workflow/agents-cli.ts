// @ts-nocheck

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createCliParseHelpers } from "./agents-cli-parse.ts";

// ---------------------------------------------------------------------------
// CLI spawn helpers and log-stream utilities
// ---------------------------------------------------------------------------

export function createCliHelpers(ctx: {
  db: any;
  logsDir: string;
  broadcast: (...args: any[]) => any;
  activeProcesses: Map<string, any>;
  TASK_RUN_IDLE_TIMEOUT_MS: number;
  TASK_RUN_HARD_TIMEOUT_MS: number;
  buildAgentArgs: (...args: any[]) => any;
  normalizeStreamChunk: (...args: any[]) => any;
  shouldSkipDuplicateCliOutput: (...args: any[]) => any;
  clearCliOutputDedup: (...args: any[]) => any;
  appendTaskLog: (...args: any[]) => any;
  createSubtaskFromCli: (...args: any[]) => any;
  completeSubtaskFromCli: (...args: any[]) => any;
}) {
  const {
    db,
    logsDir,
    broadcast,
    activeProcesses,
    TASK_RUN_IDLE_TIMEOUT_MS,
    TASK_RUN_HARD_TIMEOUT_MS,
    buildAgentArgs,
    normalizeStreamChunk,
    shouldSkipDuplicateCliOutput,
    clearCliOutputDedup,
    appendTaskLog,
    createSubtaskFromCli,
    completeSubtaskFromCli,
  } = ctx;

  const { parseAndCreateSubtasks } = createCliParseHelpers({ db, createSubtaskFromCli, completeSubtaskFromCli });

  const CLI_PATH_FALLBACK_DIRS = process.platform === "win32"
    ? [
        path.join(process.env.ProgramFiles || "C:\\Program Files", "nodejs"),
        path.join(process.env.LOCALAPPDATA || "", "Programs", "nodejs"),
        path.join(process.env.APPDATA || "", "npm"),
      ].filter(Boolean)
    : [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
        path.join(os.homedir(), ".local", "bin"),
        path.join(os.homedir(), "bin"),
      ];

  function withCliPathFallback(pathValue: string | undefined): string {
    const parts = (pathValue ?? "")
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean);
    const seen = new Set(parts);
    for (const dir of CLI_PATH_FALLBACK_DIRS) {
      if (!dir || seen.has(dir)) continue;
      parts.push(dir);
      seen.add(dir);
    }
    return parts.join(path.delimiter);
  }

  function createSafeLogStreamOps(logStream: any): {
    safeWrite: (text: string) => boolean;
    safeEnd: (onDone?: () => void) => void;
    isClosed: () => boolean;
  } {
    let ended = false;
    const isClosed = () => ended || Boolean(logStream?.destroyed || logStream?.writableEnded || logStream?.closed);
    const safeWrite = (text: string): boolean => {
      if (!text || isClosed()) return false;
      try { logStream.write(text); return true; } catch { ended = true; return false; }
    };
    const safeEnd = (onDone?: () => void): void => {
      if (isClosed()) { ended = true; onDone?.(); return; }
      ended = true;
      try { logStream.end(() => onDone?.()); } catch { onDone?.(); }
    };
    return { safeWrite, safeEnd, isClosed };
  }

  // killPidTree is resolved after providers init via setKillPidTree
  let killPidTree: (pid: number) => void = () => {};
  function setKillPidTree(fn: (pid: number) => void) { killPidTree = fn; }

  function spawnCliAgent(
    taskId: string,
    provider: string,
    prompt: string,
    projectPath: string,
    logPath: string,
    model?: string,
    reasoningLevel?: string,
  ): any {
    clearCliOutputDedup(taskId);
    const promptPath = path.join(logsDir, `${taskId}.prompt.txt`);
    fs.writeFileSync(promptPath, prompt, "utf8");

    const args = buildAgentArgs(provider, model, reasoningLevel);
    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    const { safeWrite, safeEnd } = createSafeLogStreamOps(logStream);
    safeWrite(`\n===== task run start ${new Date().toISOString()} | provider=${provider} =====\n`);

    const cleanEnv = { ...process.env };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE;
    cleanEnv.PATH = withCliPathFallback(String(cleanEnv.PATH ?? process.env.PATH ?? ""));
    cleanEnv.NO_COLOR = "1";
    cleanEnv.FORCE_COLOR = "0";
    cleanEnv.CI = "1";
    if (!cleanEnv.TERM) cleanEnv.TERM = "dumb";

    const child = spawn(args[0], args.slice(1), {
      cwd: projectPath,
      env: cleanEnv,
      shell: process.platform === "win32",
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });

    let finished = false;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let hardTimer: ReturnType<typeof setTimeout> | null = null;
    let stdoutListener: ((chunk: Buffer) => void) | null = null;
    let stderrListener: ((chunk: Buffer) => void) | null = null;

    const detachOutputListeners = () => {
      if (stdoutListener) { child.stdout?.off("data", stdoutListener); stdoutListener = null; }
      if (stderrListener) { child.stderr?.off("data", stderrListener); stderrListener = null; }
    };
    const clearRunTimers = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (hardTimer) { clearTimeout(hardTimer); hardTimer = null; }
    };
    const triggerTimeout = (kind: "idle" | "hard") => {
      if (finished) return;
      finished = true;
      clearRunTimers();
      const timeoutMs = kind === "idle" ? TASK_RUN_IDLE_TIMEOUT_MS : TASK_RUN_HARD_TIMEOUT_MS;
      const reason = kind === "idle"
        ? `no output for ${Math.round(timeoutMs / 1000)}s`
        : `exceeded max runtime ${Math.round(timeoutMs / 1000)}s`;
      const msg = `[HyperClaw] RUN TIMEOUT (${reason})`;
      safeWrite(`\n${msg}\n`);
      appendTaskLog(taskId, "error", msg);
      try {
        if (child.pid && child.pid > 0) { killPidTree(child.pid); } else { child.kill("SIGTERM"); }
      } catch { /* ignore kill race */ }
    };
    const touchIdleTimer = () => {
      if (finished || TASK_RUN_IDLE_TIMEOUT_MS <= 0) return;
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => triggerTimeout("idle"), TASK_RUN_IDLE_TIMEOUT_MS);
    };

    touchIdleTimer();
    if (TASK_RUN_HARD_TIMEOUT_MS > 0) {
      hardTimer = setTimeout(() => triggerTimeout("hard"), TASK_RUN_HARD_TIMEOUT_MS);
    }

    activeProcesses.set(taskId, child);

    child.on("error", (err) => {
      finished = true;
      clearRunTimers();
      detachOutputListeners();
      console.error(`[HyperClaw] spawn error for ${provider} (task ${taskId}): ${err.message}`);
      safeWrite(`\n[HyperClaw] SPAWN ERROR: ${err.message}\n`);
      safeEnd();
      activeProcesses.delete(taskId);
      appendTaskLog(taskId, "error", `Agent spawn failed: ${err.message}`);
    });

    child.stdin?.write(prompt);
    child.stdin?.end();

    stdoutListener = (chunk: Buffer) => {
      touchIdleTimer();
      const text = normalizeStreamChunk(chunk, { dropCliNoise: true });
      if (!text) return;
      if (shouldSkipDuplicateCliOutput(taskId, "stdout", text)) return;
      safeWrite(text);
      broadcast("cli_output", { task_id: taskId, stream: "stdout", data: text });
      parseAndCreateSubtasks(taskId, text);
    };
    stderrListener = (chunk: Buffer) => {
      touchIdleTimer();
      const text = normalizeStreamChunk(chunk, { dropCliNoise: true });
      if (!text) return;
      if (shouldSkipDuplicateCliOutput(taskId, "stderr", text)) return;
      safeWrite(text);
      broadcast("cli_output", { task_id: taskId, stream: "stderr", data: text });
    };
    child.stdout?.on("data", stdoutListener);
    child.stderr?.on("data", stderrListener);

    child.on("close", () => {
      finished = true;
      clearRunTimers();
      detachOutputListeners();
      safeEnd();
      try { fs.unlinkSync(promptPath); } catch { /* ignore */ }
    });

    if (process.platform !== "win32") child.unref();
    return child;
  }

  return { spawnCliAgent, createSafeLogStreamOps, withCliPathFallback, setKillPidTree };
}
