// @ts-nocheck

// ---------------------------------------------------------------------------
// Planner subtask assignment parsing and rerouting
// ---------------------------------------------------------------------------

interface PlannerSubtaskAssignment {
  subtask_id: string;
  target_department_id: string | null;
  reason?: string;
  confidence?: number;
}

const plannerSubtaskRoutingInFlight = new Set<string>();

function normalizeDeptAliasToken(input: string): string {
  return input.toLowerCase().replace(/[\s_\-()[\]{}]/g, "");
}

function normalizePlannerTargetDeptId(
  rawTarget: unknown,
  ownerDeptId: string | null,
  deptRows: Array<{ id: string; name: string; name_ko: string }>,
): string | null {
  if (rawTarget == null) return null;
  const raw = String(rawTarget).trim();
  if (!raw) return null;
  const token = normalizeDeptAliasToken(raw);
  const nullAliases = new Set([
    "null", "none", "owner", "ownerdept", "ownerdepartment", "same", "sameasowner",
    "자체", "내부", "동일부서", "원부서", "없음", "无", "同部门", "同部門",
  ]);
  if (nullAliases.has(token)) return null;

  for (const dept of deptRows) {
    const aliases = new Set<string>([
      dept.id,
      dept.name,
      dept.name_ko,
      dept.name_ko.replace(/팀$/g, ""),
      dept.name.replace(/\s*team$/i, ""),
    ].map((v) => normalizeDeptAliasToken(v)));
    if (aliases.has(token)) {
      return dept.id === ownerDeptId ? null : dept.id;
    }
  }
  return null;
}

function parsePlannerSubtaskAssignments(rawText: string): PlannerSubtaskAssignment[] {
  const text = rawText.trim();
  if (!text) return [];

  const candidates: string[] = [];
  const fencedMatches = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const m of fencedMatches) {
    const body = (m[1] ?? "").trim();
    if (body) candidates.push(body);
  }
  candidates.push(text);
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) candidates.push(objectMatch[0]);

  for (const candidate of candidates) {
    let parsed: any;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    const rows = Array.isArray(parsed?.assignments)
      ? parsed.assignments
      : (Array.isArray(parsed) ? parsed : []);
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const normalized: PlannerSubtaskAssignment[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const subtaskId = typeof row.subtask_id === "string" ? row.subtask_id.trim() : "";
      if (!subtaskId) continue;
      const targetRaw = row.target_department_id ?? row.target_department ?? row.department_id ?? row.department ?? null;
      const reason = typeof row.reason === "string" ? row.reason.trim() : undefined;
      const confidence = typeof row.confidence === "number"
        ? Math.max(0, Math.min(1, row.confidence))
        : undefined;
      normalized.push({
        subtask_id: subtaskId,
        target_department_id: targetRaw == null ? null : String(targetRaw),
        reason,
        confidence,
      });
    }
    if (normalized.length > 0) return normalized;
  }

  return [];
}

