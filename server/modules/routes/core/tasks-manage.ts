// @ts-nocheck
/** Core API: tasks manage routes (patch, delete, bulk-hide, subtasks, assign). */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";

type SQLInputValue = string | number | null;

export function registerCoreTasksManage(ctx: RuntimeContext): void {
  const {
    app,
    db,
    broadcast,
    nowMs,
    firstQueryValue,
    normalizeTextField,
    appendTaskLog,
    clearTaskWorkflowState,
    endTaskExecutionSession,
    stopRequestedTasks,
    killPidTree,
    activeProcesses,
    setTaskCreationAuditCompletion,
    findTeamLeader,
    resolveLang,
    getAgentDisplayName,
    sendAgentMessage,
    l,
    pickL,
    analyzeSubtaskDepartment,
    getDeptName,
    logsDir,
  } = ctx;

  app.patch("/api/tasks/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "not_found" });
    const body = req.body ?? {};
    const allowedFields = ["title", "description", "department_id", "assigned_agent_id", "status", "priority", "task_type", "project_path", "result", "hidden"];
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

  app.delete("/api/tasks/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as {
      assigned_agent_id: string | null;
    } | undefined;
    if (!existing) return res.status(404).json({ error: "not_found" });

    endTaskExecutionSession(id, "task_deleted");
    clearTaskWorkflowState(id);
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
    if (existing.assigned_agent_id) {
      db.prepare(
        "UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ? AND current_task_id = ?"
      ).run(existing.assigned_agent_id, id);
    }

    db.prepare("DELETE FROM task_logs WHERE task_id = ?").run(id);
    db.prepare("DELETE FROM messages WHERE task_id = ?").run(id);
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    for (const suffix of [".log", ".prompt.txt"]) {
      const filePath = path.join(logsDir, `${id}${suffix}`);
      try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch { /* ignore */ }
    }

    broadcast("task_update", { id, deleted: true });
    res.json({ ok: true });
  });
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

  app.post("/api/tasks/:id/subtasks", (req, res) => {
    const taskId = String(req.params.id);
    const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
    if (!task) return res.status(404).json({ error: "task_not_found" });
    const body = req.body ?? {};
    if (!body.title || typeof body.title !== "string") {
      return res.status(400).json({ error: "title_required" });
    }
    const id = randomUUID();
    db.prepare(`
    INSERT INTO subtasks (id, task_id, title, description, status, assigned_agent_id, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).run(id, taskId, body.title, body.description ?? null, body.assigned_agent_id ?? null, nowMs());
    const parentTaskDept = db.prepare(
      "SELECT department_id FROM tasks WHERE id = ?"
    ).get(taskId) as { department_id: string | null } | undefined;
    const targetDeptId = analyzeSubtaskDepartment(body.title, parentTaskDept?.department_id ?? null);
    if (targetDeptId) {
      const targetDeptName = getDeptName(targetDeptId);
      db.prepare(
        "UPDATE subtasks SET target_department_id = ?, status = 'blocked', blocked_reason = ? WHERE id = ?"
      ).run(targetDeptId, `${targetDeptName} 협업 대기`, id);
    }
    const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id);
    broadcast("subtask_update", subtask);
    res.json(subtask);
  });

  app.patch("/api/subtasks/:id", (req, res) => {
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!existing) return res.status(404).json({ error: "not_found" });
    const body = req.body ?? {};
    const allowedFields = ["title", "description", "status", "assigned_agent_id", "blocked_reason", "target_department_id", "delegated_task_id"];
    const updates: string[] = [];
    const params: unknown[] = [];
    for (const field of allowedFields) {
      if (field in body) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
      }
    }
    if (body.status === "done" && existing.status !== "done") {
      updates.push("completed_at = ?");
      params.push(nowMs());
    }
    if (updates.length === 0) return res.status(400).json({ error: "no_fields" });
    params.push(id);
    db.prepare(`UPDATE subtasks SET ${updates.join(", ")} WHERE id = ?`).run(...(params as SQLInputValue[]));
    const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(id);
    broadcast("subtask_update", subtask);
    res.json(subtask);
  });

  app.post("/api/tasks/:id/assign", (req, res) => {
    const id = String(req.params.id);
    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as {
      id: string;
      assigned_agent_id: string | null;
      title: string;
    } | undefined;
    if (!task) return res.status(404).json({ error: "not_found" });

    const agentId = req.body?.agent_id;
    if (!agentId || typeof agentId !== "string") {
      return res.status(400).json({ error: "agent_id_required" });
    }

    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as {
      id: string;
      name: string;
      department_id: string | null;
    } | undefined;
    if (!agent) return res.status(404).json({ error: "agent_not_found" });

    const t = nowMs();
    // Unassign previous agent if different
    if (task.assigned_agent_id && task.assigned_agent_id !== agentId) {
      db.prepare(
        "UPDATE agents SET current_task_id = NULL WHERE id = ? AND current_task_id = ?"
      ).run(task.assigned_agent_id, id);
    }

    db.prepare(
      "UPDATE tasks SET assigned_agent_id = ?, department_id = COALESCE(department_id, ?), status = CASE WHEN status = 'inbox' THEN 'planned' ELSE status END, updated_at = ? WHERE id = ?"
    ).run(agentId, agent.department_id, t, id);
    db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(id, agentId);
    appendTaskLog(id, "system", `Assigned to agent: ${agent.name}`);
    const msgId = randomUUID();
    db.prepare(
      `INSERT INTO messages (id, sender_type, sender_id, receiver_type, receiver_id, content, message_type, task_id, created_at)
     VALUES (?, 'ceo', NULL, 'agent', ?, ?, 'task_assign', ?, ?)`
    ).run(msgId, agentId, `New task assigned: ${task.title}`, id, t);

    const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    const updatedAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId);
    broadcast("task_update", updatedTask);
    broadcast("agent_status", updatedAgent);
    broadcast("new_message", {
      id: msgId,
      sender_type: "ceo",
      receiver_type: "agent",
      receiver_id: agentId,
      content: `New task assigned: ${task.title}`,
      message_type: "task_assign",
      task_id: id,
      created_at: t,
    });
    const leader = findTeamLeader(agent.department_id);
    if (leader) {
      const lang = resolveLang(task.title);
      const agentRow = db.prepare("SELECT * FROM agents WHERE id = ?").get(agentId) as AgentRow | undefined;
      const agentName = agentRow ? getAgentDisplayName(agentRow, lang) : agent.name;
      const leaderName = getAgentDisplayName(leader, lang);
      sendAgentMessage(
        leader,
        pickL(l(
          [`${leaderName}이(가) ${agentName}에게 '${task.title}' 업무를 할당했습니다.`],
          [`${leaderName} assigned '${task.title}' to ${agentName}.`],
          [`${leaderName}が '${task.title}' を${agentName}に割り当てました。`],
          [`${leaderName} 已将 '${task.title}' 分配给 ${agentName}。`],
        ), lang),
        "status_update",
        "all",
        null,
        id,
      );
    }
    res.json({ ok: true, task: updatedTask, agent: updatedAgent });
  });
}
