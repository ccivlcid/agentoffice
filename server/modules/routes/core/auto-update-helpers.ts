// @ts-nocheck
/**
 * Types, constants, module state, and pure utility functions for auto-update.
 * Extracted from auto-update.ts to reduce single-file size.
 */

import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { parseAutoUpdateChannel } from "../update-auto-policy.ts";
import { createAutoUpdateLock } from "../update-auto-lock.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AutoUpdateRestartMode = "exit" | "command";

export type UpdateApplyStatus = "idle" | "running" | "success" | "error" | "skipped";

export type UpdateApplyResult = {
  status: UpdateApplyStatus;
  message?: string;
  output?: string;
  restart?: boolean;
  commands?: { cmd: string; args: string[] };
  error?: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUTO_UPDATE_DEFAULT_ENABLED =
  String(process.env.AUTO_UPDATE_ENABLED ?? "0").trim() === "1";
export const AUTO_UPDATE_ENABLED_SETTING_KEY = "autoUpdateEnabled";

const parsedAutoUpdateChannel = parseAutoUpdateChannel(process.env.AUTO_UPDATE_CHANNEL);
export const AUTO_UPDATE_CHANNEL = parsedAutoUpdateChannel.channel;
if (parsedAutoUpdateChannel.warning) console.warn(`[auto-update] ${parsedAutoUpdateChannel.warning}`);

export const AUTO_UPDATE_IDLE_ONLY = String(process.env.AUTO_UPDATE_IDLE_ONLY ?? "1").trim() !== "0";
export const AUTO_UPDATE_CHECK_INTERVAL_MS = Math.max(60_000, Number(process.env.AUTO_UPDATE_CHECK_INTERVAL_MS ?? 30 * 60 * 1000) || 30 * 60 * 1000);
export const AUTO_UPDATE_INITIAL_DELAY_MS = Math.max(0, Number(process.env.AUTO_UPDATE_INITIAL_DELAY_MS ?? 60_000) || 60_000);
export const AUTO_UPDATE_TARGET_BRANCH = String(process.env.AUTO_UPDATE_TARGET_BRANCH ?? "main").trim() || "main";
export const AUTO_UPDATE_RESTART_MODE = (String(process.env.AUTO_UPDATE_RESTART_MODE ?? "exit").trim().toLowerCase() === "command" ? "command" : "exit") as AutoUpdateRestartMode;
export const AUTO_UPDATE_RESTART_COMMAND = String(process.env.AUTO_UPDATE_RESTART_COMMAND ?? "").trim();
export const AUTO_UPDATE_EXIT_DELAY_MS = Math.max(0, Number(process.env.AUTO_UPDATE_EXIT_DELAY_MS ?? 2000) || 2000);
export const AUTO_UPDATE_TOTAL_TIMEOUT_MS = Math.max(60_000, Number(process.env.AUTO_UPDATE_TOTAL_TIMEOUT_MS ?? 5 * 60 * 1000) || 5 * 60 * 1000);
export const updateCommandTimeoutMs = Math.min(Math.max(30_000, Number(process.env.AUTO_UPDATE_COMMAND_TIMEOUT_MS ?? 120_000) || 120_000), AUTO_UPDATE_TOTAL_TIMEOUT_MS);
export const RUN_COMMAND_CAPTURE_MAX_CHARS = 50_000;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

export let autoUpdateActive = false;
export let autoUpdateSchedulerReady = false;
export let autoUpdateState: {
  running: boolean;
  last_checked_at: number | null;
  last_result: UpdateApplyResult | null;
  last_error: string | null;
  last_runtime_error: string | null;
  next_check_at: number | null;
} = {
  running: false, last_checked_at: null, last_result: null, last_error: null, last_runtime_error: null, next_check_at: null,
};
export function setAutoUpdateActive(val: boolean) { autoUpdateActive = val; }
export function setAutoUpdateSchedulerReady(val: boolean) { autoUpdateSchedulerReady = val; }
export let autoUpdateInFlight: Promise<void> | null = null;
export function setAutoUpdateInFlight(val: Promise<void> | null) { autoUpdateInFlight = val; }
export let autoUpdateLock = createAutoUpdateLock();
export let autoUpdateBootTimer: ReturnType<typeof setTimeout> | null = null;
export let autoUpdateInterval: ReturnType<typeof setInterval> | null = null;
export let autoUpdateExitTimer: ReturnType<typeof setTimeout> | null = null;
export function setAutoUpdateBootTimer(val: ReturnType<typeof setTimeout> | null) { autoUpdateBootTimer = val; }
export function setAutoUpdateInterval(val: ReturnType<typeof setInterval> | null) { autoUpdateInterval = val; }
export function setAutoUpdateExitTimer(val: ReturnType<typeof setTimeout> | null) { autoUpdateExitTimer = val; }

// ---------------------------------------------------------------------------
// Timer helpers
// ---------------------------------------------------------------------------

export function stopAutoUpdateTimers(): void {
  if (autoUpdateBootTimer) { clearTimeout(autoUpdateBootTimer); autoUpdateBootTimer = null; }
  if (autoUpdateInterval) { clearInterval(autoUpdateInterval); autoUpdateInterval = null; }
  if (autoUpdateExitTimer) { clearTimeout(autoUpdateExitTimer); autoUpdateExitTimer = null; }
}

export function maybeUnrefTimer(t: ReturnType<typeof setTimeout> | null): void {
  if (t && typeof (t as NodeJS.Timeout).unref === "function") (t as NodeJS.Timeout).unref();
}

export function tryAcquireAutoUpdateLock(): boolean { return autoUpdateLock.tryAcquire(); }
export function releaseAutoUpdateLock(): void { autoUpdateLock.release(); }

// ---------------------------------------------------------------------------
// Pure utility functions
// ---------------------------------------------------------------------------

export function tailText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return "\n...[truncated]...\n" + text.slice(-maxChars);
}

export function appendChunkTail(acc: { text: string; length: number }, chunk: string, maxTotal: number): void {
  const space = maxTotal - acc.length;
  if (space <= 0) return;
  const add = chunk.length <= space ? chunk : chunk.slice(-space);
  if (add) {
    acc.text += add;
    acc.length += add.length;
    if (acc.length > maxTotal) { const keep = acc.text.slice(-maxTotal); acc.text = keep; acc.length = keep.length; }
  }
}

export function isLikelyManagedRuntime(): boolean {
  const p = process.execPath.toLowerCase();
  return p.includes("node") || p.includes("electron") || p.includes("nw.js") || p.includes("pm2");
}

export function parseUpdateBooleanFlag(envValue: string | undefined): boolean {
  const v = String(envValue ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function parseStoredBoolean(value: string | undefined): boolean {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function runCommandCaptureSync(cmd: string, args: string[], timeoutMs: number, maxChars: number): { stdout: string; stderr: string; code: number | null; signal: string | null } {
  let stdout = "";
  let stderr = "";
  let code: number | null = null;
  let signal: string | null = null;
  try {
    const opts = { timeout: timeoutMs, maxBuffer: Math.max(maxChars * 2, 1024 * 1024), encoding: "utf8" as const };
    stdout = execFileSync(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] }).toString("utf8").slice(-maxChars);
  } catch (err: any) {
    if (err.stdout != null) stdout = String(err.stdout).slice(-maxChars);
    if (err.stderr != null) stderr = String(err.stderr).slice(-maxChars);
    code = err.status ?? err.code ?? null;
    signal = err.signal ?? null;
  }
  return { stdout, stderr, code, signal };
}
