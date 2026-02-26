// @ts-nocheck
/**
 * Core API: auto-update logic (scheduler, apply, config, status).
 * Composed by health-update.ts; does NOT register /health or GET /api/update-status.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { spawn } from "node:child_process";
import { PKG_VERSION } from "../../../config/runtime.ts";
import { computeVersionDeltaKind, isDeltaAllowedByChannel, type UpdateDeltaKind } from "../update-auto-utils.ts";
import { parseSafeRestartCommand } from "../update-auto-command.ts";
import { shouldSkipUpdateByGuards, parseAutoUpdateChannel } from "../update-auto-policy.ts";
import {
  AUTO_UPDATE_DEFAULT_ENABLED, AUTO_UPDATE_ENABLED_SETTING_KEY, AUTO_UPDATE_CHANNEL, AUTO_UPDATE_IDLE_ONLY,
  AUTO_UPDATE_CHECK_INTERVAL_MS, AUTO_UPDATE_INITIAL_DELAY_MS, AUTO_UPDATE_TARGET_BRANCH,
  AUTO_UPDATE_RESTART_MODE, AUTO_UPDATE_RESTART_COMMAND, AUTO_UPDATE_EXIT_DELAY_MS,
  updateCommandTimeoutMs, RUN_COMMAND_CAPTURE_MAX_CHARS,
  autoUpdateActive, autoUpdateSchedulerReady, autoUpdateState, autoUpdateInFlight,
  autoUpdateBootTimer, autoUpdateInterval, autoUpdateExitTimer,
  setAutoUpdateActive, setAutoUpdateSchedulerReady, setAutoUpdateInFlight,
  setAutoUpdateBootTimer, setAutoUpdateInterval, setAutoUpdateExitTimer,
  stopAutoUpdateTimers, maybeUnrefTimer, tryAcquireAutoUpdateLock, releaseAutoUpdateLock,
  tailText, appendChunkTail, isLikelyManagedRuntime, parseStoredBoolean, parseUpdateBooleanFlag,
  type UpdateApplyResult,
} from "./auto-update-helpers.ts";
import { registerAutoUpdateRoutes } from "./auto-update-routes.ts";
import type { UpdateStatusPayload } from "./update-status.ts";

export type { AutoUpdateRestartMode, UpdateApplyStatus, UpdateApplyResult } from "./auto-update-helpers.ts";

export function registerAutoUpdate(
  ctx: RuntimeContext,
  fetchUpdateStatus: (forceRefresh?: boolean) => Promise<UpdateStatusPayload>,
  clearUpdateStatusCache: () => void,
): void {
  const { app, db, appendTaskLog, readSettingString, killPidTree, activeProcesses, notifyCeo } = ctx;

  function runCommandCapture(cmd: string, args: string[], timeoutMs: number, maxChars: number): Promise<{ stdout: string; stderr: string; code: number | null; signal: string | null }> {
    return new Promise((resolve) => {
      const acc = { text: "", length: 0 };
      const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
      const to = setTimeout(() => { try { killPidTree(child.pid!); } catch { child.kill("SIGKILL"); } }, timeoutMs);
      child.stdout?.on("data", (d: Buffer) => appendChunkTail(acc, d.toString("utf8"), maxChars));
      child.stderr?.on("data", (d: Buffer) => appendChunkTail(acc, d.toString("utf8"), maxChars));
      child.on("close", (code, signal) => { clearTimeout(to); resolve({ stdout: acc.text, stderr: "", code, signal: signal ?? null }); });
      child.on("error", () => { clearTimeout(to); resolve({ stdout: acc.text, stderr: "", code: null, signal: null }); });
    });
  }

  function getInProgressTaskCount(): number {
    const row = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE status = ?").get("in_progress") as { c: number } | undefined;
    return row?.c ?? 0;
  }
  function logAutoUpdate(message: string): void { appendTaskLog("_auto_update", "system", message); }
  function readAutoUpdateEnabledSetting(): boolean {
    const v = readSettingString?.(AUTO_UPDATE_ENABLED_SETTING_KEY);
    if (v === undefined) return AUTO_UPDATE_DEFAULT_ENABLED;
    return parseStoredBoolean(v);
  }
  function writeAutoUpdateEnabledSetting(enabled: boolean): void {
    try { db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(AUTO_UPDATE_ENABLED_SETTING_KEY, enabled ? "1" : "0"); } catch { /* ignore */ }
  }
  function refreshAutoUpdateActiveState(): void { setAutoUpdateActive(readAutoUpdateEnabledSetting() && !isLikelyManagedRuntime()); }
  function validateAutoUpdateDependencies(): string[] {
    const reasons: string[] = [];
    const { warning } = parseAutoUpdateChannel(AUTO_UPDATE_CHANNEL);
    if (warning) reasons.push("channel_parse_warning");
    if (AUTO_UPDATE_IDLE_ONLY && getInProgressTaskCount() > 0) reasons.push("tasks_in_progress");
    return reasons;
  }

  async function applyUpdateNow(forceRefresh = false): Promise<UpdateApplyResult> {
    if (autoUpdateState.running) return { status: "running", message: "Update already in progress" };
    if (!tryAcquireAutoUpdateLock()) return { status: "running", message: "Lock held" };
    autoUpdateState.running = true;
    autoUpdateState.last_runtime_error = null;
    try {
      const statusPayload = await fetchUpdateStatus(forceRefresh);
      const delta: UpdateDeltaKind = computeVersionDeltaKind(PKG_VERSION, statusPayload.latest_version);
      const { channel } = parseAutoUpdateChannel(AUTO_UPDATE_CHANNEL);
      if (!isDeltaAllowedByChannel(delta, channel)) {
        releaseAutoUpdateLock(); autoUpdateState.running = false;
        return { status: "skipped", message: `Channel ${channel} does not allow delta ${delta}` };
      }
      const guardReasons = validateAutoUpdateDependencies();
      if (shouldSkipUpdateByGuards(guardReasons, false)) {
        releaseAutoUpdateLock(); autoUpdateState.running = false;
        return { status: "skipped", message: guardReasons.join("; ") };
      }
      const runCmd = process.platform === "win32" ? "cmd" : "sh";
      const runArgs = process.platform === "win32"
        ? ["/c", "git", "pull", "--ff-only", "origin", AUTO_UPDATE_TARGET_BRANCH]
        : ["-c", `git pull --ff-only origin ${AUTO_UPDATE_TARGET_BRANCH}`];
      const { stdout, stderr, code, signal } = await runCommandCapture(runCmd, runArgs, updateCommandTimeoutMs, RUN_COMMAND_CAPTURE_MAX_CHARS);
      const output = [stdout, stderr].filter(Boolean).join("\n");
      if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGKILL") {
        releaseAutoUpdateLock(); autoUpdateState.running = false;
        autoUpdateState.last_error = output || `exit ${code} signal ${signal}`;
        return { status: "error", message: "Update command failed", output: tailText(output, RUN_COMMAND_CAPTURE_MAX_CHARS), error: autoUpdateState.last_error };
      }
      logAutoUpdate(`Auto-update applied (output length ${output.length})`);
      notifyCeo?.("Auto-update applied; restart scheduled.", null, "status_update");
      if (AUTO_UPDATE_RESTART_MODE === "exit") {
        const t = setTimeout(() => { setAutoUpdateExitTimer(null); releaseAutoUpdateLock(); process.exit(0); }, AUTO_UPDATE_EXIT_DELAY_MS);
        setAutoUpdateExitTimer(t); maybeUnrefTimer(t);
        return { status: "success", message: "Update applied; exit scheduled", restart: true };
      }
      const parsed = parseSafeRestartCommand(AUTO_UPDATE_RESTART_COMMAND);
      if (!parsed) { releaseAutoUpdateLock(); autoUpdateState.running = false; return { status: "error", message: "Restart command invalid or missing", restart: true }; }
      spawn(parsed.cmd, parsed.args, { stdio: "ignore", detached: true, windowsHide: true });
      releaseAutoUpdateLock(); autoUpdateState.running = false;
      return { status: "success", message: "Update applied; restart command spawned", restart: true, commands: { cmd: parsed.cmd, args: parsed.args } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      autoUpdateState.last_runtime_error = msg; releaseAutoUpdateLock(); autoUpdateState.running = false;
      return { status: "error", message: msg, error: msg };
    }
  }

  function runAutoUpdateCycle(): void {
    if (!autoUpdateActive || autoUpdateState.running) return;
    setAutoUpdateInFlight((async () => {
      try {
        autoUpdateState.last_checked_at = Date.now();
        const result = await applyUpdateNow(false);
        autoUpdateState.last_result = result;
        autoUpdateState.last_error = result.error ?? result.message ?? null;
        autoUpdateState.next_check_at = Date.now() + AUTO_UPDATE_CHECK_INTERVAL_MS;
      } catch (e) {
        autoUpdateState.last_runtime_error = e instanceof Error ? e.message : String(e);
      } finally {
        setAutoUpdateInFlight(null);
      }
    })());
  }

  refreshAutoUpdateActiveState();
  if (!autoUpdateSchedulerReady) {
    stopAutoUpdateTimers();
    const bootTimer = setTimeout(() => {
      setAutoUpdateBootTimer(null);
      setAutoUpdateSchedulerReady(true);
      runAutoUpdateCycle();
      setAutoUpdateInterval(setInterval(runAutoUpdateCycle, AUTO_UPDATE_CHECK_INTERVAL_MS));
    }, AUTO_UPDATE_INITIAL_DELAY_MS);
    setAutoUpdateBootTimer(bootTimer);
    maybeUnrefTimer(bootTimer);
  }

  registerAutoUpdateRoutes(app, {
    refreshAutoUpdateActiveState,
    readAutoUpdateEnabledSetting,
    writeAutoUpdateEnabledSetting,
    applyUpdateNow,
    clearUpdateStatusCache,
    getActive: () => autoUpdateActive,
  });
}
