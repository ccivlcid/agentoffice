// @ts-nocheck
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const GEMINI_OAUTH_CLIENT_ID =
  process.env.GEMINI_OAUTH_CLIENT_ID ?? process.env.OAUTH_GOOGLE_CLIENT_ID ?? "";
const GEMINI_OAUTH_CLIENT_SECRET =
  process.env.GEMINI_OAUTH_CLIENT_SECRET ?? process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? "";

export function readClaudeToken(): string | null {
  if (process.platform === "darwin") {
    try {
      const raw = execFileSync("security", [
        "find-generic-password", "-s", "Claude Code-credentials", "-w",
      ], { timeout: 3000 }).toString().trim();
      const j = JSON.parse(raw);
      if (j?.claudeAiOauth?.accessToken) return j.claudeAiOauth.accessToken;
    } catch { /* ignore */ }
  }
  const home = os.homedir();
  try {
    const credsPath = path.join(home, ".claude", ".credentials.json");
    if (fs.existsSync(credsPath)) {
      const j = JSON.parse(fs.readFileSync(credsPath, "utf8"));
      if (j?.claudeAiOauth?.accessToken) return j.claudeAiOauth.accessToken;
    }
  } catch { /* ignore */ }
  return null;
}

export function readCodexTokens(): { access_token: string; account_id: string } | null {
  try {
    const authPath = path.join(os.homedir(), ".codex", "auth.json");
    const j = JSON.parse(fs.readFileSync(authPath, "utf8"));
    if (j?.tokens?.access_token && j?.tokens?.account_id) {
      return { access_token: j.tokens.access_token, account_id: j.tokens.account_id };
    }
  } catch { /* ignore */ }
  return null;
}

