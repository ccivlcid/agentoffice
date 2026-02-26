// @ts-nocheck

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Core subtask creation and completion helpers
// ---------------------------------------------------------------------------

export function createSubtaskHelpers(ctx: {
  db: any;
  nowMs: () => number;
  broadcast: (...args: any[]) => any;
  analyzeSubtaskDepartment: (...args: any[]) => any;
  getDeptName: (...args: any[]) => any;
  getPreferredLanguage: (...args: any[]) => any;
  pickL: (...args: any[]) => any;
  l: (...args: any[]) => any;
}) {
  const { db, nowMs, broadcast, analyzeSubtaskDepartment, getDeptName, getPreferredLanguage, pickL, l } = ctx;

  function createSubtaskFromCli(taskId: string, toolUseId: string, title: string): void {
    const subId = randomUUID();
    const parentAgent = db.prepare(
      "SELECT assigned_agent_id FROM tasks WHERE id = ?"
    ).get(taskId) as { assigned_agent_id: string | null } | undefined;

    db.prepare(`
      INSERT INTO subtasks (id, task_id, title, status, assigned_agent_id, cli_tool_use_id, created_at)
      VALUES (?, ?, ?, 'in_progress', ?, ?, ?)
    `).run(subId, taskId, title, parentAgent?.assigned_agent_id ?? null, toolUseId, nowMs());

    // Detect if this subtask belongs to a foreign department
    const parentTaskDept = db.prepare(
      "SELECT department_id FROM tasks WHERE id = ?"
    ).get(taskId) as { department_id: string | null } | undefined;
    const targetDeptId = analyzeSubtaskDepartment(title, parentTaskDept?.department_id ?? null);

    if (targetDeptId) {
      const targetDeptName = getDeptName(targetDeptId);
      const lang = getPreferredLanguage();
      const blockedReason = pickL(l(
        [`${targetDeptName} 협업 대기`],
        [`Waiting for ${targetDeptName} collaboration`],
        [`${targetDeptName}の協業待ち`],
        [`等待${targetDeptName}协作`],
      ), lang);
      db.prepare(
        "UPDATE subtasks SET target_department_id = ?, status = 'blocked', blocked_reason = ? WHERE id = ?"
      ).run(targetDeptId, blockedReason, subId);
    }

    const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(subId);
    broadcast("subtask_update", subtask);
  }

  function completeSubtaskFromCli(toolUseId: string): void {
    const existing = db.prepare(
      "SELECT id, status FROM subtasks WHERE cli_tool_use_id = ?"
    ).get(toolUseId) as { id: string; status: string } | undefined;
    if (!existing || existing.status === "done") return;

    db.prepare(
      "UPDATE subtasks SET status = 'done', completed_at = ? WHERE id = ?"
    ).run(nowMs(), existing.id);

    const subtask = db.prepare("SELECT * FROM subtasks WHERE id = ?").get(existing.id);
    broadcast("subtask_update", subtask);
  }

  return { createSubtaskFromCli, completeSubtaskFromCli };
}
