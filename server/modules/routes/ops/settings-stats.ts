// @ts-nocheck
/**
 * CLI status, settings, stats/dashboard API routes.
 * Extracted from ops.ts to keep single-file line count under 300.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";

export function registerOpsSettingsAndStats(ctx: RuntimeContext): void {
  const { app, db, detectAllCli, CLI_STATUS_TTL } = ctx;
  const cachedCliStatusRef = ctx as { cachedCliStatus?: { data: unknown; loadedAt: number } | null };

  // ---------------------------------------------------------------------------
  // CLI Status
  // ---------------------------------------------------------------------------
  app.get("/api/cli-status", async (_req: any, res: any) => {
    const refresh = _req.query.refresh === "1";
    const now = Date.now();

    if (!refresh && cachedCliStatusRef.cachedCliStatus && now - cachedCliStatusRef.cachedCliStatus.loadedAt < CLI_STATUS_TTL) {
      return res.json({ providers: cachedCliStatusRef.cachedCliStatus.data });
    }

    try {
      const data = await detectAllCli();
      cachedCliStatusRef.cachedCliStatus = { data, loadedAt: Date.now() };
      res.json({ providers: data });
    } catch (err) {
      res.status(500).json({ error: "cli_detection_failed", message: String(err) });
    }
  });

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------
  app.get("/api/settings", (_req: any, res: any) => {
    const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    }
    res.json({ settings });
  });

  app.put("/api/settings", (req: any, res: any) => {
    const body = req.body ?? {};
    const upsert = db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    );
    for (const [key, value] of Object.entries(body)) {
      upsert.run(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // Stats / Dashboard
  // ---------------------------------------------------------------------------
  app.get("/api/stats", (_req: any, res: any) => {
    const totalTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks").get() as { cnt: number }).cnt;
    const doneTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'done'").get() as { cnt: number }).cnt;
    const inProgressTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'in_progress'").get() as { cnt: number }).cnt;
    const inboxTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'inbox'").get() as { cnt: number }).cnt;
    const plannedTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'planned'").get() as { cnt: number }).cnt;
    const reviewTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'review'").get() as { cnt: number }).cnt;
    const cancelledTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'cancelled'").get() as { cnt: number }).cnt;
    const collaboratingTasks = (db.prepare("SELECT COUNT(*) as cnt FROM tasks WHERE status = 'collaborating'").get() as { cnt: number }).cnt;

    const totalAgents = (db.prepare("SELECT COUNT(*) as cnt FROM agents").get() as { cnt: number }).cnt;
    const workingAgents = (db.prepare("SELECT COUNT(*) as cnt FROM agents WHERE status = 'working'").get() as { cnt: number }).cnt;
    const idleAgents = (db.prepare("SELECT COUNT(*) as cnt FROM agents WHERE status = 'idle'").get() as { cnt: number }).cnt;

    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    const topAgents = db.prepare(
      "SELECT id, name, avatar_emoji, stats_tasks_done, stats_xp FROM agents ORDER BY stats_xp DESC LIMIT 5"
    ).all();

    const tasksByDept = db.prepare(`
      SELECT d.id, d.name, d.icon, d.color,
        COUNT(t.id) AS total_tasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS done_tasks
      FROM departments d
      LEFT JOIN tasks t ON t.department_id = d.id
      GROUP BY d.id
      ORDER BY d.name
    `).all();

    const recentActivity = db.prepare(`
      SELECT tl.*, t.title AS task_title
      FROM task_logs tl
      LEFT JOIN tasks t ON tl.task_id = t.id
      ORDER BY tl.created_at DESC
      LIMIT 20
    `).all();

    res.json({
      stats: {
        tasks: {
          total: totalTasks,
          done: doneTasks,
          in_progress: inProgressTasks,
          inbox: inboxTasks,
          planned: plannedTasks,
          collaborating: collaboratingTasks,
          review: reviewTasks,
          cancelled: cancelledTasks,
          completion_rate: completionRate,
        },
        agents: {
          total: totalAgents,
          working: workingAgents,
          idle: idleAgents,
        },
        top_agents: topAgents,
        tasks_by_department: tasksByDept,
        recent_activity: recentActivity,
      },
    });
  });
}
