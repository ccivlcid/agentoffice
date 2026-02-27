// @ts-nocheck
/**
 * GET /api/tasks/:id/timeline — task status change history from task_logs
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";

export function registerTaskTimeline(ctx: RuntimeContext): void {
  const { app, db } = ctx;

  app.get("/api/tasks/:id/timeline", (req, res) => {
    const { id } = req.params;
    const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(id);
    if (!task) return res.status(404).json({ error: "task_not_found" });

    const rows = db
      .prepare(
        `SELECT tl.id, tl.kind, tl.message, tl.created_at,
                tl.agent_id, a.name AS agent_name
         FROM task_logs tl
         LEFT JOIN agents a ON a.id = tl.agent_id
         WHERE tl.task_id = ?
         ORDER BY tl.created_at ASC`
      )
      .all(id);

    res.json({ events: rows });
  });
}
