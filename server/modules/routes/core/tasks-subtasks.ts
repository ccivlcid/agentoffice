// @ts-nocheck
/**
 * Core API: subtask CRUD and task assignment endpoints.
 * Extracted from tasks.ts for maintainability.
 */

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import { randomUUID } from "node:crypto";

type SQLInputValue = string | number | null;

export function registerTaskSubtasks(ctx: RuntimeContext): void {
  const {
    app,
    db,
    broadcast,
    nowMs,
    appendTaskLog,
    findTeamLeader,
    resolveLang,
    getAgentDisplayName,
    sendAgentMessage,
    l,
    pickL,
    analyzeSubtaskDepartment,
    getDeptName,
  } = ctx;

  // ---------------------------------------------------------------------------
  // POST /api/tasks/:id/subtasks — create subtask manually
  // ---------------------------------------------------------------------------
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

    // Detect foreign department for manual subtask creation too
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

  // ---------------------------------------------------------------------------
  // PATCH /api/subtasks/:id — update subtask fields
  // ---------------------------------------------------------------------------
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

    // Auto-set completed_at when transitioning to done
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

  // ---------------------------------------------------------------------------
  // POST /api/tasks/:id/assign — assign an agent to a task
  // ---------------------------------------------------------------------------
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

    // Update task
    db.prepare(
      "UPDATE tasks SET assigned_agent_id = ?, department_id = COALESCE(department_id, ?), status = CASE WHEN status = 'inbox' THEN 'planned' ELSE status END, updated_at = ? WHERE id = ?"
    ).run(agentId, agent.department_id, t, id);

    // Update agent
    db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(id, agentId);

    appendTaskLog(id, "system", `Assigned to agent: ${agent.name}`);

    // Create assignment message
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

    // B4: Notify CEO about assignment via team leader
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
