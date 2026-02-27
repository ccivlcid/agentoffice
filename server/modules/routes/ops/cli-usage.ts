// @ts-nocheck
/**
 * CLI usage stats API (cache + refresh). Returns refreshCliUsageData for RouteOpsExports.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";

type CliUsageEntry = { windows: unknown[]; error?: string };

export function registerOpsCliUsage(ctx: RuntimeContext): { refreshCliUsageData: () => Promise<Record<string, CliUsageEntry>> } {
  const { app, db, nowMs, broadcast, CLI_TOOLS, fetchClaudeUsage, fetchCodexUsage, fetchGeminiUsage, fetchCursorUsage } = ctx;

  function readCliUsageFromDb(): Record<string, CliUsageEntry> {
    const rows = db.prepare("SELECT provider, data_json FROM cli_usage_cache").all() as Array<{ provider: string; data_json: string }>;
    const usage: Record<string, CliUsageEntry> = {};
    for (const row of rows) {
      try { usage[row.provider] = JSON.parse(row.data_json); } catch { /* skip corrupt */ }
    }
    return usage;
  }

  async function refreshCliUsageData(): Promise<Record<string, CliUsageEntry>> {
    const providers = ["claude", "codex", "gemini", "cursor", "copilot", "antigravity"];
    const usage: Record<string, CliUsageEntry> = {};
    const fetchMap: Record<string, () => Promise<CliUsageEntry>> = {
      claude: fetchClaudeUsage,
      codex: fetchCodexUsage,
      gemini: fetchGeminiUsage,
      cursor: fetchCursorUsage,
    };

    const fetches = providers.map(async (p) => {
      try {
        const tool = CLI_TOOLS.find((t: any) => t.name === p || (t as any).displayName === p);
        if (!tool) {
          usage[p] = { windows: [], error: "not_implemented" };
          return;
        }
        if (!tool.checkAuth()) {
          usage[p] = { windows: [], error: "unauthenticated" };
          return;
        }
        const fetcher = fetchMap[p];
        if (fetcher) {
          usage[p] = await fetcher();
        } else {
          usage[p] = { windows: [], error: "not_implemented" };
        }
      } catch (e) {
        usage[p] = { windows: [], error: String(e) };
      }
    });

    await Promise.all(fetches);

    const upsert = db.prepare(
      "INSERT INTO cli_usage_cache (provider, data_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(provider) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at"
    );
    const now = nowMs();
    for (const [p, entry] of Object.entries(usage)) {
      upsert.run(p, JSON.stringify(entry), now);
    }
    return usage;
  }

  app.get("/api/cli-usage", async (_req: any, res: any) => {
    let usage = readCliUsageFromDb();
    if (Object.keys(usage).length === 0) {
      try {
        usage = await refreshCliUsageData();
      } catch (e) {
        console.error("[api] cli-usage refresh failed:", e);
        usage = {};
      }
    }
    res.json({ ok: true, usage });
  });

  app.post("/api/cli-usage/refresh", async (_req: any, res: any) => {
    try {
      const usage = await refreshCliUsageData();
      broadcast("cli_usage_update", usage);
      res.json({ ok: true, usage });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e) });
    }
  });

  return { refreshCliUsageData };
}
