// @ts-nocheck
/**
 * Core API: projects CRUD, path-check, path-suggestions, path-native-picker, path-browse.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import {
  PROJECT_PATH_ALLOWED_ROOTS,
  isPathInsideAllowedRoots,
  findConflictingProjectByPath,
  inspectDirectoryPath,
  ensureDirectoryPathExists,
  normalizeProjectPathFromString,
} from "./project-path.ts";
import { registerCoreProjectsPaths } from "./projects-path.ts";

type SQLInputValue = string | number | null;

export function registerCoreProjects(ctx: RuntimeContext): void {
  const { app, db, firstQueryValue, normalizeTextField, nowMs } = ctx;

  function normalizeProjectPathInput(raw: unknown): string | null {
    const value = normalizeTextField(raw);
    if (!value) return null;
    return normalizeProjectPathFromString(value);
  }

  // Path utility routes extracted to projects-path.ts
  registerCoreProjectsPaths(ctx, normalizeProjectPathInput);

  app.get("/api/projects", (req, res) => {
    const page = Math.max(Number(firstQueryValue(req.query.page)) || 1, 1);
    const pageSizeRaw = Number(firstQueryValue(req.query.page_size)) || 10;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 50);
    const search = normalizeTextField(firstQueryValue(req.query.search));

    const conditions: string[] = [];
    const params: unknown[] = [];
    if (search) {
      conditions.push("(p.name LIKE ? OR p.project_path LIKE ? OR p.core_goal LIKE ?)");
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const totalRow = db.prepare(`
      SELECT COUNT(*) AS cnt
      FROM projects p
      ${where}
    `).get(...(params as SQLInputValue[])) as { cnt: number };
    const total = Number(totalRow?.cnt ?? 0) || 0;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;
    const offset = (page - 1) * pageSize;

    const rows = db.prepare(`
      SELECT p.*,
             (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
      FROM projects p
      ${where}
      ORDER BY COALESCE(p.last_used_at, p.updated_at) DESC, p.updated_at DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...([...(params as SQLInputValue[]), pageSize, offset] as SQLInputValue[]));

    // Batch-query project_agents for all projects
    const projectIds = (rows as Array<{ id: string }>).map(r => r.id);
    const agentAssignments: Record<string, string[]> = {};
    if (projectIds.length > 0) {
      const placeholders = projectIds.map(() => "?").join(",");
      const allPA = db.prepare(
        `SELECT project_id, agent_id FROM project_agents WHERE project_id IN (${placeholders})`
      ).all(...(projectIds as SQLInputValue[])) as { project_id: string; agent_id: string }[];
      for (const pa of allPA) {
        if (!agentAssignments[pa.project_id]) agentAssignments[pa.project_id] = [];
        agentAssignments[pa.project_id].push(pa.agent_id);
      }
    }
    const enrichedRows = (rows as Array<Record<string, unknown>>).map(r => ({
      ...r,
      assigned_agent_ids: agentAssignments[r.id as string] || [],
    }));

    res.json({
      projects: enrichedRows,
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    });
  });

  app.post("/api/projects", (req, res) => {
    const body = req.body ?? {};
    const name = normalizeTextField(body.name);
    const projectPath = normalizeProjectPathInput(body.project_path);
    const coreGoal = normalizeTextField(body.core_goal);
    const createPathIfMissing = body.create_path_if_missing !== false;
    if (!name) return res.status(400).json({ error: "name_required" });
    if (!projectPath) return res.status(400).json({ error: "project_path_required" });
    if (!coreGoal) return res.status(400).json({ error: "core_goal_required" });
    if (!isPathInsideAllowedRoots(projectPath)) {
      return res.status(403).json({
        error: "project_path_outside_allowed_roots",
        allowed_roots: PROJECT_PATH_ALLOWED_ROOTS,
      });
    }
    const conflictingProject = findConflictingProjectByPath(db, projectPath);
    if (conflictingProject) {
      return res.status(409).json({
        error: "project_path_conflict",
        existing_project_id: conflictingProject.id,
        existing_project_name: conflictingProject.name,
        existing_project_path: conflictingProject.project_path,
      });
    }
    const inspected = inspectDirectoryPath(projectPath);
    if (inspected.exists && !inspected.isDirectory) {
      return res.status(400).json({ error: "project_path_not_directory" });
    }
    if (!inspected.exists) {
      if (!createPathIfMissing) {
        return res.status(409).json({
          error: "project_path_not_found",
          normalized_path: projectPath,
          can_create: inspected.canCreate,
          nearest_existing_parent: inspected.nearestExistingParent,
        });
      }
      const ensureDir = ensureDirectoryPathExists(projectPath);
      if (!ensureDir.ok) {
        return res.status(400).json({ error: "project_path_unavailable", reason: ensureDir.reason });
      }
    }
    const githubRepo = typeof body.github_repo === "string" ? body.github_repo.trim() || null : null;
    const assignmentMode = body.assignment_mode === "manual" ? "manual" : "auto";
    const id = randomUUID();
    const t = nowMs();
    db.prepare(`
      INSERT INTO projects (id, name, project_path, core_goal, assignment_mode, last_used_at, created_at, updated_at, github_repo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, projectPath, coreGoal, assignmentMode, t, t, t, githubRepo);

    // Manual agent assignment
    if (assignmentMode === "manual" && Array.isArray(body.agent_ids)) {
      const agentIds = body.agent_ids as string[];
      for (const agentId of agentIds) {
        if (typeof agentId !== "string") continue;
        const agentExists = db.prepare("SELECT id FROM agents WHERE id = ?").get(agentId);
        if (!agentExists) return res.status(400).json({ error: "agent_not_found", agent_id: agentId });
      }
      const insertPA = db.prepare("INSERT INTO project_agents (project_id, agent_id) VALUES (?, ?)");
      for (const agentId of agentIds) {
        insertPA.run(id, agentId);
      }
    }

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    const assignedAgentIds = (db.prepare("SELECT agent_id FROM project_agents WHERE project_id = ?").all(id) as { agent_id: string }[]).map(r => r.agent_id);
    res.json({ ok: true, project: { ...(project as Record<string, unknown>), assigned_agent_ids: assignedAgentIds } });
  });

  app.patch("/api/projects/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "not_found" });

    const body = req.body ?? {};
    const updates: string[] = ["updated_at = ?"];
    const params: unknown[] = [nowMs()];
    const createPathIfMissing = body.create_path_if_missing !== false;

    if ("name" in body) {
      const value = normalizeTextField(body.name);
      if (!value) return res.status(400).json({ error: "name_required" });
      updates.push("name = ?");
      params.push(value);
    }
    if ("project_path" in body) {
      const value = normalizeProjectPathInput(body.project_path);
      if (!value) return res.status(400).json({ error: "project_path_required" });
      if (!isPathInsideAllowedRoots(value)) {
        return res.status(403).json({
          error: "project_path_outside_allowed_roots",
          allowed_roots: PROJECT_PATH_ALLOWED_ROOTS,
        });
      }
      const conflictingProject = findConflictingProjectByPath(db, value, id);
      if (conflictingProject) {
        return res.status(409).json({
          error: "project_path_conflict",
          existing_project_id: conflictingProject.id,
          existing_project_name: conflictingProject.name,
          existing_project_path: conflictingProject.project_path,
        });
      }
      const inspected = inspectDirectoryPath(value);
      if (inspected.exists && !inspected.isDirectory) {
        return res.status(400).json({ error: "project_path_not_directory" });
      }
      if (!inspected.exists) {
        if (!createPathIfMissing) {
          return res.status(409).json({
            error: "project_path_not_found",
            normalized_path: value,
            can_create: inspected.canCreate,
            nearest_existing_parent: inspected.nearestExistingParent,
          });
        }
        const ensureDir = ensureDirectoryPathExists(value);
        if (!ensureDir.ok) {
          return res.status(400).json({ error: "project_path_unavailable", reason: ensureDir.reason });
        }
      }
      updates.push("project_path = ?");
      params.push(value);
    }
    if ("core_goal" in body) {
      const value = normalizeTextField(body.core_goal);
      if (!value) return res.status(400).json({ error: "core_goal_required" });
      updates.push("core_goal = ?");
      params.push(value);
    }
    if ("github_repo" in body) {
      const value = typeof body.github_repo === "string" ? body.github_repo.trim() || null : null;
      updates.push("github_repo = ?");
      params.push(value);
    }
    if ("assignment_mode" in body) {
      const mode = body.assignment_mode;
      if (mode !== "auto" && mode !== "manual") return res.status(400).json({ error: "invalid_assignment_mode" });
      updates.push("assignment_mode = ?");
      params.push(mode);
    }

    const hasAgentIds = "agent_ids" in body;
    if (hasAgentIds) {
      if (!Array.isArray(body.agent_ids)) return res.status(400).json({ error: "invalid_agent_ids" });
      for (const agentId of body.agent_ids) {
        if (typeof agentId !== "string") return res.status(400).json({ error: "invalid_agent_ids" });
        const agentExists = db.prepare("SELECT id FROM agents WHERE id = ?").get(agentId);
        if (!agentExists) return res.status(400).json({ error: "agent_not_found", agent_id: agentId });
      }
    }

    if (updates.length <= 1 && !hasAgentIds) return res.status(400).json({ error: "no_fields" });
    params.push(id);
    if (updates.length > 1) {
      db.prepare(`UPDATE projects SET ${updates.join(", ")} WHERE id = ?`).run(
        ...(params as SQLInputValue[])
      );
    }

    // Update project agents
    if (hasAgentIds) {
      db.prepare("DELETE FROM project_agents WHERE project_id = ?").run(id);
      const insertPA = db.prepare("INSERT INTO project_agents (project_id, agent_id) VALUES (?, ?)");
      for (const agentId of body.agent_ids as string[]) {
        insertPA.run(id, agentId);
      }
    }

    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    const assignedAgentIds = (db.prepare("SELECT agent_id FROM project_agents WHERE project_id = ?").all(id) as { agent_id: string }[]).map(r => r.agent_id);
    res.json({ ok: true, project: { ...(project as Record<string, unknown>), assigned_agent_ids: assignedAgentIds } });
  });

  app.delete("/api/projects/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT id FROM projects WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    db.prepare("UPDATE tasks SET project_id = NULL WHERE project_id = ?").run(id);
    db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  app.get("/api/projects/:id", (req, res) => {
    const id = String(req.params.id);
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    if (!project) return res.status(404).json({ error: "not_found" });

    const tasks = db.prepare(`
      SELECT t.id, t.title, t.status, t.task_type, t.priority, t.created_at, t.updated_at, t.completed_at,
             t.source_task_id,
             t.assigned_agent_id,
             COALESCE(a.name, '') AS assigned_agent_name,
             COALESCE(a.name_ko, '') AS assigned_agent_name_ko
      FROM tasks t
      LEFT JOIN agents a ON a.id = t.assigned_agent_id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
      LIMIT 300
    `).all(id);

    const reports = db.prepare(`
      SELECT t.id, t.title, t.completed_at, t.created_at, t.assigned_agent_id,
             COALESCE(a.name, '') AS agent_name,
             COALESCE(a.name_ko, '') AS agent_name_ko,
             COALESCE(d.name, '') AS dept_name,
             COALESCE(d.name_ko, '') AS dept_name_ko
      FROM tasks t
      LEFT JOIN agents a ON a.id = t.assigned_agent_id
      LEFT JOIN departments d ON d.id = t.department_id
      WHERE t.project_id = ?
        AND t.status = 'done'
        AND (t.source_task_id IS NULL OR TRIM(t.source_task_id) = '')
      ORDER BY t.completed_at DESC, t.created_at DESC
      LIMIT 200
    `).all(id);

    const decisionEvents = db.prepare(`
      SELECT
        id,
        snapshot_hash,
        event_type,
        summary,
        selected_options_json,
        note,
        task_id,
        meeting_id,
        created_at
      FROM project_review_decision_events
      WHERE project_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 300
    `).all(id);

    const assignedAgentIds = (db.prepare("SELECT agent_id FROM project_agents WHERE project_id = ?").all(id) as { agent_id: string }[]).map(r => r.agent_id);
    res.json({ project: { ...(project as Record<string, unknown>), assigned_agent_ids: assignedAgentIds }, tasks, reports, decision_events: decisionEvents });
  });
}
