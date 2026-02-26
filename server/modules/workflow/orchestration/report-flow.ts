// @ts-nocheck

import { randomUUID } from "node:crypto";

export const REPORT_FLOW_PREFIX = "[REPORT FLOW]";
export const REPORT_DESIGN_TASK_PREFIX = "[REPORT DESIGN TASK]";

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function readReportFlowValue(description: string | null | undefined, key: string): string | null {
  const source = String(description ?? "");
  const re = new RegExp(`${escapeRegExp(REPORT_FLOW_PREFIX)}\\s*${escapeRegExp(key)}=([^\\n\\r]+)`, "i");
  const m = source.match(re);
  return m ? m[1].trim() : null;
}

export function upsertReportFlowValue(description: string | null | undefined, key: string, value: string): string {
  const source = String(description ?? "");
  const line = `${REPORT_FLOW_PREFIX} ${key}=${value}`;
  const re = new RegExp(`${escapeRegExp(REPORT_FLOW_PREFIX)}\\s*${escapeRegExp(key)}=[^\\n\\r]*`, "i");
  if (re.test(source)) return source.replace(re, line);
  return source.trimEnd() ? `${source.trimEnd()}\n${line}` : line;
}

export function isReportRequestTask(task: { task_type?: string | null; description?: string | null } | null | undefined): boolean {
  if (!task) return false;
  const taskType = String(task.task_type ?? "");
  if (taskType !== "presentation" && taskType !== "documentation") return false;
  return /\[REPORT REQUEST\]/i.test(String(task.description ?? ""));
}

export function isPresentationReportTask(task: { task_type?: string | null; description?: string | null } | null | undefined): boolean {
  if (!isReportRequestTask(task)) return false;
  return String(task?.task_type ?? "") === "presentation";
}

export function isReportDesignCheckpointTask(task: { description?: string | null } | null | undefined): boolean {
  const re = new RegExp(escapeRegExp(REPORT_DESIGN_TASK_PREFIX), "i");
  return re.test(String(task?.description ?? ""));
}

export function extractReportDesignParentTaskId(task: {
  description?: string | null;
  source_task_id?: string | null;
} | null | undefined): string | null {
  if (!task) return null;
  const desc = String(task.description ?? "");
  const marker = desc.match(new RegExp(`${escapeRegExp(REPORT_DESIGN_TASK_PREFIX)}\\s*parent_task_id=([A-Za-z0-9-]{8,})`, "i"));
  if (marker?.[1]) return marker[1];
  const fallback = String(task.source_task_id ?? "").trim();
  return fallback || null;
}

export function extractReportPathByLabel(description: string | null | undefined, label: string): string | null {
  const desc = String(description ?? "");
  const re = new RegExp(`^${escapeRegExp(label)}:\\s*(.+)$`, "im");
  const m = desc.match(re);
  if (!m?.[1]) return null;
  const value = m[1].trim();
  return value || null;
}

// ---------------------------------------------------------------------------
// Report flow helpers — factory to close over ctx
// ---------------------------------------------------------------------------

