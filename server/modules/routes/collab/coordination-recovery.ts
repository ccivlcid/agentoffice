// @ts-nocheck

export function initializeCollabRecovery(deps: {
  db: any;
  nowMs: any;
  broadcast: any;
  appendTaskLog: any;
  findTeamLeader: any;
  findBestSubordinate: any;
  getDeptName: any;
  getAgentDisplayName: any;
  resolveLang: any;
  startTaskExecutionForAgent: any;
  startCrossDeptCooperation: any;
}) {
  const {
    db, nowMs, broadcast, appendTaskLog,
    findTeamLeader, findBestSubordinate, getDeptName, getAgentDisplayName,
    resolveLang, startTaskExecutionForAgent, startCrossDeptCooperation,
  } = deps;

  function recoverCrossDeptQueueAfterMissingCallback(completedChildTaskId: string): void {
    const child = db.prepare(
      "SELECT source_task_id FROM tasks WHERE id = ?"
    ).get(completedChildTaskId) as { source_task_id: string | null } | undefined;
    if (!child?.source_task_id) return;

    const parent = db.prepare(`
      SELECT id, title, description, department_id, status, assigned_agent_id, started_at
      FROM tasks
      WHERE id = ?
    `).get(child.source_task_id) as {
      id: string;
      title: string;
      description: string | null;
      department_id: string | null;
      status: string;
      assigned_agent_id: string | null;
      started_at: number | null;
    } | undefined;
    if (!parent || parent.status !== "collaborating" || !parent.department_id) return;

    const activeSibling = db.prepare(`
      SELECT 1
      FROM tasks
      WHERE source_task_id = ?
        AND status IN ('planned', 'pending', 'collaborating', 'in_progress', 'review')
      LIMIT 1
    `).get(parent.id);
    if (activeSibling) return;

    const targetDeptRows = db.prepare(`
      SELECT target_department_id
      FROM subtasks
      WHERE task_id = ?
        AND target_department_id IS NOT NULL
      ORDER BY created_at ASC
    `).all(parent.id) as Array<{ target_department_id: string | null }>;
    const deptIds: string[] = [];
    const seen = new Set<string>();
    for (const row of targetDeptRows) {
      if (!row.target_department_id || seen.has(row.target_department_id)) continue;
      seen.add(row.target_department_id);
      deptIds.push(row.target_department_id);
    }
    if (deptIds.length === 0) return;

    const doneRows = db.prepare(`
      SELECT department_id
      FROM tasks
      WHERE source_task_id = ?
        AND status = 'done'
        AND department_id IS NOT NULL
    `).all(parent.id) as Array<{ department_id: string | null }>;
    const doneDept = new Set(doneRows.map((r) => r.department_id).filter((v): v is string => !!v));
    const nextIndex = deptIds.findIndex((deptId) => !doneDept.has(deptId));

    const leader = findTeamLeader(parent.department_id);
    if (!leader) return;
    const lang = resolveLang(parent.description ?? parent.title);

    const delegateMainTask = () => {
      const current = db.prepare(
        "SELECT status, assigned_agent_id, started_at FROM tasks WHERE id = ?"
      ).get(parent.id) as { status: string; assigned_agent_id: string | null; started_at: number | null } | undefined;
      if (!current || current.status !== "collaborating") return;
      if (current.assigned_agent_id || current.started_at) return;

      const subordinate = findBestSubordinate(parent.department_id!, leader.id);
      const assignee = subordinate ?? leader;
      const deptName = getDeptName(parent.department_id!);
      const t = nowMs();
      db.prepare(
        "UPDATE tasks SET assigned_agent_id = ?, status = 'planned', updated_at = ? WHERE id = ?"
      ).run(assignee.id, t, parent.id);
      db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(parent.id, assignee.id);
      appendTaskLog(parent.id, "system", `Recovery: cross-dept queue completed, delegated to ${(assignee.name_ko || assignee.name)}`);
      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(parent.id));
      broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(assignee.id));
      startTaskExecutionForAgent(parent.id, assignee, parent.department_id, deptName);
    };

    if (nextIndex === -1) {
      delegateMainTask();
      return;
    }

    const ctx = {
      teamLeader: leader,
      taskTitle: parent.title,
      ceoMessage: (parent.description ?? "").replace(/^\[CEO\]\s*/, ""),
      leaderDeptId: parent.department_id,
      leaderDeptName: getDeptName(parent.department_id),
      leaderName: getAgentDisplayName(leader, lang),
      lang,
      taskId: parent.id,
    };
    const shouldResumeMainAfterAll = !parent.assigned_agent_id && !parent.started_at;
    startCrossDeptCooperation(
      deptIds,
      nextIndex,
      ctx,
      shouldResumeMainAfterAll ? delegateMainTask : undefined,
    );
  }

  return {
    recoverCrossDeptQueueAfterMissingCallback,
  };
}
