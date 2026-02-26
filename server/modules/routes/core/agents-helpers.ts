// @ts-nocheck
/**
 * Shared types, constants, and helper functions for agents routes.
 */

import { execFile } from "node:child_process";
import path from "node:path";

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export type SystemProcessInfo = {
  pid: number;
  ppid: number | null;
  name: string;
  command: string;
};

export type ManagedProcessProvider = "claude" | "codex" | "gemini" | "opencode" | "node" | "python";

export type SQLInputValue = string | number | null;

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

export const CLI_EXECUTABLE_PROVIDER_MAP: Record<string, ManagedProcessProvider> = {
  "claude": "claude",
  "claude.exe": "claude",
  "codex": "codex",
  "codex.exe": "codex",
  "gemini": "gemini",
  "gemini.exe": "gemini",
  "opencode": "opencode",
  "opencode.exe": "opencode",
  "node": "node",
  "node.exe": "node",
  "python": "python",
  "python.exe": "python",
  "python3": "python",
  "python3.exe": "python",
  "py": "python",
  "py.exe": "python",
};

// ---------------------------------------------------------------------------
// Local helper functions
// ---------------------------------------------------------------------------

export function detectCliProviderFromExecutable(name: string): ManagedProcessProvider | null {
  const normalized = path.basename(String(name ?? "")).trim().toLowerCase();
  if (CLI_EXECUTABLE_PROVIDER_MAP[normalized]) return CLI_EXECUTABLE_PROVIDER_MAP[normalized];
  // e.g. python3.11, python3.12 on macOS/Linux
  if (normalized.startsWith("python")) return "python";
  return null;
}

export function runExecFileText(cmd: string, args: string[], timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { encoding: "utf8", timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          (err as any).stderr = stderr;
          reject(err);
          return;
        }
        resolve(String(stdout ?? ""));
      },
    );
  });
}

export function parseUnixProcessTable(raw: string): SystemProcessInfo[] {
  const lines = raw.split(/\r?\n/);
  const rows: SystemProcessInfo[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/);
    if (!match) continue;
    const pid = Number.parseInt(match[1], 10);
    const ppid = Number.parseInt(match[2], 10);
    const name = String(match[3] ?? "").trim();
    const args = String(match[4] ?? "").trim();
    if (!Number.isFinite(pid) || pid <= 0) continue;
    rows.push({
      pid,
      ppid: Number.isFinite(ppid) && ppid >= 0 ? ppid : null,
      name,
      command: args || name,
    });
  }
  return rows;
}

export function parseWindowsProcessJson(raw: string): SystemProcessInfo[] {
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const items = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
  const rows: SystemProcessInfo[] = [];
  for (const item of items) {
    const pid = Number(item?.ProcessId ?? item?.processid ?? item?.pid);
    if (!Number.isFinite(pid) || pid <= 0) continue;
    const ppidRaw = Number(item?.ParentProcessId ?? item?.parentprocessid ?? item?.ppid);
    const name = String(item?.Name ?? item?.name ?? "").trim();
    const commandLine = String(item?.CommandLine ?? item?.commandline ?? "").trim();
    rows.push({
      pid,
      ppid: Number.isFinite(ppidRaw) && ppidRaw >= 0 ? ppidRaw : null,
      name,
      command: commandLine || name,
    });
  }
  return rows;
}

export async function listSystemProcesses(): Promise<SystemProcessInfo[]> {
  if (process.platform === "win32") {
    const psCommand = "$ErrorActionPreference='Stop'; Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress";
    const candidates = ["powershell.exe", "powershell", "pwsh.exe", "pwsh"];
    for (const shell of candidates) {
      try {
        const stdout = await runExecFileText(shell, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand], 20000);
        const parsed = parseWindowsProcessJson(stdout);
        if (parsed.length) return parsed;
      } catch {
        // try next shell binary
      }
    }
    // Fallback: tasklist (command line is unavailable, but PID/name are enough for kill).
    try {
      const stdout = await runExecFileText("tasklist", ["/FO", "CSV", "/NH"], 20000);
      const rows: SystemProcessInfo[] = [];
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^"([^"]+)","([^"]+)"/);
        if (!match) continue;
        const name = String(match[1] ?? "").trim();
        const pid = Number.parseInt(String(match[2] ?? "").replace(/[^\d]/g, ""), 10);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        rows.push({ pid, ppid: null, name, command: name });
      }
      return rows;
    } catch {
      return [];
    }
  }

  const stdout = await runExecFileText("ps", ["-eo", "pid=,ppid=,comm=,args="], 15000);
  return parseUnixProcessTable(stdout);
}

export function isTaskExecutionStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "planned" || normalized === "collaborating" || normalized === "in_progress" || normalized === "review";
}
