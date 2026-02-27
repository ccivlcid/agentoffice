// @ts-nocheck
/**
 * POST /api/tasks/:id/clone — duplicate a task (creates new task with same fields)
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import crypto from "node:crypto";

export function registerTaskClone(ctx: RuntimeContext): void {
  const { app, db, broadcast } = ctx;

  app.post("/api/tasks/:id/clone", (req, res) => {
    const { id } = req.params;
    const src = db
      .prepare(
        `SELECT title, description, department_id, task_type, priority,
                project_id, project_path, assigned_agent_id
         FROM tasks WHERE id = ?`
      )
      .get(id);
    if (!src) return res.status(404).json({ error: "task_not_found" });

    const newId = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO tasks (id, title, description, department_id, task_type,
                          priority, project_id, project_path, assigned_agent_id,
                          status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'inbox', ?, ?)`
    ).run(
      newId,
      `[복제] ${src.title}`,
      src.description,
      src.department_id,
      src.task_type,
      src.priority,
      src.project_id,
      src.project_path,
      src.assigned_agent_id,
      now,
      now,
    );

    broadcast("task_created", { id: newId });
    res.json({ id: newId });
  });
}
