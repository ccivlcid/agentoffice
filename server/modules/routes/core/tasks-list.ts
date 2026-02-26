// @ts-nocheck
/**
 * Core API: tasks list and detail routes.
 * GET /api/tasks, POST /api/tasks, GET /api/tasks/:id, GET /api/tasks/:id/meeting-minutes
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import { normalizeProjectPathFromString } from "./project-path.ts";

type SQLInputValue = string | number | null;

export function registerCoreTasksList(ctx: RuntimeContext): void {
  const {
    app,
    db,
    broadcast,
    nowMs,
    reconcileCrossDeptSubtasks,
    firstQueryValue,
    normalizeTextField,
    appendTaskLog,
    recordTaskCreationAudit,
  } = ctx;

  function normalizeProjectPathInput(raw: unknown): string | null {
    const value = normalizeTextField(raw);
    if (!value) return null;
    return normalizeProjectPathFromString(value);
  }

  // ---------------------------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------------------------
  app.get("/api/tasks", (req, res) => {
    reconcileCrossDeptSubtasks();
    const statusFilter = firstQueryValue(req.query.status);
    const deptFilter = firstQueryValue(req.query.department_id);
    const agentFilter = firstQueryValue(req.query.agent_id);
    const projectFilter = firstQueryValue(req.query.project_id);

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (statusFilter) {
      conditions.push("t.status = ?");
      params.push(statusFilter);
    }
    if (deptFilter) {
      conditions.push("t.department_id = ?");
      params.push(deptFilter);
    }
    if (agentFilter) {
      conditions.push("t.assigned_agent_id = ?");
      params.push(agentFilter);
    }
    if (projectFilter) {
      conditions.push("t.project_id = ?");
      params.push(projectFilter);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const subtaskTotalExpr = `(
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id)
    +
    (SELECT COUNT(*)
     FROM tasks c
     WHERE c.source_task_id = t.id
       AND NOT EXISTS (
         SELECT 1
         FROM subtasks s2
         WHERE s2.task_id = t.id
           AND s2.delegated_task_id = c.id
       )
    )
  )`;
    const subtaskDoneExpr = `(
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'done')
    +
    (SELECT COUNT(*)
     FROM tasks c
     WHERE c.source_task_id = t.id
       AND c.status = 'done'
       AND NOT EXISTS (
         SELECT 1
         FROM subtasks s2
         WHERE s2.task_id = t.id
           AND s2.delegated_task_id = c.id
       )
    )
  )`;

    const tasks = db.prepare(`
    SELECT t.*,
      a.name AS agent_name,
      a.avatar_emoji AS agent_avatar,
      d.name AS department_name,
      d.icon AS department_icon,
      p.name AS project_name,
      p.core_goal AS project_core_goal,
      ${subtaskTotalExpr} AS subtask_total,
      ${subtaskDoneExpr} AS subtask_done
    FROM tasks t
    LEFT JOIN agents a ON t.assigned_agent_id = a.id
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN projects p ON t.project_id = p.id
    ${where}
    ORDER BY t.priority DESC, t.updated_at DESC
  `).all(...(params as SQLInputValue[]));

    res.json({ tasks });
  });

  app.post("/api/tasks", (req, res) => {
    const body = req.body ?? {};
    const id = randomUUID();
    const t = nowMs();

    const title = body.title;
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title_required" });
    }

    const requestedProjectId = normalizeTextField(body.project_id);
    let resolvedProjectId: string | null = null;
    let resolvedProjectPath = normalizeProjectPathInput(body.project_path);
    if (requestedProjectId) {
      const project = db.prepare("SELECT id, project_path FROM projects WHERE id = ?").get(requestedProjectId) as {
        id: string;
        project_path: string;
      } | undefined;
      if (!project) return res.status(400).json({ error: "project_not_found" });
      resolvedProjectId = project.id;
      if (!resolvedProjectPath) resolvedProjectPath = normalizeTextField(project.project_path);
    } else if (resolvedProjectPath) {
      const projectByPath = db.prepare(
        "SELECT id, project_path FROM projects WHERE project_path = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1"
      ).get(resolvedProjectPath) as { id: string; project_path: string } | undefined;
      if (projectByPath) {
        resolvedProjectId = projectByPath.id;
        resolvedProjectPath = normalizeTextField(projectByPath.project_path) ?? resolvedProjectPath;
      }
    }

    db.prepare(`
    INSERT INTO tasks (id, title, description, department_id, assigned_agent_id, project_id, status, priority, task_type, project_path, base_branch, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
      id,
      title,
      body.description ?? null,
      body.department_id ?? null,
      body.assigned_agent_id ?? null,
      resolvedProjectId,
      body.status ?? "inbox",
      body.priority ?? 0,
      body.task_type ?? "general",
      resolvedProjectPath,
      body.base_branch ?? null,
      t,
      t,
    );
    recordTaskCreationAudit({
      taskId: id,
      taskTitle: title,
      taskStatus: String(body.status ?? "inbox"),
      departmentId: typeof body.department_id === "string" ? body.department_id : null,
      assignedAgentId: typeof body.assigned_agent_id === "string" ? body.assigned_agent_id : null,
      taskType: typeof body.task_type === "string" ? body.task_type : "general",
      projectPath: resolvedProjectPath,
      trigger: "api.tasks.create",
      triggerDetail: "POST /api/tasks",
      actorType: "api_client",
      req,
      body: typeof body === "object" && body ? body as Record<string, unknown> : null,
    });

    if (resolvedProjectId) {
      db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(t, t, resolvedProjectId);
    }

    appendTaskLog(id, "system", `Task created: ${title}`);

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    broadcast("task_update", task);
    res.json({ id, task });
  });

  app.get("/api/tasks/:id", (req, res) => {
    const id = String(req.params.id);
    reconcileCrossDeptSubtasks(id);
    const subtaskTotalExpr = `(
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id)
    +
    (SELECT COUNT(*)
     FROM tasks c
     WHERE c.source_task_id = t.id
       AND NOT EXISTS (
         SELECT 1
         FROM subtasks s2
         WHERE s2.task_id = t.id
           AND s2.delegated_task_id = c.id
       )
    )
  )`;
    const subtaskDoneExpr = `(
    (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.status = 'done')
    +
    (SELECT COUNT(*)
     FROM tasks c
     WHERE c.source_task_id = t.id
       AND c.status = 'done'
       AND NOT EXISTS (
         SELECT 1
         FROM subtasks s2
         WHERE s2.task_id = t.id
           AND s2.delegated_task_id = c.id
       )
    )
  )`;
    const task = db.prepare(`
    SELECT t.*,
      a.name AS agent_name,
      a.avatar_emoji AS agent_avatar,
      a.cli_provider AS agent_provider,
      d.name AS department_name,
      d.icon AS department_icon,
      p.name AS project_name,
      p.core_goal AS project_core_goal,
      ${subtaskTotalExpr} AS subtask_total,
      ${subtaskDoneExpr} AS subtask_done
    FROM tasks t
    LEFT JOIN agents a ON t.assigned_agent_id = a.id
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.id = ?
  `).get(id);
    if (!task) return res.status(404).json({ error: "not_found" });

    const logs = db.prepare(
      "SELECT * FROM task_logs WHERE task_id = ? ORDER BY created_at DESC LIMIT 200"
    ).all(id);

    const subtasks = db.prepare(
      "SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at"
    ).all(id);

    res.json({ task, logs, subtasks });
  });

  app.get("/api/tasks/:id/meeting-minutes", (req, res) => {
    const id = String(req.params.id);
    const task = db.prepare("SELECT id, source_task_id FROM tasks WHERE id = ?").get(id) as { id: string; source_task_id: string | null } | undefined;
    if (!task) return res.status(404).json({ error: "not_found" });

    // Include meeting minutes from the source (original) task if this is a collaboration task
    const taskIds = [id];
    if (task.source_task_id) taskIds.push(task.source_task_id);

    const meetings = db.prepare(
      `SELECT * FROM meeting_minutes WHERE task_id IN (${taskIds.map(() => '?').join(',')}) ORDER BY started_at DESC, round DESC`
    ).all(...taskIds) as unknown as MeetingMinutesRow[];

    const data = meetings.map((meeting) => {
      const entries = db.prepare(
        "SELECT * FROM meeting_minute_entries WHERE meeting_id = ? ORDER BY seq ASC, id ASC"
      ).all(meeting.id) as unknown as MeetingMinuteEntryRow[];
      return { ...meeting, entries };
    });

    res.json({ meetings: data });
  });
}
