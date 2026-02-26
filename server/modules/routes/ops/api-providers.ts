// @ts-nocheck
/**
 * API providers (direct API key-based LLM) routes.
 * Extracted from ops.ts to keep single-file line count under 300.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import { encryptSecret, decryptSecret } from "../../../oauth/helpers.ts";

const API_PROVIDER_PRESETS: Record<string, { base_url: string; models_path: string; auth_header: string }> = {
  openai:     { base_url: "https://api.openai.com/v1",       models_path: "/models", auth_header: "Bearer" },
  anthropic:  { base_url: "https://api.anthropic.com/v1",    models_path: "/models", auth_header: "x-api-key" },
  google:     { base_url: "https://generativelanguage.googleapis.com/v1beta", models_path: "/models", auth_header: "key" },
  ollama:     { base_url: "http://localhost:11434/v1",        models_path: "/models", auth_header: "" },
  openrouter: { base_url: "https://openrouter.ai/api/v1",    models_path: "/models", auth_header: "Bearer" },
  together:   { base_url: "https://api.together.xyz/v1",     models_path: "/models", auth_header: "Bearer" },
  groq:       { base_url: "https://api.groq.com/openai/v1",  models_path: "/models", auth_header: "Bearer" },
  cerebras:   { base_url: "https://api.cerebras.ai/v1",      models_path: "/models", auth_header: "Bearer" },
  custom:     { base_url: "",                                 models_path: "/models", auth_header: "Bearer" },
};

function buildApiProviderHeaders(type: string, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (!apiKey) return headers;
  if (type === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  } else if (type === "google") {
    // Google uses ?key= query param, handled separately
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  return headers;
}

function normalizeApiBaseUrl(rawUrl: string): string {
  let url = rawUrl.replace(/\/+$/, "");
  url = url.replace(/\/v1\/(chat\/completions|models|messages)$/i, "/v1");
  url = url.replace(/\/v1beta\/models\/.+$/i, "/v1beta");
  return url;
}

function buildModelsUrl(type: string, baseUrl: string, apiKey: string): string {
  const preset = API_PROVIDER_PRESETS[type] || API_PROVIDER_PRESETS.custom;
  const base = normalizeApiBaseUrl(baseUrl);
  let url = `${base}${preset.models_path}`;
  if (type === "google" && apiKey) {
    url += `?key=${encodeURIComponent(apiKey)}`;
  }
  return url;
}

function extractModelIds(type: string, data: any): string[] {
  const models: string[] = [];
  if (type === "google") {
    if (Array.isArray(data?.models)) {
      for (const m of data.models) {
        const name = m.name || m.model || "";
        if (name) models.push(name.replace(/^models\//, ""));
      }
    }
  } else if (type === "anthropic") {
    if (Array.isArray(data?.data)) {
      for (const m of data.data) {
        if (m.id) models.push(m.id);
      }
    }
  } else {
    // OpenAI-compatible: { data: [{ id: "gpt-4o", ... }] } or { models: [...] }
    if (Array.isArray(data?.data)) {
      for (const m of data.data) {
        if (m.id) models.push(m.id);
      }
    } else if (Array.isArray(data?.models)) {
      for (const m of data.models) {
        const id = m.id || m.name || m.model || "";
        if (id) models.push(id);
      }
    }
  }
  return models.sort();
}

export function registerOpsApiProviders(ctx: RuntimeContext): void {
  const { app, db, nowMs } = ctx;

  app.get("/api/api-providers", (_req: any, res: any) => {
    const rows = db.prepare("SELECT * FROM api_providers ORDER BY created_at ASC").all() as any[];
    const providers = rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      base_url: r.base_url,
      has_api_key: Boolean(r.api_key_enc),
      enabled: Boolean(r.enabled),
      models_cache: r.models_cache ? JSON.parse(r.models_cache) : [],
      models_cached_at: r.models_cached_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
    res.json({ ok: true, providers });
  });

  app.post("/api/api-providers", (req: any, res: any) => {
    const { name, type = "openai", base_url, api_key } = req.body;
    if (!name || !base_url) {
      return res.status(400).json({ error: "name and base_url are required" });
    }
    const validTypes = Object.keys(API_PROVIDER_PRESETS);
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(", ")}` });
    }
    const id = randomUUID();
    const now = nowMs();
    const apiKeyEnc = api_key ? encryptSecret(api_key) : null;
    db.prepare(
      "INSERT INTO api_providers (id, name, type, base_url, api_key_enc, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, name.trim(), type, base_url.trim().replace(/\/+$/, ""), apiKeyEnc, now, now);
    res.json({ ok: true, id });
  });

  app.put("/api/api-providers/:id", (req: any, res: any) => {
    const { id } = req.params;
    const body = req.body;
    const updates: string[] = ["updated_at = ?"];
    const params: unknown[] = [nowMs()];
    if ("name" in body && body.name) { updates.push("name = ?"); params.push(body.name.trim()); }
    if ("type" in body) { updates.push("type = ?"); params.push(body.type); }
    if ("base_url" in body && body.base_url) { updates.push("base_url = ?"); params.push(body.base_url.trim().replace(/\/+$/, "")); }
    if ("api_key" in body) {
      updates.push("api_key_enc = ?");
      params.push(body.api_key ? encryptSecret(body.api_key) : null);
    }
    if ("enabled" in body) { updates.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }
    params.push(id);
    const result = db.prepare(`UPDATE api_providers SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.delete("/api/api-providers/:id", (req: any, res: any) => {
    const { id } = req.params;
    const result = db.prepare("DELETE FROM api_providers WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.post("/api/api-providers/:id/test", async (req: any, res: any) => {
    const { id } = req.params;
    const row = db.prepare("SELECT * FROM api_providers WHERE id = ?").get(id) as any;
    if (!row) return res.status(404).json({ error: "not_found" });
    const apiKey = row.api_key_enc ? decryptSecret(row.api_key_enc) : "";
    const url = buildModelsUrl(row.type, row.base_url, apiKey);
    const headers = buildApiProviderHeaders(row.type, apiKey);
    try {
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        return res.json({ ok: false, status: resp.status, error: errBody.slice(0, 500) });
      }
      const data = await resp.json() as any;
      const models = extractModelIds(row.type, data);
      const now = nowMs();
      db.prepare("UPDATE api_providers SET models_cache = ?, models_cached_at = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(models), now, now, id);
      res.json({ ok: true, model_count: models.length, models });
    } catch (e: any) {
      res.json({ ok: false, error: e.message || String(e) });
    }
  });

  app.get("/api/api-providers/:id/models", async (req: any, res: any) => {
    const { id } = req.params;
    const refresh = req.query.refresh === "true";
    const row = db.prepare("SELECT * FROM api_providers WHERE id = ?").get(id) as any;
    if (!row) return res.status(404).json({ error: "not_found" });
    if (!refresh && row.models_cache) {
      return res.json({ ok: true, models: JSON.parse(row.models_cache), cached: true });
    }
    const apiKey = row.api_key_enc ? decryptSecret(row.api_key_enc) : "";
    const url = buildModelsUrl(row.type, row.base_url, apiKey);
    const headers = buildApiProviderHeaders(row.type, apiKey);
    try {
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
      if (!resp.ok) {
        if (row.models_cache) {
          return res.json({ ok: true, models: JSON.parse(row.models_cache), cached: true, stale: true });
        }
        return res.status(502).json({ error: `upstream returned ${resp.status}` });
      }
      const data = await resp.json() as any;
      const models = extractModelIds(row.type, data);
      const now = nowMs();
      db.prepare("UPDATE api_providers SET models_cache = ?, models_cached_at = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(models), now, now, id);
      res.json({ ok: true, models, cached: false });
    } catch (e: any) {
      if (row.models_cache) {
        return res.json({ ok: true, models: JSON.parse(row.models_cache), cached: true, stale: true });
      }
      res.status(502).json({ error: e.message || String(e) });
    }
  });

  app.get("/api/api-providers/presets", (_req: any, res: any) => {
    res.json({ ok: true, presets: API_PROVIDER_PRESETS });
  });
}
