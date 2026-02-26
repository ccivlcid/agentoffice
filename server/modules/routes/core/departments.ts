// @ts-nocheck
/**
 * Core API: departments list, detail, CRUD, and reorder.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";

export function registerCoreDepartments(ctx: RuntimeContext): void {
  const { app, db, broadcast, nowMs } = ctx;

  app.get("/api/departments", (_req, res) => {
    const departments = db.prepare(`
      SELECT d.*,
        (SELECT COUNT(*) FROM agents a WHERE a.department_id = d.id) AS agent_count
      FROM departments d
      ORDER BY d.sort_order ASC
    `).all();
    res.json({ departments });
  });

  // ---- Reorder (MUST be before /:id routes) ----
  app.patch("/api/departments/reorder", (req, res) => {
    const { order } = req.body ?? {};
    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: "order_required" });
    }
    // Step 1: set all to negative temporary values to avoid UNIQUE conflict
    for (let i = 0; i < order.length; i++) {
      db.prepare("UPDATE departments SET sort_order = ? WHERE id = ?").run(-(i + 1), order[i]);
    }
    // Step 2: set final values
    for (let i = 0; i < order.length; i++) {
      db.prepare("UPDATE departments SET sort_order = ? WHERE id = ?").run(i * 10, order[i]);
    }
    broadcast("departments_changed", null);
    res.json({ ok: true });
  });

  // ---- Create department ----
  app.post("/api/departments", (req, res) => {
    const body = req.body ?? {};
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const name_ko = typeof body.name_ko === "string" ? body.name_ko.trim() : "";

    if (!id) return res.status(400).json({ error: "id_required" });
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
      return res.status(400).json({ error: "invalid_id_format", pattern: "a-z0-9 with hyphens" });
    }
    if (!name) return res.status(400).json({ error: "name_required" });
    if (!name_ko) return res.status(400).json({ error: "name_ko_required" });

    const existing = db.prepare("SELECT id FROM departments WHERE id = ?").get(id);
    if (existing) return res.status(409).json({ error: "id_already_exists" });

    const name_ja = typeof body.name_ja === "string" ? body.name_ja.trim() || null : null;
    const name_zh = typeof body.name_zh === "string" ? body.name_zh.trim() || null : null;
    const icon = typeof body.icon === "string" ? body.icon.trim() || "📁" : "📁";
    const color = typeof body.color === "string" ? body.color.trim() || "#6B7280" : "#6B7280";
    const description = typeof body.description === "string" ? body.description.trim() || null : null;
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() || null : null;

    // sort_order: MAX + 10
    const maxRow = db.prepare("SELECT MAX(sort_order) AS mx FROM departments").get() as { mx: number | null };
    const sort_order = typeof body.sort_order === "number" ? body.sort_order : ((maxRow?.mx ?? 0) + 10);

    db.prepare(`
      INSERT INTO departments (id, name, name_ko, name_ja, name_zh, icon, color, description, prompt, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, name_ko, name_ja, name_zh, icon, color, description, prompt, sort_order);

    const department = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    broadcast("departments_changed", null);
    res.json({ ok: true, department });
  });

  app.get("/api/departments/:id", (req, res) => {
    const id = String(req.params.id);
    const department = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    if (!department) return res.status(404).json({ error: "not_found" });

    const agents = db.prepare("SELECT * FROM agents WHERE department_id = ? ORDER BY role, name").all(id);
    res.json({ department, agents });
  });

  // ---- Edit department ----
  app.patch("/api/departments/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "not_found" });

    const body = req.body ?? {};
    const allowedFields = ["name", "name_ko", "name_ja", "name_zh", "icon", "color", "description", "prompt", "sort_order"];
    const updates: string[] = [];
    const params: unknown[] = [];

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: "no_fields_to_update" });

    params.push(id);
    db.prepare(`UPDATE departments SET ${updates.join(", ")} WHERE id = ?`).run(...params);

    const department = db.prepare("SELECT * FROM departments WHERE id = ?").get(id);
    broadcast("departments_changed", null);
    res.json({ ok: true, department });
  });

  // ---- Delete department ----
  app.delete("/api/departments/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT id FROM departments WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "not_found" });

    const agentCount = (db.prepare("SELECT COUNT(*) AS cnt FROM agents WHERE department_id = ?").get(id) as { cnt: number }).cnt;
    if (agentCount > 0) {
      return res.status(409).json({ error: "has_agents", agent_count: agentCount, message: "Delete or reassign agents first." });
    }

    const taskCount = (db.prepare("SELECT COUNT(*) AS cnt FROM tasks WHERE department_id = ?").get(id) as { cnt: number }).cnt;
    if (taskCount > 0) {
      return res.status(409).json({ error: "has_tasks", task_count: taskCount, message: "Delete or reassign tasks first." });
    }

    db.prepare("DELETE FROM departments WHERE id = ?").run(id);
    broadcast("departments_changed", null);
    res.json({ ok: true });
  });
}