export function readGeminiCredsFromKeychain(): any | null {
  if (process.platform !== "darwin") return null;
  try {
    const raw = execFileSync("security", [
      "find-generic-password", "-s", "gemini-cli-oauth", "-a", "main-account", "-w",
    ], { timeout: 3000, stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
    if (!raw) return null;
    const stored = JSON.parse(raw);
    if (!stored?.token?.accessToken) return null;
    return {
      access_token: stored.token.accessToken,
      refresh_token: stored.token.refreshToken ?? "",
      expiry_date: stored.token.expiresAt ?? 0,
      source: "keychain",
    };
  } catch { return null; }
}

export function readGeminiCredsFromFile(): any | null {
  try {
    const p = path.join(os.homedir(), ".gemini", "oauth_creds.json");
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (j?.access_token) {
      return {
        access_token: j.access_token,
        refresh_token: j.refresh_token ?? "",
        expiry_date: j.expiry_date ?? 0,
        source: "file",
      };
    }
  } catch { /* ignore */ }
  return null;
}

export function readGeminiCreds(): any | null {
  return readGeminiCredsFromKeychain() ?? readGeminiCredsFromFile();
}

export async function freshGeminiToken(): Promise<string | null> {
  const creds = readGeminiCreds();
  if (!creds) return null;
  if (creds.expiry_date > Date.now() + 300_000) return creds.access_token;
  if (!creds.refresh_token) return creds.access_token;
  if (!GEMINI_OAUTH_CLIENT_ID || !GEMINI_OAUTH_CLIENT_SECRET) return null;
  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GEMINI_OAUTH_CLIENT_ID,
        client_secret: GEMINI_OAUTH_CLIENT_SECRET,
        refresh_token: creds.refresh_token,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return creds.access_token;
    const data = await resp.json() as { access_token?: string; expires_in?: number; refresh_token?: string };
    if (!data.access_token) return creds.access_token;
    if (creds.source === "file") {
      try {
        const p = path.join(os.homedir(), ".gemini", "oauth_creds.json");
        const raw = JSON.parse(fs.readFileSync(p, "utf8"));
        raw.access_token = data.access_token;
        if (data.refresh_token) raw.refresh_token = data.refresh_token;
        raw.expiry_date = Date.now() + (data.expires_in ?? 3600) * 1000;
        fs.writeFileSync(p, JSON.stringify(raw, null, 2), { mode: 0o600 });
      } catch { /* ignore write failure */ }
    }
    return data.access_token;
  } catch { return creds.access_token; }
}

let geminiProjectCache: { id: string; fetchedAt: number } | null = null;
const GEMINI_PROJECT_TTL = 300_000;

export async function getGeminiProjectId(token: string): Promise<string | null> {
  const envProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (envProject) return envProject;

  try {
    const settingsPath = path.join(os.homedir(), ".gemini", "settings.json");
    const j = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    if (j?.cloudaicompanionProject) return j.cloudaicompanionProject;
  } catch { /* ignore */ }

  if (geminiProjectCache && Date.now() - geminiProjectCache.fetchedAt < GEMINI_PROJECT_TTL) {
    return geminiProjectCache.id;
  }

  try {
    const resp = await fetch("https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metadata: { ideType: "GEMINI_CLI", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { cloudaicompanionProject?: string };
    if (data.cloudaicompanionProject) {
      geminiProjectCache = { id: data.cloudaicompanionProject, fetchedAt: Date.now() };
      return geminiProjectCache.id;
    }
  } catch { /* ignore */ }
  return null;
}

export async function fetchClaudeUsage(): Promise<{ windows: any[]; error: string | null }> {
  const token = readClaudeToken();
  if (!token) return { windows: [], error: "unauthenticated" };
  try {
    const resp = await fetch("https://api.anthropic.com/api/oauth/usage", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { windows: [], error: `http_${resp.status}` };
    const data = await resp.json() as Record<string, { utilization?: number; resets_at?: string } | null>;
    const windows: any[] = [];
    const labelMap: Record<string, string> = {
      five_hour: "5-hour",
      seven_day: "7-day",
      seven_day_sonnet: "7-day Sonnet",
      seven_day_opus: "7-day Opus",
    };
    for (const [key, label] of Object.entries(labelMap)) {
      const entry = data[key];
      if (entry) {
        windows.push({
          label,
          utilization: Math.round(entry.utilization ?? 0) / 100,
          resetsAt: entry.resets_at ?? null,
        });
      }
    }
    return { windows, error: null };
  } catch {
    return { windows: [], error: "unavailable" };
  }
}

export async function fetchCodexUsage(): Promise<{ windows: any[]; error: string | null }> {
  const tokens = readCodexTokens();
  if (!tokens) return { windows: [], error: "unauthenticated" };
  try {
    const resp = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      headers: {
        "Authorization": `Bearer ${tokens.access_token}`,
        "ChatGPT-Account-Id": tokens.account_id,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { windows: [], error: `http_${resp.status}` };
    const data = await resp.json() as {
      rate_limit?: {
        primary_window?: { used_percent?: number; reset_at?: number };
        secondary_window?: { used_percent?: number; reset_at?: number };
      };
    };
    const windows: any[] = [];
    if (data.rate_limit?.primary_window) {
      const pw = data.rate_limit.primary_window;
      windows.push({
        label: "5-hour",
        utilization: (pw.used_percent ?? 0) / 100,
        resetsAt: pw.reset_at ? new Date(pw.reset_at * 1000).toISOString() : null,
      });
    }
    if (data.rate_limit?.secondary_window) {
      const sw = data.rate_limit.secondary_window;
      windows.push({
        label: "7-day",
        utilization: (sw.used_percent ?? 0) / 100,
        resetsAt: sw.reset_at ? new Date(sw.reset_at * 1000).toISOString() : null,
      });
    }
    return { windows, error: null };
  } catch {
    return { windows: [], error: "unavailable" };
  }
}

export async function fetchGeminiUsage(): Promise<{ windows: any[]; error: string | null }> {
  const token = await freshGeminiToken();
  if (!token) return { windows: [], error: "unauthenticated" };

  const projectId = await getGeminiProjectId(token);
  if (!projectId) return { windows: [], error: "unavailable" };

  try {
    const resp = await fetch("https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ project: projectId }),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { windows: [], error: `http_${resp.status}` };
    const data = await resp.json() as {
      buckets?: Array<{ modelId?: string; remainingFraction?: number; resetTime?: string }>;
    };
    const windows: any[] = [];
    if (data.buckets) {
      for (const b of data.buckets) {
        if (b.modelId?.endsWith("_vertex")) continue;
        windows.push({
          label: b.modelId ?? "Quota",
          utilization: Math.round((1 - (b.remainingFraction ?? 1)) * 100) / 100,
          resetsAt: b.resetTime ?? null,
        });
      }
    }
    return { windows, error: null };
  } catch {
    return { windows: [], error: "unavailable" };
  }
}

// ---------------------------------------------------------------------------
// Cursor usage
// ---------------------------------------------------------------------------

export function readCursorAccessToken(): { token: string; userId: string } | null {
  let vscdbPath: string;
  if (process.platform === "win32") {
    vscdbPath = path.join(process.env.APPDATA || "", "Cursor", "User", "globalStorage", "state.vscdb");
  } else if (process.platform === "darwin") {
    vscdbPath = path.join(os.homedir(), "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb");
  } else {
    vscdbPath = path.join(os.homedir(), ".config", "Cursor", "User", "globalStorage", "state.vscdb");
  }
  if (!fs.existsSync(vscdbPath)) return null;

  try {
    const db = new DatabaseSync(vscdbPath, { readOnly: true });
    const row = db.prepare("SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken'").get() as { value: string } | undefined;
    db.close();
    if (!row?.value) return null;

    const token = row.value;
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    const userId = payload.sub ?? "";
    if (!userId) return null;
    return { token, userId };
  } catch {
    return null;
  }
}

export async function fetchCursorUsage(): Promise<{ windows: any[]; error: string | null }> {
  const creds = readCursorAccessToken();
  if (!creds) return { windows: [], error: "unauthenticated" };

  const cookieValue = `${creds.userId}::${creds.token}`;
  try {
    const resp = await fetch(`https://cursor.com/api/usage?user=${encodeURIComponent(creds.userId)}`, {
      headers: {
        "Cookie": `WorkosCursorSessionToken=${encodeURIComponent(cookieValue)}`,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return { windows: [], error: `http_${resp.status}` };

    const data = await resp.json() as Record<string, any>;

    // Aggregate premium model usage into a single window
    let totalUsed = 0;
    let maxAllowed = 0;
    let startOfMonth: string | null = null;
    for (const [, modelData] of Object.entries(data)) {
      if (modelData && typeof modelData === "object" && "numRequests" in modelData) {
        totalUsed += modelData.numRequests ?? 0;
        if (modelData.maxRequestUsage && modelData.maxRequestUsage > maxAllowed) {
          maxAllowed = modelData.maxRequestUsage;
        }
        if (!startOfMonth && modelData.startOfMonth) {
          startOfMonth = modelData.startOfMonth;
        }
      }
    }

    const windows: any[] = [];
    if (maxAllowed > 0) {
      windows.push({
        label: `Premium (${totalUsed}/${maxAllowed})`,
        utilization: Math.round((totalUsed / maxAllowed) * 100) / 100,
        resetsAt: startOfMonth ?? null,
      });
    } else if (totalUsed > 0) {
      windows.push({
        label: `Requests: ${totalUsed}`,
        utilization: 0,
        resetsAt: startOfMonth ?? null,
      });
    }
    return { windows, error: null };
  } catch {
    return { windows: [], error: "unavailable" };
  }
}