export function createReportFlowHelpers(ctx: {
  db: any;
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  broadcast: (...args: any[]) => void;
  notifyCeo: (content: string, taskId?: string | null) => void;
  notifyTaskStatus: (...args: any[]) => void;
  recordTaskCreationAudit: (...args: any[]) => void;
  resolveLang: (...args: any[]) => any;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  randomDelay: (min: number, max: number) => number;
  getDeptName: (deptId: string) => string;
  getAgentDisplayName: (...args: any[]) => string;
  sendAgentMessage: (...args: any[]) => void;
  findTeamLeader: (...args: any[]) => any;
  startTaskExecutionForAgent: (...args: any[]) => void;
}) {
  const {
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus,
    recordTaskCreationAudit, resolveLang, pickL, l, randomDelay,
    getDeptName, getAgentDisplayName, sendAgentMessage, findTeamLeader,
    startTaskExecutionForAgent,
  } = ctx;

  function pickDesignCheckpointAgent(): any {
    const candidates = db.prepare(`
      SELECT *
      FROM agents
      WHERE department_id = 'design'
        AND COALESCE(cli_provider, '') IN ('claude','codex','gemini','opencode','copilot','antigravity','api')
      ORDER BY
        CASE status
          WHEN 'idle' THEN 0
          WHEN 'break' THEN 1
          WHEN 'working' THEN 2
          WHEN 'offline' THEN 9
          ELSE 8
        END,
        CASE role
          WHEN 'team_leader' THEN 0
          WHEN 'senior' THEN 1
          WHEN 'junior' THEN 2
          WHEN 'intern' THEN 3
          ELSE 4
        END,
        id ASC
    `).all();
    return candidates[0] ?? null;
  }

  function startReportDesignCheckpoint(task: {
    id: string;
    title: string;
    description: string | null;
    project_id?: string | null;
    project_path: string | null;
    assigned_agent_id: string | null;
  }): boolean {
    const lang = resolveLang(task.description ?? task.title);
    const designAgent = pickDesignCheckpointAgent();
    if (!designAgent) {
      appendTaskLog(task.id, "system", "Report design checkpoint skipped: no design agent available");
      return false;
    }

    const targetPath = extractReportPathByLabel(task.description, "Target file path");
    const researchPath = extractReportPathByLabel(task.description, "Research notes path");
    const fallbackMdPath = extractReportPathByLabel(task.description, "Fallback markdown path");
    const stampSource = targetPath || fallbackMdPath || `docs/reports/${new Date().toISOString().replace(/:/g, "-").slice(0, 16)}-report-deck.pptx`;
    const htmlWorkspaceHint = stampSource
      .replace(/-report-deck\.pptx$/i, "-slides/")
      .replace(/-report\.md$/i, "-slides/")
      .replace(/\.pptx$/i, "-slides/");
    const designHandoffPath = htmlWorkspaceHint.replace(/\/?$/, "").replace(/-slides$/i, "-design-handoff.md");

    const childTaskId = randomUUID();
    const t = nowMs();
    const designDescription = [
      `${REPORT_DESIGN_TASK_PREFIX} parent_task_id=${task.id}`,
      `${REPORT_FLOW_PREFIX} design_task=true`,
      `${REPORT_FLOW_PREFIX} design_checkpoint=single_pass`,
      "This is a report-design checkpoint task.",
      "Goal: review HTML slide sources used for PPT generation and improve visual quality where needed.",
      targetPath ? `Target PPT path: ${targetPath}` : "",
      `HTML workspace hint: ${htmlWorkspaceHint}`,
      researchPath ? `Research notes path: ${researchPath}` : "",
      fallbackMdPath ? `Fallback markdown path: ${fallbackMdPath}` : "",
      `Design handoff note path: ${designHandoffPath}`,
      "",
      "Rules:",
      "- Focus only on design quality and slide readability.",
      "- If HTML slide files exist, edit them directly and document changed files + rationale in handoff note.",
      "- If no HTML source exists, write clear recommendations and conversion guidance in handoff note.",
      "- Do not run final PPT submission; original report assignee will regenerate final PPT after your handoff.",
    ].filter(Boolean).join("\n");

    db.prepare(`
      INSERT INTO tasks (id, title, description, department_id, assigned_agent_id, project_id, status, priority, task_type, project_path, source_task_id, created_at, updated_at)
      VALUES (?, ?, ?, 'design', ?, ?, 'planned', 1, 'design', ?, ?, ?, ?)
    `).run(
      childTaskId,
      `[디자인 컨펌] ${task.title.length > 48 ? `${task.title.slice(0, 45).trimEnd()}...` : task.title}`,
      designDescription,
      designAgent.id,
      task.project_id ?? null,
      task.project_path ?? null,
      task.id,
      t,
      t,
    );
    recordTaskCreationAudit({
      taskId: childTaskId,
      taskTitle: `[디자인 컨펌] ${task.title.length > 48 ? `${task.title.slice(0, 45).trimEnd()}...` : task.title}`,
      taskStatus: "planned",
      departmentId: "design",
      assignedAgentId: designAgent.id,
      sourceTaskId: task.id,
      taskType: "design",
      projectPath: task.project_path ?? null,
      trigger: "workflow.report_design_checkpoint",
      triggerDetail: `parent_task=${task.id}`,
      actorType: "agent",
      actorId: designAgent.id,
      actorName: designAgent.name,
      body: {
        parent_task_id: task.id,
        html_workspace_hint: htmlWorkspaceHint,
        design_handoff_path: designHandoffPath,
      },
    });
    if (task.project_id) {
      db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(t, t, task.project_id);
    }

    const parentDescription = upsertReportFlowValue(
      upsertReportFlowValue(
        upsertReportFlowValue(
          upsertReportFlowValue(task.description, "design_review", "in_progress"),
          "final_regen", "pending",
        ),
        "html_workspace", htmlWorkspaceHint,
      ),
      "design_handoff_note", designHandoffPath,
    );
    db.prepare("UPDATE tasks SET status = 'pending', description = ?, updated_at = ? WHERE id = ?")
      .run(parentDescription, t, task.id);

    appendTaskLog(task.id, "system", `Status → pending (design checkpoint in progress by ${designAgent.name})`);
    appendTaskLog(task.id, "system", `Design checkpoint task created: ${childTaskId}`);
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id));
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(childTaskId));
    notifyTaskStatus(task.id, task.title, "pending", lang);

    notifyCeo(pickL(l(
      [`[REPORT FLOW] '${task.title}' 디자인 컨펌 1차를 위해 디자인팀(${designAgent.name})에게 HTML 점검 태스크를 위임했습니다.`],
      [`[REPORT FLOW] Delegated one-pass HTML design checkpoint for '${task.title}' to Design (${designAgent.name}).`],
      [`[REPORT FLOW] '${task.title}' の1回目デザイン確認として、Design (${designAgent.name}) にHTML点検タスクを委任しました。`],
      [`[REPORT FLOW] 已将 '${task.title}' 的一次性 HTML 设计确认任务委派给设计团队（${designAgent.name}）。`],
    ), lang), task.id);

    setTimeout(() => {
      const row = db.prepare("SELECT status FROM tasks WHERE id = ?").get(childTaskId) as { status: string } | undefined;
      if (!row || row.status !== "planned") return;
      startTaskExecutionForAgent(childTaskId, designAgent, "design", getDeptName("design"));
    }, randomDelay(700, 1400));

    return true;
  }

  function resumeReportAfterDesignCheckpoint(parentTaskId: string, triggerTaskId: string): void {
    const parent = db.prepare("SELECT * FROM tasks WHERE id = ?").get(parentTaskId) as {
      id: string;
      title: string;
      description: string | null;
      status: string;
      assigned_agent_id: string | null;
      department_id: string | null;
    } | undefined;
    if (!parent) return;
    if (!parent.assigned_agent_id) return;
    if (!["pending", "planned", "collaborating", "review"].includes(parent.status)) return;

    const assignee = db.prepare("SELECT * FROM agents WHERE id = ?").get(parent.assigned_agent_id) as any | undefined;
    if (!assignee) return;
    if (assignee.status === "working" && assignee.current_task_id && assignee.current_task_id !== parent.id) {
      appendTaskLog(parent.id, "system", `Final regeneration delayed: assignee ${assignee.name} is busy on ${assignee.current_task_id}`);
      notifyCeo(
        pickL(l(
          [`[REPORT FLOW] '${parent.title}' 최종 재생성은 담당자 ${assignee.name}가 현재 다른 작업(${assignee.current_task_id})을 수행 중이라 대기합니다.`],
          [`[REPORT FLOW] Final regeneration for '${parent.title}' is waiting because assignee ${assignee.name} is busy with another task (${assignee.current_task_id}).`],
          [`[REPORT FLOW] '${parent.title}' の最終再生成は、担当者 ${assignee.name} が別タスク(${assignee.current_task_id})を実行中のため待機します。`],
          [`[REPORT FLOW] '${parent.title}' 最终重生成需等待，因负责人 ${assignee.name} 正在处理其他任务（${assignee.current_task_id}）。`],
        ), resolveLang(parent.description ?? parent.title)),
        parent.id,
      );
      return;
    }

    const nextDescription = upsertReportFlowValue(
      upsertReportFlowValue(parent.description, "design_review", "done"),
      "final_regen", "ready",
    );
    const htmlWorkspace = readReportFlowValue(nextDescription, "html_workspace");
    const handoffNotePath = readReportFlowValue(nextDescription, "design_handoff_note");
    db.prepare("UPDATE tasks SET description = ?, status = 'planned', updated_at = ? WHERE id = ?")
      .run(nextDescription, nowMs(), parent.id);
    appendTaskLog(
      parent.id,
      "system",
      `Design checkpoint completed by ${triggerTaskId}; final PPT regeneration scheduled${handoffNotePath ? ` (handoff: ${handoffNotePath})` : ""}`,
    );
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(parent.id));

    const lang = resolveLang(parent.description ?? parent.title);
    notifyCeo(pickL(l(
      [`[REPORT FLOW] 디자인팀 1차 컨펌이 완료되어 '${parent.title}' 최종 PPT 재생성을 시작합니다. 이번 실행 완료 시 2차 컨펌 없이 마감합니다.${htmlWorkspace ? ` HTML 작업 경로: ${htmlWorkspace}.` : ""}${handoffNotePath ? ` 핸드오프 노트: ${handoffNotePath}.` : ""}`],
      [`[REPORT FLOW] Design checkpoint is complete; restarting final PPT regeneration for '${parent.title}'. This run will close without a second design approval.${htmlWorkspace ? ` HTML workspace: ${htmlWorkspace}.` : ""}${handoffNotePath ? ` Handoff note: ${handoffNotePath}.` : ""}`],
      [`[REPORT FLOW] デザイン確認が完了したため、'${parent.title}' の最終PPT再生成を再開します。今回は2次確認なしでクローズします。${htmlWorkspace ? ` HTML作業パス: ${htmlWorkspace}。` : ""}${handoffNotePath ? ` 引き継ぎノート: ${handoffNotePath}。` : ""}`],
      [`[REPORT FLOW] 设计确认已完成，开始重新生成 '${parent.title}' 的最终 PPT。本轮完成后将不再进行二次确认。${htmlWorkspace ? ` HTML 工作路径：${htmlWorkspace}。` : ""}${handoffNotePath ? ` 交接说明：${handoffNotePath}。` : ""}`],
    ), lang), parent.id);

    setTimeout(() => {
      const row = db.prepare("SELECT status FROM tasks WHERE id = ?").get(parent.id) as { status: string } | undefined;
      if (!row || row.status !== "planned") return;
      const deptId = assignee.department_id || parent.department_id || "planning";
      startTaskExecutionForAgent(parent.id, assignee, deptId, getDeptName(deptId));
    }, randomDelay(700, 1300));
  }
  return { startReportDesignCheckpoint, resumeReportAfterDesignCheckpoint };
}
