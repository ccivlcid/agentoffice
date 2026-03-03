// @ts-nocheck
/**
 * POST /api/tasks/:id/inject — queue a sanitized prompt for a paused task.
 */
import type { RuntimeContext } from "../../../types/runtime-context.ts";
import {
  sanitizeInjectPrompt,
  queueInjection,
} from "../../workflow/core-interrupt-injection.ts";

export function registerTaskInject(ctx: RuntimeContext): void {
  const { app, db, broadcast, nowMs, appendTaskLog } = ctx;

  app.post("/api/tasks/:id/inject", (req, res) => {
    const id = String(req.params.id);
    const task = db.prepare("SELECT id, status, interrupt_token FROM tasks WHERE id = ?").get(id) as {
      id: string;
      status: string;
      interrupt_token: string | null;
    } | undefined;

    if (!task) return res.status(404).json({ error: "not_found" });
    if (task.status !== "pending") {
      return res.status(400).json({ error: "invalid_status", message: "Task must be in pending (paused) state" });
    }

    // Validate interrupt token
    const token = req.body?.interrupt_token ?? req.headers["x-task-interrupt-token"];
    if (!task.interrupt_token || token !== task.interrupt_token) {
      return res.status(403).json({ error: "invalid_interrupt_token" });
    }

    const rawPrompt = String(req.body?.prompt ?? "").trim();
    if (!rawPrompt) {
      return res.status(400).json({ error: "empty_prompt" });
    }

    const sanitized = sanitizeInjectPrompt(rawPrompt);
    if (!sanitized) {
      return res.status(400).json({ error: "empty_prompt_after_sanitize" });
    }

    const injection = queueInjection(db, id, sanitized);

    appendTaskLog(id, "system", `INJECT queued (hash=${injection.prompt_hash}, len=${sanitized.length})`);

    const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    broadcast("task_update", updatedTask);

    res.json({ ok: true, injection_id: injection.id, prompt_hash: injection.prompt_hash });
  });
}
