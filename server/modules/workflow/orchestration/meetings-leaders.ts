// @ts-nocheck

export interface LeadersCtx {
  db: any;
  findTeamLeader: (deptId: string) => any;
  detectTargetDepartments: (text: string) => string[];
}

export function makeLeaderHelpers(ctx: LeadersCtx) {
  const { db, findTeamLeader, detectTargetDepartments } = ctx;

  function getLeadersByDepartmentIds(deptIds: string[]): any[] {
    const out: any[] = [];
    const seen = new Set<string>();
    for (const deptId of deptIds) {
      if (!deptId) continue;
      const leader = findTeamLeader(deptId);
      if (!leader || seen.has(leader.id)) continue;
      out.push(leader);
      seen.add(leader.id);
    }
    return out;
  }

  function getAllActiveTeamLeaders(): any[] {
    return db.prepare(`
      SELECT a.*
      FROM agents a
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE a.role = 'team_leader' AND a.status != 'offline'
      ORDER BY d.sort_order ASC, a.name ASC
    `).all() as unknown as any[];
  }

  function getTaskRelatedDepartmentIds(taskId: string, fallbackDeptId: string | null): string[] {
    const task = db.prepare(
      "SELECT title, description, department_id FROM tasks WHERE id = ?"
    ).get(taskId) as { title: string; description: string | null; department_id: string | null } | undefined;

    const deptSet = new Set<string>();
    if (fallbackDeptId) deptSet.add(fallbackDeptId);
    if (task?.department_id) deptSet.add(task.department_id);

    const subtaskDepts = db.prepare(
      "SELECT DISTINCT target_department_id FROM subtasks WHERE task_id = ? AND target_department_id IS NOT NULL"
    ).all(taskId) as Array<{ target_department_id: string | null }>;
    for (const row of subtaskDepts) {
      if (row.target_department_id) deptSet.add(row.target_department_id);
    }

    const sourceText = `${task?.title ?? ""} ${task?.description ?? ""}`;
    for (const deptId of detectTargetDepartments(sourceText)) {
      deptSet.add(deptId);
    }

    return [...deptSet];
  }

  function getTaskReviewLeaders(
    taskId: string,
    fallbackDeptId: string | null,
    opts?: { minLeaders?: number; includePlanning?: boolean; fallbackAll?: boolean },
  ): any[] {
    // --- Manual mode: filter participants to planning leader + assigned agents' dept leaders ---
    const task = db.prepare("SELECT project_id FROM tasks WHERE id = ?").get(taskId) as { project_id: string | null } | undefined;
    if (task?.project_id) {
      const project = db.prepare("SELECT assignment_mode FROM projects WHERE id = ?").get(task.project_id) as { assignment_mode: string } | undefined;
      if (project?.assignment_mode === "manual") {
        const assignedAgents = db.prepare(
          "SELECT DISTINCT a.department_id FROM project_agents pa JOIN agents a ON a.id = pa.agent_id WHERE pa.project_id = ?"
        ).all(task.project_id) as { department_id: string }[];
        const manualDeptIds = [...new Set(assignedAgents.map(a => a.department_id).filter(Boolean))];
        const leaders = getLeadersByDepartmentIds(manualDeptIds);
        const seen = new Set(leaders.map((l) => l.id));
        // Always include planning leader
        const planningLeader = findTeamLeader("planning");
        if (planningLeader && !seen.has(planningLeader.id)) {
          leaders.unshift(planningLeader);
          seen.add(planningLeader.id);
        }
        // No fallbackAll for manual mode
        return leaders;
      }
    }

    // --- Auto mode (existing logic) ---
    const deptIds = getTaskRelatedDepartmentIds(taskId, fallbackDeptId);
    const leaders = getLeadersByDepartmentIds(deptIds);
    const includePlanning = opts?.includePlanning ?? true;
    const minLeaders = opts?.minLeaders ?? 2;
    const fallbackAll = opts?.fallbackAll ?? true;

    const seen = new Set(leaders.map((l) => l.id));
    if (includePlanning) {
      const planningLeader = findTeamLeader("planning");
      if (planningLeader && !seen.has(planningLeader.id)) {
        leaders.unshift(planningLeader);
        seen.add(planningLeader.id);
      }
    }

    if (fallbackAll && leaders.length < minLeaders) {
      for (const leader of getAllActiveTeamLeaders()) {
        if (seen.has(leader.id)) continue;
        leaders.push(leader);
        seen.add(leader.id);
      }
    }

    return leaders;
  }

  return {
    getLeadersByDepartmentIds,
    getAllActiveTeamLeaders,
    getTaskRelatedDepartmentIds,
    getTaskReviewLeaders,
  };
}
