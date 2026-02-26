// @ts-nocheck
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import {
  readGeminiCredsFromKeychain,
  fetchClaudeUsage,
  fetchCodexUsage,
  fetchGeminiUsage,
} from "./providers-usage.ts";
import { withCliPathFallback } from "../core-cli-helpers.ts";

export function initCliHelpers(ctx: RuntimeContext) {
  const db = ctx.db;
  const nowMs = ctx.nowMs;

  // ---------------------------------------------------------------------------
  // Task log helpers
  // ---------------------------------------------------------------------------
  function appendTaskLog(taskId: string, kind: string, message: string): void {
    const t = nowMs();
    db.prepare(
      "INSERT INTO task_logs (task_id, kind, message, created_at) VALUES (?, ?, ?, ?)"
    ).run(taskId, kind, message, t);
  }

  // ---------------------------------------------------------------------------
  // CLI Detection helpers
  // ---------------------------------------------------------------------------
  let cachedCliStatus: { data: Record<string, any>; loadedAt: number } | null = null;
  const CLI_STATUS_TTL = 30_000;

  function jsonHasKey(filePath: string, key: string): boolean {
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const j = JSON.parse(raw);
      return j != null && typeof j === "object" && key in j && j[key] != null;
    } catch {
      return false;
    }
  }

  function fileExistsNonEmpty(filePath: string): boolean {
    try {
      const stat = fs.statSync(filePath);
      return stat.isFile() && stat.size > 2;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // CLI Tool Definitions
  // ---------------------------------------------------------------------------
  const CLI_TOOLS = [
    {
      name: "claude",
      authHint: "Run: claude login",
      checkAuth: () => {
        const home = os.homedir();
        const claudeJson = path.join(home, ".claude.json");
        if (jsonHasKey(claudeJson, "oauthAccount") || jsonHasKey(claudeJson, "session")) return true;
        return fileExistsNonEmpty(path.join(home, ".claude", "auth.json"));
      },
    },
    {
      name: "codex",
      authHint: "Run: codex auth login",
      checkAuth: () => {
        const authPath = path.join(os.homedir(), ".codex", "auth.json");
        if (jsonHasKey(authPath, "OPENAI_API_KEY") || jsonHasKey(authPath, "tokens")) return true;
        if (process.env.OPENAI_API_KEY) return true;
        return false;
      },
    },
    {
      name: "gemini",
      authHint: "Run: gemini auth login",
      getVersion: () => {
        try {
          const whichCmd = process.platform === "win32" ? "where" : "which";
          const geminiPath = execFileSync(whichCmd, ["gemini"], { encoding: "utf8", timeout: 3000 }).split("\n")[0].trim();
          if (!geminiPath) return null;
          const realPath = fs.realpathSync(geminiPath);
          let dir = path.dirname(realPath);
          for (let i = 0; i < 10; i++) {
            const pkgPath = path.join(dir, "node_modules", "@google", "gemini-cli", "package.json");
            if (fs.existsSync(pkgPath)) {
              const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
              return pkg.version ?? null;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
          }
        } catch { /* ignore */ }
        return null;
      },
      checkAuth: () => {
        if (readGeminiCredsFromKeychain()) return true;
        if (jsonHasKey(path.join(os.homedir(), ".gemini", "oauth_creds.json"), "access_token")) return true;
        const appData = process.env.APPDATA;
        if (appData && jsonHasKey(path.join(appData, "gcloud", "application_default_credentials.json"), "client_id")) return true;
        return false;
      },
    },
    {
      name: "opencode",
      authHint: "Run: opencode auth",
      checkAuth: () => {
        const home = os.homedir();
        if (fileExistsNonEmpty(path.join(home, ".local", "share", "opencode", "auth.json"))) return true;
        const xdgData = process.env.XDG_DATA_HOME;
        if (xdgData && fileExistsNonEmpty(path.join(xdgData, "opencode", "auth.json"))) return true;
        if (process.platform === "darwin") {
          if (fileExistsNonEmpty(path.join(home, "Library", "Application Support", "opencode", "auth.json"))) return true;
        }
        return false;
      },
    },
  ];

  function execWithTimeout(cmd: string, args: string[], timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const opts: any = {
        timeout: timeoutMs,
        env: { ...process.env, PATH: withCliPathFallback(process.env.PATH) },
      };
      if (process.platform === "win32") opts.shell = true;
      const child = execFile(cmd, args, opts, (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout.trim());
      });
      child.unref?.();
    });
  }

  async function detectCliTool(tool: any): Promise<any> {
    const whichCmd = process.platform === "win32" ? "where" : "which";
    try {
      await execWithTimeout(whichCmd, [tool.name], 3000);
    } catch {
      return { installed: false, version: null, authenticated: false, authHint: tool.authHint };
    }

    let version: string | null = null;
    if (tool.getVersion) {
      version = tool.getVersion();
    } else {
      try {
        version = await execWithTimeout(tool.name, tool.versionArgs ?? ["--version"], 3000);
        if (version.includes("\n")) version = version.split("\n")[0].trim();
      } catch { /* binary found but --version failed */ }
    }

    const authenticated = tool.checkAuth();
    return { installed: true, version, authenticated, authHint: tool.authHint };
  }

  async function detectAllCli(): Promise<Record<string, any>> {
    const results = await Promise.all(CLI_TOOLS.map((t) => detectCliTool(t)));
    const out: Record<string, any> = {};
    for (let i = 0; i < CLI_TOOLS.length; i++) {
      out[CLI_TOOLS[i].name] = results[i];
    }
    return out;
  }

  return {
    appendTaskLog,
    cachedCliStatus,
    CLI_STATUS_TTL,
    jsonHasKey,
    fileExistsNonEmpty,
    fetchClaudeUsage,
    fetchCodexUsage,
    fetchGeminiUsage,
    CLI_TOOLS,
    execWithTimeout,
    detectCliTool,
    detectAllCli,
  };
}
