// @ts-nocheck
/**
 * Project rules CRUD routes.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import { RULE_PRESETS, syncRulesToFiles } from "./rules-helpers.ts";

export function registerOpsRules(ctx: RuntimeContext): void {
  const { app, db, nowMs } = ctx;

  app.get("/api/rules", (req: any, res: any) => {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    let sql = "SELECT * FROM project_rules";
    const params: unknown[] = [];
    if (search) {
      sql += " WHERE (LOWER(name) LIKE ? OR LOWER(title) LIKE ? OR LOWER(description) LIKE ?)";
      const pat = `%${search}%`;
      params.push(pat, pat, pat);
    }
    sql += " ORDER BY updated_at DESC";
    const rows = db.prepare(sql).all(...params);
    res.json({ ok: true, rules: rows });
  });

  app.post("/api/rules", (req: any, res: any) => {
    const { name, title, description, content, category, globs, always_apply, providers, source } = req.body ?? {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: "name_required" });
    const id = randomUUID();
    const now = nowMs();
    db.prepare(
      `INSERT INTO project_rules (id, name, title, description, content, category, globs, always_apply, providers, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      String(name).trim(),
      String(title ?? "").trim(),
      String(description ?? "").trim(),
      String(content ?? "").trim(),
      String(category ?? "general").trim(),
      typeof globs === "string" ? globs : JSON.stringify(globs ?? []),
      always_apply ? 1 : 0,
      typeof providers === "string" ? providers : JSON.stringify(providers ?? []),
      String(source ?? "manual"),
      now,
      now,
    );
    res.json({ ok: true, id });
  });

  app.put("/api/rules/:id", (req: any, res: any) => {
    const { id } = req.params;
    const body = req.body ?? {};
    const updates: string[] = ["updated_at = ?"];
    const params: unknown[] = [nowMs()];
    for (const key of ["name", "title", "description", "content", "category", "source"] as const) {
      if (key in body && body[key] != null) {
        updates.push(`${key} = ?`);
        params.push(String(body[key]).trim());
      }
    }
    if ("globs" in body) { updates.push("globs = ?"); params.push(typeof body.globs === "string" ? body.globs : JSON.stringify(body.globs ?? [])); }
    if ("always_apply" in body) { updates.push("always_apply = ?"); params.push(body.always_apply ? 1 : 0); }
    if ("providers" in body) { updates.push("providers = ?"); params.push(typeof body.providers === "string" ? body.providers : JSON.stringify(body.providers ?? [])); }
    if ("enabled" in body) { updates.push("enabled = ?"); params.push(body.enabled ? 1 : 0); }
    params.push(id);
    const result = db.prepare(`UPDATE project_rules SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.delete("/api/rules/:id", (req: any, res: any) => {
    const result = db.prepare("DELETE FROM project_rules WHERE id = ?").run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.post("/api/rules/:id/toggle", (req: any, res: any) => {
    const row = db.prepare("SELECT enabled FROM project_rules WHERE id = ?").get(req.params.id) as { enabled: number } | undefined;
    if (!row) return res.status(404).json({ error: "not_found" });
    const newEnabled = row.enabled ? 0 : 1;
    db.prepare("UPDATE project_rules SET enabled = ?, updated_at = ? WHERE id = ?").run(newEnabled, nowMs(), req.params.id);
    res.json({ ok: true, enabled: newEnabled });
  });

  app.post("/api/rules/sync", (_req: any, res: any) => {
    try {
      const result = syncRulesToFiles(db);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: "sync_failed", message: String(err) });
    }
  });

  app.get("/api/rules/presets", (_req: any, res: any) => {
    res.json({ ok: true, presets: RULE_PRESETS });
  });
}
