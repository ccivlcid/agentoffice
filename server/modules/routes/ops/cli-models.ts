// @ts-nocheck
/**
 * CLI models and OAuth provider model listing (GET /api/cli-models, GET /api/oauth/models).
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { type CliModelInfoServer, readCodexModelsCache, fetchGeminiModels, toModelInfo } from "./cli-models-helpers.ts";

let cachedCliModels: { data: Record<string, CliModelInfoServer[]>; loadedAt: number } | null = null;

export function registerOpsCliModels(ctx: RuntimeContext): void {
  const {
    app,
    db,
    getPreferredOAuthAccounts,
    exchangeCopilotToken,
    execWithTimeout,
  } = ctx;
  const cachedModelsRef = ctx as { cachedModels?: { data: Record<string, string[]>; loadedAt: number } | null };

  function readModelCache(cacheKey: string): any | null {
    try {
      const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(cacheKey) as any;
      if (row?.value) return JSON.parse(row.value);
    } catch { /* ignore */ }
    return null;
  }

  function writeModelCache(cacheKey: string, data: any): void {
    try {
      db.prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      ).run(cacheKey, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  async function fetchCopilotModelsFromAPI(): Promise<string[]> {
    try {
      const accounts = getPreferredOAuthAccounts("github");
      const account = accounts.find((a: any) => Boolean(a.accessToken));
      if (!account) return [];

      const { token, baseUrl } = await exchangeCopilotToken(account.accessToken);
      const resp = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "User-Agent": "climpire",
          "Editor-Version": "climpire/1.0.0",
          "Copilot-Integration-Id": "vscode-chat",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) return [];

      const data = await resp.json() as { data?: Array<{ id?: string }> };
      const seen = new Set<string>();
      const models: string[] = [];
      if (data.data && Array.isArray(data.data)) {
        for (const m of data.data) {
          if (m.id) {
            const slug = `github-copilot/${m.id}`;
            if (!seen.has(slug)) { seen.add(slug); models.push(slug); }
          }
        }
      }
      return models;
    } catch {
      return [];
    }
  }

  async function fetchOpenCodeModels(): Promise<Record<string, string[]>> {
    const grouped: Record<string, string[]> = { opencode: [] };
    try {
      const output = await execWithTimeout("opencode", ["models"], 10_000);
      for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes("/")) continue;
        const slashIdx = trimmed.indexOf("/");
        const provider = trimmed.slice(0, slashIdx);
        if (provider === "github-copilot") {
          if (!grouped.copilot) grouped.copilot = [];
          if (!grouped.copilot.includes(trimmed)) grouped.copilot.push(trimmed);
        } else if (provider === "google" && trimmed.includes("antigravity")) {
          if (!grouped.antigravity) grouped.antigravity = [];
          if (!grouped.antigravity.includes(trimmed)) grouped.antigravity.push(trimmed);
        } else {
          if (!grouped.opencode.includes(trimmed)) grouped.opencode.push(trimmed);
        }
      }
    } catch {
      // opencode not available
    }
    return grouped;
  }

  app.get("/api/cli-models", async (req: any, res: any) => {
    const refresh = req.query.refresh === "true";

    if (!refresh) {
      if (cachedCliModels) {
        return res.json({ models: cachedCliModels.data });
      }
      const dbCached = readModelCache("cli_models_cache");
      if (dbCached) {
        cachedCliModels = { data: dbCached, loadedAt: Date.now() };
        return res.json({ models: dbCached });
      }
    }

    const models: Record<string, CliModelInfoServer[]> = {
      claude: [
        "opus", "sonnet", "haiku",
        "claude-opus-4-6", "claude-sonnet-4-6", "claude-sonnet-4-5", "claude-haiku-4-5",
      ].map(toModelInfo),
      gemini: fetchGeminiModels(),
      opencode: [],
    };

    const codexModels = readCodexModelsCache();
    models.codex = codexModels.length > 0
      ? codexModels
      : ["gpt-5.3-codex", "gpt-5.2-codex", "gpt-5.1-codex-max", "gpt-5.2", "gpt-5.1-codex-mini"].map(toModelInfo);

    try {
      const ocModels = await fetchOpenCodeModels();
      const ocList: string[] = [];
      for (const [, modelList] of Object.entries(ocModels)) {
        for (const m of modelList) {
          if (!ocList.includes(m)) ocList.push(m);
        }
      }
      if (ocList.length > 0) models.opencode = ocList.map(toModelInfo);
    } catch {
      // opencode not available
    }

    cachedCliModels = { data: models, loadedAt: Date.now() };
    writeModelCache("cli_models_cache", models);
    res.json({ models });
  });

  app.get("/api/oauth/models", async (req: any, res: any) => {
    const refresh = req.query.refresh === "true";

    if (!refresh) {
      if (cachedModelsRef.cachedModels) {
        return res.json({ models: cachedModelsRef.cachedModels.data });
      }
      const dbCached = readModelCache("oauth_models_cache");
      if (dbCached) {
        cachedModelsRef.cachedModels = { data: dbCached, loadedAt: Date.now() };
        return res.json({ models: dbCached });
      }
    }

    try {
      const [copilotModels, ocModels] = await Promise.all([
        fetchCopilotModelsFromAPI(),
        fetchOpenCodeModels(),
      ]);

      const merged: Record<string, string[]> = { ...ocModels };

      if (copilotModels.length > 0) {
        const existing = new Set(copilotModels);
        const supplement = (merged.copilot ?? []).filter((m: string) => !existing.has(m));
        merged.copilot = [...new Set([...copilotModels, ...supplement])];
      } else if (merged.copilot) {
        merged.copilot = [...new Set(merged.copilot)];
      }

      if (!merged.copilot || merged.copilot.length === 0) {
        merged.copilot = [
          "github-copilot/claude-sonnet-4.6",
          "github-copilot/claude-sonnet-4.5",
          "github-copilot/claude-3.7-sonnet",
          "github-copilot/claude-3.5-sonnet",
          "github-copilot/gpt-4o",
          "github-copilot/gpt-4.1",
          "github-copilot/o4-mini",
          "github-copilot/gemini-2.5-pro",
        ];
      }

      if (!merged.antigravity || merged.antigravity.length === 0) {
        merged.antigravity = [
          "google/antigravity-gemini-3-pro",
          "google/antigravity-gemini-3-flash",
          "google/antigravity-claude-sonnet-4-5",
          "google/antigravity-claude-sonnet-4-5-thinking",
          "google/antigravity-claude-opus-4-5-thinking",
          "google/antigravity-claude-opus-4-6-thinking",
        ];
      }

      cachedModelsRef.cachedModels = { data: merged, loadedAt: Date.now() };
      writeModelCache("oauth_models_cache", merged);
      res.json({ models: merged });
    } catch (err) {
      res.status(500).json({ error: "model_fetch_failed", message: String(err) });
    }
  });
}
