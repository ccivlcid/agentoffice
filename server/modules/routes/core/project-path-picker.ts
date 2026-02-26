// @ts-nocheck
/**
 * Native directory picker for project path selection.
 * Extracted from project-path.ts to keep each file under 300 lines.
 */

import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";

export function execFileText(
  cmd: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(err);
      resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

export async function pickNativeDirectoryPath(): Promise<{
  path: string | null;
  cancelled: boolean;
  source: string;
}> {
  const timeoutMs = 60_000;
  if (process.platform === "darwin") {
    const script =
      'try\nPOSIX path of (choose folder with prompt "Select project folder for HyperClaw")\non error number -128\n""\nend try';
    const { stdout } = await execFileText("osascript", ["-e", script], timeoutMs);
    const value = stdout.trim();
    return { path: value || null, cancelled: !value, source: "osascript" };
  }
  if (process.platform === "win32") {
    const psScript = [
      "Add-Type -AssemblyName System.Windows.Forms | Out-Null;",
      "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;",
      "$dialog.Description = 'Select project folder for HyperClaw';",
      "$dialog.UseDescriptionForTitle = $true;",
      "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Write($dialog.SelectedPath) }",
    ].join(" ");
    const { stdout } = await execFileText(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript],
      timeoutMs
    );
    const value = stdout.trim();
    return { path: value || null, cancelled: !value, source: "powershell" };
  }
  try {
    const { stdout } = await execFileText(
      "zenity",
      ["--file-selection", "--directory", "--title=Select project folder for HyperClaw"],
      timeoutMs
    );
    const value = stdout.trim();
    return { path: value || null, cancelled: !value, source: "zenity" };
  } catch {
    try {
      const { stdout } = await execFileText(
        "kdialog",
        ["--getexistingdirectory", path.join(os.homedir(), "Projects"), "--title", "Select project folder for HyperClaw"],
        timeoutMs
      );
      const value = stdout.trim();
      return { path: value || null, cancelled: !value, source: "kdialog" };
    } catch {
      return { path: null, cancelled: false, source: "unsupported" };
    }
  }
}
