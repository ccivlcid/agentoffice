// @ts-nocheck
/**
 * POST   /api/tasks/:id/preview — start a preview/dev server
 * GET    /api/tasks/:id/preview — get active preview sessions
 * DELETE /api/tasks/:id/preview — stop preview server
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";

const activePreviewProcesses = new Map<string, ChildProcess>();

export function registerOpsPreview(ctx: RuntimeContext): void {
  const { app, db, broadcast } = ctx;

  // GET — list preview sessions
  app.get("/api/tasks/:id/preview", (req, res) => {
    const { id } = req.params;
    const rows = db
      .prepare(`SELECT * FROM preview_sessions WHERE task_id = ? ORDER BY created_at DESC LIMIT 5`)
      .all(id);
    res.json({ ok: true, sessions: rows });
  });

  // POST — start preview
  app.post("/api/tasks/:id/preview", (req, res) => {
    const { id } = req.params;
    const { command } = req.body ?? {};
    if (!command) return res.status(400).json({ error: "command_required" });

    const task = db.prepare("SELECT id, project_path FROM tasks WHERE id = ?").get(id);
    if (!task) return res.status(404).json({ error: "task_not_found" });

    const sessionId = crypto.randomUUID();
    const now = Date.now();
    const cwd = task.project_path || process.cwd();

    db.prepare(
      `INSERT INTO preview_sessions (id, task_id, command, status, started_at)
       VALUES (?, ?, ?, 'starting', ?)`
    ).run(sessionId, id, command, now);

    const child = spawn(command, { shell: true, cwd });
    activePreviewProcesses.set(sessionId, child);

    child.stdout?.on("data", (data) => {
      const text = data.toString();
      // Detect port from common dev server output
      const portMatch = text.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/);
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        const url = `http://localhost:${port}`;
        db.prepare(
          `UPDATE preview_sessions SET status = 'running', port = ?, url = ?, pid = ? WHERE id = ?`
        ).run(port, url, child.pid ?? null, sessionId);
        broadcast("preview_ready", { session_id: sessionId, task_id: id, port, url });
      }
    });

    child.on("close", () => {
      activePreviewProcesses.delete(sessionId);
      db.prepare(
        `UPDATE preview_sessions SET status = 'stopped', stopped_at = ? WHERE id = ?`
      ).run(Date.now(), sessionId);
      broadcast("preview_stopped", { session_id: sessionId, task_id: id });
    });

    child.on("error", (err) => {
      activePreviewProcesses.delete(sessionId);
      db.prepare(
        `UPDATE preview_sessions SET status = 'error', stopped_at = ? WHERE id = ?`
      ).run(Date.now(), sessionId);
      broadcast("preview_stopped", { session_id: sessionId, task_id: id, error: err.message });
    });

    res.json({ ok: true, session_id: sessionId });
  });

  // DELETE — stop preview
  app.delete("/api/tasks/:id/preview", (req, res) => {
    const { id } = req.params;
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: "session_id_required" });

    const child = activePreviewProcesses.get(String(sessionId));
    if (child) {
      child.kill("SIGTERM");
      activePreviewProcesses.delete(String(sessionId));
    }

    db.prepare(
      `UPDATE preview_sessions SET status = 'stopped', stopped_at = ? WHERE id = ?`
    ).run(Date.now(), String(sessionId));

    broadcast("preview_stopped", { session_id: sessionId, task_id: id });
    res.json({ ok: true });
  });
}
