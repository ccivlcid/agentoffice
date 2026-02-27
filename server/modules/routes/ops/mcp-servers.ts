// @ts-nocheck
/**
 * MCP server CRUD routes.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import { MCP_PRESETS, syncMcpToFiles } from "./mcp-servers-helpers.ts";

export function registerOpsMcpServers(ctx: RuntimeContext): void {
  const { app, db, nowMs } = ctx;

  app.get("/api/mcp-servers", (req: any, res: any) => {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    let sql = "SELECT * FROM mcp_servers";
    const params: unknown[] = [];
    if (search) {
      sql += " WHERE (LOWER(name) LIKE ? OR LOWER(server_key) LIKE ? OR LOWER(package) LIKE ? OR LOWER(description) LIKE ?)";
      const pat = `%${search}%`;
      params.push(pat, pat, pat, pat);
    }
    sql += " ORDER BY updated_at DESC";
    const rows = db.prepare(sql).all(...params);
    res.json({ ok: true, servers: rows });
  });

  app.post("/api/mcp-servers", (req: any, res: any) => {
    const { name, server_key, package: pkg, command, args, env, description, category, providers, source } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });
    if (!server_key || !String(server_key).trim()) return res.status(400).json({ error: "server_key_required" });
    const id = randomUUID();
    const now = nowMs();
    try {
      db.prepare(
        `INSERT INTO mcp_servers (id, name, server_key, package, command, args, env, description, category, providers, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        String(name).trim(),
        String(server_key).trim(),
        String(pkg ?? "").trim(),
        String(command ?? "npx").trim(),
        typeof args === "string" ? args : JSON.stringify(args ?? []),
        typeof env === "string" ? env : JSON.stringify(env ?? {}),
        String(description ?? "").trim(),
        String(category ?? "other").trim(),
        typeof providers === "string" ? providers : JSON.stringify(providers ?? []),
        String(source ?? "manual"),
        now,
        now,
      );
    } catch (err: any) {
      if (err?.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return res.status(409).json({ error: "server_key_duplicate" });
      }
      throw err;
    }
    res.json({ ok: true, id });
  });

  app.put("/api/mcp-servers/:id", (req: any, res: any) => {
    const { id } = req.params;
    const body = req.body ?? {};
    const updates: string[] = ["updated_at = ?"];
    const params: unknown[] = [nowMs()];
    for (const [key, col] of [
      ["name", "name"], ["server_key", "server_key"], ["package", "package"],
      ["command", "command"], ["description", "description"], ["category", "category"],
      ["source", "source"],
    ] as const) {
      if (key in body && body[key] != null) {
        updates.push(`${col} = ?`);
        params.push(String(body[key]).trim());
      }
    }
    if ("args" in body) { updates.push("args = ?"); params.push(typeof body.args === "string" ? body.args : JSON.stringify(body.args ?? [])); }
    if ("env" in body) { updates.push("env = ?"); params.push(typeof body.env === "string" ? body.env : JSON.stringify(body.env ?? {})); }
    if ("providers" in body) { updates.push("providers = ?"); params.push(typeof body.providers === "string" ? body.providers : JSON.stringify(body.providers ?? [])); }
    if ("enabled" in body) { updates.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }
    params.push(id);
    const result = db.prepare(`UPDATE mcp_servers SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.delete("/api/mcp-servers/:id", (req: any, res: any) => {
    const result = db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.post("/api/mcp-servers/:id/toggle", (req: any, res: any) => {
    const row = db.prepare("SELECT enabled FROM mcp_servers WHERE id = ?").get(req.params.id) as { enabled: number } | undefined;
    if (!row) return res.status(404).json({ error: "not_found" });
    const newEnabled = row.enabled ? 0 : 1;
    db.prepare("UPDATE mcp_servers SET enabled = ?, updated_at = ? WHERE id = ?").run(newEnabled, nowMs(), req.params.id);
    res.json({ ok: true, enabled: newEnabled });
  });

  app.post("/api/mcp-servers/sync", (_req: any, res: any) => {
    try {
      const result = syncMcpToFiles(db);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: "sync_failed", message: String(err) });
    }
  });

  app.get("/api/mcp-servers/presets", (_req: any, res: any) => {
    res.json({ ok: true, presets: MCP_PRESETS });
  });
}
