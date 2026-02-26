// @ts-nocheck
/**
 * Custom skills CRUD routes.
 * Manages user-registered skills in the local library.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const CUSTOM_SKILLS_DIR = resolve(process.cwd(), "custom-skills");

function ensureCustomSkillsDir(): void {
  if (!existsSync(CUSTOM_SKILLS_DIR)) {
    mkdirSync(CUSTOM_SKILLS_DIR, { recursive: true });
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 100);
}

export function registerOpsSkillDocuments(ctx: RuntimeContext): void {
  const { app, db, nowMs } = ctx;

  // ---- Basic custom_skills CRUD ----

  app.get("/api/custom-skills", (req: any, res: any) => {
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const category = String(req.query.category ?? "").trim();

    let sql = "SELECT * FROM custom_skills";
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (category) {
      conditions.push("category = ?");
      params.push(category);
    }
    if (search) {
      conditions.push("(LOWER(name) LIKE ? OR LOWER(repo) LIKE ? OR LOWER(description) LIKE ?)");
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }
    if (conditions.length > 0) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY updated_at DESC";

    const rows = db.prepare(sql).all(...params);
    res.json({ ok: true, skills: rows });
  });

  app.post("/api/custom-skills", (req: any, res: any) => {
    const { name, skill_id, repo, category, description, installs } = req.body ?? {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const id = randomUUID();
    const now = nowMs();
    db.prepare(
      "INSERT INTO custom_skills (id, name, skill_id, repo, category, description, installs, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      String(name).trim(),
      String(skill_id ?? name).trim(),
      String(repo ?? "").trim(),
      category || null,
      String(description ?? "").trim(),
      typeof installs === "number" ? installs : 0,
      now,
      now,
    );
    res.json({ ok: true, id });
  });

  app.put("/api/custom-skills/:id", (req: any, res: any) => {
    const { id } = req.params;
    const body = req.body ?? {};
    const updates: string[] = ["updated_at = ?"];
    const params: unknown[] = [nowMs()];

    if ("name" in body && body.name) {
      updates.push("name = ?");
      params.push(String(body.name).trim());
    }
    if ("skill_id" in body) {
      updates.push("skill_id = ?");
      params.push(String(body.skill_id ?? "").trim());
    }
    if ("repo" in body) {
      updates.push("repo = ?");
      params.push(String(body.repo ?? "").trim());
    }
    if ("category" in body) {
      updates.push("category = ?");
      params.push(body.category || null);
    }
    if ("description" in body) {
      updates.push("description = ?");
      params.push(String(body.description ?? "").trim());
    }
    if ("installs" in body) {
      updates.push("installs = ?");
      params.push(typeof body.installs === "number" ? body.installs : 0);
    }

    params.push(id);
    const result = db.prepare(
      `UPDATE custom_skills SET ${updates.join(", ")} WHERE id = ?`
    ).run(...params);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  app.delete("/api/custom-skills/:id", (req: any, res: any) => {
    const { id } = req.params;
    // Also cleanup file if we can resolve name
    const row = db.prepare("SELECT name FROM custom_skills WHERE id = ?").get(id) as { name: string } | undefined;
    if (row) {
      const filePath = join(CUSTOM_SKILLS_DIR, `${sanitizeFilename(row.name)}.md`);
      try { unlinkSync(filePath); } catch { /* file may not exist */ }
    }
    const result = db.prepare("DELETE FROM custom_skills WHERE id = ?").run(id);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });

  // ---- Custom skill upload with .md file + learning history ----

  app.post("/api/skills/custom", (req: any, res: any) => {
    const { name, content, provider } = req.body ?? {};
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name_required" });
    }
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "content_required" });
    }
    if (!provider || typeof provider !== "string") {
      return res.status(400).json({ error: "provider_required" });
    }

    ensureCustomSkillsDir();
    const safeName = sanitizeFilename(name.trim());
    const filePath = join(CUSTOM_SKILLS_DIR, `${safeName}.md`);
    writeFileSync(filePath, content, "utf-8");

    const id = randomUUID();
    const now = nowMs();
    const skillId = safeName;

    // Insert into custom_skills
    db.prepare(
      "INSERT INTO custom_skills (id, name, skill_id, repo, category, description, installs, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(id, name.trim(), skillId, "local", "custom", `Custom skill: ${name.trim()}`, 0, now, now);

    // Insert into skill_learning_history
    const historyId = randomUUID();
    const jobId = `custom-upload-${safeName}-${Date.now()}`;
    db.prepare(`
      INSERT INTO skill_learning_history (id, job_id, provider, repo, skill_id, skill_label, status, command, run_started_at, run_completed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'succeeded', ?, ?, ?, ?, ?)
    `).run(historyId, jobId, provider, "local", skillId, name.trim(), "custom-upload", now, now, now, now);

    const skill = db.prepare("SELECT * FROM custom_skills WHERE id = ?").get(id);
    res.json({ ok: true, skill });
  });

  app.get("/api/skills/custom", (_req: any, res: any) => {
    const rows = db.prepare("SELECT * FROM custom_skills ORDER BY updated_at DESC").all();
    res.json({ ok: true, skills: rows });
  });

  app.delete("/api/skills/custom/:skillName", (req: any, res: any) => {
    const skillName = String(req.params.skillName);
    const safeName = sanitizeFilename(skillName);
    const filePath = join(CUSTOM_SKILLS_DIR, `${safeName}.md`);
    try { unlinkSync(filePath); } catch { /* file may not exist */ }

    const result = db.prepare("DELETE FROM custom_skills WHERE name = ? OR skill_id = ?").run(skillName, safeName);
    if (result.changes === 0) return res.status(404).json({ error: "not_found" });
    res.json({ ok: true });
  });
}
