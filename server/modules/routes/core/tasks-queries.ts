// @ts-nocheck
/**
 * Core API: task query/read endpoints (GET).
 * Extracted from tasks.ts for maintainability.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";

type SQLInputValue = string | number | null;

export function registerTaskQueries(ctx: RuntimeContext): void {
  const {
    app,
    db,
    reconcileCrossDeptSubtasks,
    firstQueryValue,
  } = ctx;

  // Shared SQL expression: total subtasks (including delegated cross-dept tasks)
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

  // Shared SQL expression: done subtasks
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

  // ---------------------------------------------------------------------------
  // GET /api/tasks — list tasks with optional filters
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

  // ---------------------------------------------------------------------------
  // GET /api/tasks/:id — get single task with logs and subtasks
  // ---------------------------------------------------------------------------
  app.get("/api/tasks/:id", (req, res) => {
    const id = String(req.params.id);
    reconcileCrossDeptSubtasks(id);

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

  // ---------------------------------------------------------------------------
  // GET /api/tasks/:id/meeting-minutes
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // GET /api/subtasks — list subtasks (with optional active filter)
  // ---------------------------------------------------------------------------
  app.get("/api/subtasks", (req, res) => {
    const active = firstQueryValue(req.query.active);
    let subtasks;
    if (active === "1") {
      subtasks = db.prepare(`
      SELECT s.* FROM subtasks s
      JOIN tasks t ON s.task_id = t.id
      WHERE t.status IN ('planned', 'collaborating', 'in_progress', 'review')
      ORDER BY s.created_at
    `).all();
    } else {
      subtasks = db.prepare("SELECT * FROM subtasks ORDER BY created_at").all();
    }
    res.json({ subtasks });
  });
}