export function createAssignmentHelpers(ctx: {
  db: any;
  findTeamLeader: (...args: any[]) => any;
  resolveLang: (...args: any[]) => any;
  resolveProjectPath: (...args: any[]) => any;
  runAgentOneShot: (...args: any[]) => any;
  getDeptName: (...args: any[]) => any;
  getPreferredLanguage: (...args: any[]) => any;
  pickL: (...args: any[]) => any;
  l: (...args: any[]) => any;
  notifyCeo: (...args: any[]) => any;
  appendTaskLog: (...args: any[]) => any;
}) {
  const {
    db,
    findTeamLeader,
    resolveLang,
    resolveProjectPath,
    runAgentOneShot,
    getDeptName,
    getPreferredLanguage,
    pickL,
    l,
    notifyCeo,
    appendTaskLog,
  } = ctx;

  async function rerouteSubtasksByPlanningLeader(
    taskId: string,
    ownerDeptId: string | null,
    phase: "planned" | "review",
  ): Promise<void> {
    const lockKey = `${phase}:${taskId}`;
    if (plannerSubtaskRoutingInFlight.has(lockKey)) return;
    plannerSubtaskRoutingInFlight.add(lockKey);

    try {
      const planningLeader = findTeamLeader("planning");
      if (!planningLeader) return;

      const task = db.prepare(
        "SELECT title, description, project_path, assigned_agent_id, department_id FROM tasks WHERE id = ?"
      ).get(taskId) as {
        title: string;
        description: string | null;
        project_path: string | null;
        assigned_agent_id: string | null;
        department_id: string | null;
      } | undefined;
      if (!task) return;

      const baseDeptId = ownerDeptId ?? task.department_id;
      const lang = resolveLang(task.description ?? task.title);
      const subtasks = db.prepare(`
        SELECT id, title, description, status, blocked_reason, target_department_id, assigned_agent_id, delegated_task_id
        FROM subtasks
        WHERE task_id = ?
          AND status IN ('pending', 'blocked')
          AND (delegated_task_id IS NULL OR delegated_task_id = '')
        ORDER BY created_at ASC
      `).all(taskId) as Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        blocked_reason: string | null;
        target_department_id: string | null;
        assigned_agent_id: string | null;
        delegated_task_id: string | null;
      }>;
      if (subtasks.length === 0) return;

      const deptRows = db.prepare(
        "SELECT id, name, name_ko FROM departments ORDER BY sort_order ASC"
      ).all() as Array<{ id: string; name: string; name_ko: string }>;
      if (deptRows.length === 0) return;

      const deptGuide = deptRows
        .map((dept) => `- ${dept.id}: ${dept.name_ko || dept.name} (${dept.name})`)
        .join("\n");
      const subtaskGuide = subtasks
        .map((st, idx) => {
          const compactDesc = (st.description ?? "").replace(/\s+/g, " ").trim();
          const descPart = compactDesc ? ` desc="${compactDesc.slice(0, 220)}"` : "";
          const targetPart = st.target_department_id ? ` current_target=${st.target_department_id}` : "";
          return `${idx + 1}. id=${st.id} title="${st.title}"${descPart}${targetPart}`;
        })
        .join("\n");

      const reroutePrompt = [
        "You are the planning team leader responsible for precise subtask department assignment.",
        "Decide the target department for each subtask.",
        "",
        `Task: ${task.title}`,
        task.description ? `Task description: ${task.description}` : "",
        `Owner department id: ${baseDeptId ?? "unknown"}`,
        `Workflow phase: ${phase}`,
        "",
        "Valid departments:",
        deptGuide,
        "",
        "Subtasks:",
        subtaskGuide,
        "",
        "Return ONLY JSON in this exact shape:",
        "{\"assignments\":[{\"subtask_id\":\"...\",\"target_department_id\":\"department_id_or_null\",\"reason\":\"short reason\",\"confidence\":0.0}]}",
        "Rules:",
        "- Include one assignment per listed subtask_id.",
        "- If subtask stays in owner department, set target_department_id to null.",
        "- Do not invent subtask IDs or department IDs.",
        "- confidence must be between 0.0 and 1.0.",
      ].filter(Boolean).join("\n");

      const run = await runAgentOneShot(planningLeader, reroutePrompt, {
        projectPath: resolveProjectPath({
          title: task.title,
          description: task.description,
          project_path: task.project_path,
        }),
        timeoutMs: 180_000,
        rawOutput: true,
      });
      const assignments = parsePlannerSubtaskAssignments(run.text);
      if (assignments.length === 0) {
        appendTaskLog(taskId, "system", `Planning reroute skipped: parser found no assignment payload (${phase})`);
        return;
      }

      const subtaskById = new Map(subtasks.map((st) => [st.id, st]));
      const summaryByDept = new Map<string, number>();
      let updated = 0;

      for (const assignment of assignments) {
        const subtask = subtaskById.get(assignment.subtask_id);
        if (!subtask) continue;

        const normalizedTargetDept = normalizePlannerTargetDeptId(
          assignment.target_department_id,
          baseDeptId,
          deptRows,
        );

        let nextStatus = subtask.status;
        let nextBlockedReason = subtask.blocked_reason ?? null;
        let nextAssignee = subtask.assigned_agent_id ?? null;
        if (normalizedTargetDept) {
          const targetDeptName = getDeptName(normalizedTargetDept);
          const targetLeader = findTeamLeader(normalizedTargetDept);
          nextStatus = "blocked";
          nextBlockedReason = pickL(l(
            [`${targetDeptName} 협업 대기`],
            [`Waiting for ${targetDeptName} collaboration`],
            [`${targetDeptName}の協業待ち`],
            [`等待${targetDeptName}协作`],
          ), lang);
          if (targetLeader) nextAssignee = targetLeader.id;
        } else {
          if (subtask.status === "blocked") nextStatus = "pending";
          nextBlockedReason = null;
          if (task.assigned_agent_id) nextAssignee = task.assigned_agent_id;
        }

        const targetSame = (subtask.target_department_id ?? null) === normalizedTargetDept;
        const statusSame = subtask.status === nextStatus;
        const blockedSame = (subtask.blocked_reason ?? null) === (nextBlockedReason ?? null);
        const assigneeSame = (subtask.assigned_agent_id ?? null) === (nextAssignee ?? null);
        if (targetSame && statusSame && blockedSame && assigneeSame) continue;

        db.prepare(
          "UPDATE subtasks SET target_department_id = ?, status = ?, blocked_reason = ?, assigned_agent_id = ? WHERE id = ?"
        ).run(normalizedTargetDept, nextStatus, nextBlockedReason, nextAssignee, subtask.id);
        ctx.broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(subtask.id));

        updated++;
        const bucket = normalizedTargetDept ?? (baseDeptId ?? "owner");
        summaryByDept.set(bucket, (summaryByDept.get(bucket) ?? 0) + 1);
      }

      if (updated > 0) {
        const summaryText = [...summaryByDept.entries()].map(([deptId, cnt]) => `${deptId}:${cnt}`).join(", ");
        appendTaskLog(taskId, "system", `Planning leader rerouted ${updated} subtasks (${phase}) => ${summaryText}`);
        notifyCeo(pickL(l(
          [`'${task.title}' 서브태스크 분배를 기획팀장이 재판정하여 ${updated}건을 재배치했습니다. (${summaryText})`],
          [`Planning leader rerouted ${updated} subtasks for '${task.title}'. (${summaryText})`],
          [`'${task.title}' のサブタスク配分を企画リーダーが再判定し、${updated}件を再配置しました。（${summaryText}）`],
          [`规划负责人已重新判定'${task.title}'的子任务分配，并重分配了${updated}项。（${summaryText}）`],
        ), lang), taskId);
      }
    } catch (err: any) {
      appendTaskLog(
        taskId,
        "system",
        `Planning reroute failed (${phase}): ${err?.message ? String(err.message) : String(err)}`,
      );
    } finally {
      plannerSubtaskRoutingInFlight.delete(lockKey);
    }
  }

  return { rerouteSubtasksByPlanningLeader };
}
