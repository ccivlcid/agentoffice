// @ts-nocheck
/**
 * Core API: task create, update, bulk-hide, delete endpoints.
 * Extracted from tasks.ts for maintainability.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { normalizeProjectPathFromString } from "./project-path.ts";

type SQLInputValue = string | number | null;

export function registerTaskCreate(ctx: RuntimeContext): void {
  const {
    app,
    db,
    broadcast,
    nowMs,
    normalizeTextField,
    appendTaskLog,
    setTaskCreationAuditCompletion,
    clearTaskWorkflowState,
    endTaskExecutionSession,
    stopRequestedTasks,
    killPidTree,
    activeProcesses,
    recordTaskCreationAudit,
    logsDir,
  } = ctx;

  function normalizeProjectPathInput(raw: unknown): string | null {
    const value = normalizeTextField(raw);
    if (!value) return null;
    return normalizeProjectPathFromString(value);
  }

  // ---------------------------------------------------------------------------
  // POST /api/tasks — create a new task
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // PATCH /api/tasks/:id — update task fields
  // ---------------------------------------------------------------------------
  app.patch("/api/tasks/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "not_found" });

    const body = req.body ?? {};
    const allowedFields = [
      "title", "description", "department_id", "assigned_agent_id",
      "status", "priority", "task_type", "project_path", "result",
      "hidden",
    ];

    const updates: string[] = ["updated_at = ?"];
    const updateTs = nowMs();
    const params: unknown[] = [updateTs];
    let touchedProjectId: string | null = null;

    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }

    if ("project_id" in body) {
      const requestedProjectId = normalizeTextField(body.project_id);
      if (!requestedProjectId) {
        updates.push("project_id = ?");
        params.push(null);
      } else {
        const project = db.prepare("SELECT id, project_path FROM projects WHERE id = ?").get(requestedProjectId) as {
          id: string;
          project_path: string;
        } | undefined;
        if (!project) return res.status(400).json({ error: "project_not_found" });
        updates.push("project_id = ?");
        params.push(project.id);
        touchedProjectId = project.id;
        if (!("project_path" in body)) {
          updates.push("project_path = ?");
          params.push(project.project_path);
        }
      }
    }

    // Handle completed_at for status changes
    if (body.status === "done" && !("completed_at" in body)) {
      updates.push("completed_at = ?");
      params.push(nowMs());
    }
    if (body.status === "in_progress" && !("started_at" in body)) {
      updates.push("started_at = ?");
      params.push(nowMs());
    }

    params.push(id);
    db.prepare(`UPDATE tasks SET ${updates.join(", ")} WHERE id = ?`).run(...(params as SQLInputValue[]));
    if (touchedProjectId) {
      db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(updateTs, updateTs, touchedProjectId);
    }

    const nextStatus = typeof body.status === "string" ? body.status : null;
    if (nextStatus) {
      setTaskCreationAuditCompletion(id, nextStatus === "done");
    }
    if (nextStatus && (nextStatus === "cancelled" || nextStatus === "pending" || nextStatus === "done" || nextStatus === "inbox")) {
      clearTaskWorkflowState(id);
      if (nextStatus === "done" || nextStatus === "cancelled") {
        endTaskExecutionSession(id, `task_status_${nextStatus}`);
      }
    }

    appendTaskLog(id, "system", `Task updated: ${Object.keys(body).join(", ")}`);

    const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    broadcast("task_update", updated);
    res.json({ ok: true, task: updated });
  });

  // ---------------------------------------------------------------------------
  // POST /api/tasks/bulk-hide — bulk hide/show tasks by status
  // ---------------------------------------------------------------------------
  app.post("/api/tasks/bulk-hide", (req, res) => {
    const { statuses, hidden } = req.body ?? {};
    if (!Array.isArray(statuses) || statuses.length === 0 || (hidden !== 0 && hidden !== 1)) {
      return res.status(400).json({ error: "invalid_body" });
    }
    const placeholders = statuses.map(() => "?").join(",");
    const result = db.prepare(
      `UPDATE tasks SET hidden = ?, updated_at = ? WHERE status IN (${placeholders}) AND hidden != ?`
    ).run(hidden, nowMs(), ...statuses, hidden);
    broadcast("tasks_changed", {});
    res.json({ ok: true, affected: result.changes });
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/tasks/:id — delete a task and its logs
  // ---------------------------------------------------------------------------
  app.delete("/api/tasks/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as {
      assigned_agent_id: string | null;
    } | undefined;
    if (!existing) return res.status(404).json({ error: "not_found" });

    endTaskExecutionSession(id, "task_deleted");
    clearTaskWorkflowState(id);

    // Kill any running process
    const activeChild = activeProcesses.get(id);
    if (activeChild?.pid) {
      stopRequestedTasks.add(id);
      if (activeChild.pid < 0) {
        activeChild.kill();
      } else {
        killPidTree(activeChild.pid);
      }
      activeProcesses.delete(id);
    }

    // Reset agent if assigned
    if (existing.assigned_agent_id) {
      db.prepare(
        "UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ? AND current_task_id = ?"
      ).run(existing.assigned_agent_id, id);
    }

    db.prepare("DELETE FROM task_logs WHERE task_id = ?").run(id);
    db.prepare("DELETE FROM messages WHERE task_id = ?").run(id);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

    // Clean up log files
    for (const suffix of [".log", ".prompt.txt"]) {
      const filePath = path.join(logsDir, `${id}${suffix}`);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
    }

    broadcast("task_update", { id, deleted: true });
    res.json({ ok: true });
  });
}
