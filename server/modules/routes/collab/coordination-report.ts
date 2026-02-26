// @ts-nocheck

import {
  REPORT_DEPT_LABELS,
  REPORT_PPT_TOOL_REPO,
  REPORT_PPT_TOOL_DIR,
  REPORT_PPT_DESIGN_SKILL,
  REPORT_PPT_PPTX_SKILL,
  REPORT_PPT_HTML2PPTX_SCRIPT,
  REPORT_PPT_RESEARCH_AGENT_GUIDE,
  REPORT_PPT_ORGANIZER_AGENT_GUIDE,
  REPORT_PLAYWRIGHT_MCP_REPO,
  REPORT_PLAYWRIGHT_MCP_DIR,
} from "./coordination-report-helpers.ts";

export function initializeCollabReport(deps: {
  db: any;
  nowMs: any;
  randomUUID: any;
  broadcast: any;
  resolveLang: any;
  l: any;
  pickL: any;
  getAgentDisplayName: any;
  notifyCeo: any;
  sendAgentMessage: any;
  appendTaskLog: any;
  recordTaskCreationAudit: any;
  startTaskExecutionForAgent: any;
  isTaskWorkflowInterrupted: any;
  randomDelay: any;
  normalizeTextField: any;
  detectProjectPath: any;
  resolveReportAssignee: any;
  stripReportRequestPrefix: any;
  detectReportOutputFormat: any;
  formatRecommendationList: any;
  pickPlanningReportAssignee: any;
}) {
  const {
    db, nowMs, randomUUID, broadcast, resolveLang, l, pickL, getAgentDisplayName,
    notifyCeo, sendAgentMessage, appendTaskLog, recordTaskCreationAudit,
    startTaskExecutionForAgent, isTaskWorkflowInterrupted, randomDelay,
    normalizeTextField, detectProjectPath, resolveReportAssignee,
    stripReportRequestPrefix, detectReportOutputFormat, formatRecommendationList,
    pickPlanningReportAssignee,
  } = deps;

  function handleReportRequest(targetAgentId: string, ceoMessage: string): boolean {
    const routing = resolveReportAssignee(targetAgentId);
    const reportAssignee = routing.assignee;
    if (!reportAssignee) return false;

    const lang = resolveLang(ceoMessage);
    const cleanRequest = stripReportRequestPrefix(ceoMessage) || ceoMessage.trim();
    const outputFormat = detectReportOutputFormat(cleanRequest);
    const outputLabel = outputFormat === "ppt" ? "PPT" : "MD";
    const outputExt = outputFormat === "ppt" ? "pptx" : "md";
    const taskType = outputFormat === "ppt" ? "presentation" : "documentation";
    const t = nowMs();
    const taskId = randomUUID();
    const assigneeDeptId = reportAssignee.department_id || "planning";
    const assigneeDeptName = REPORT_DEPT_LABELS[assigneeDeptId] || assigneeDeptId || "Planning";
    const requestPreview = cleanRequest.length > 64 ? `${cleanRequest.slice(0, 61).trimEnd()}...` : cleanRequest;
    const taskTitle = outputFormat === "ppt"
      ? `보고 자료(PPT) 작성: ${requestPreview}`
      : `보고 문서(MD) 작성: ${requestPreview}`;
    const detectedPath = detectProjectPath(cleanRequest);
    const fileStamp = new Date().toISOString().replace(/[:]/g, "-").slice(0, 16);
    const outputPath = outputFormat === "ppt"
      ? `docs/reports/${fileStamp}-report-deck.${outputExt}`
      : `docs/reports/${fileStamp}-report.${outputExt}`;
    const researchNotesPath = `docs/reports/${fileStamp}-research-notes.md`;
    const fallbackMdPath = `docs/reports/${fileStamp}-report-fallback.md`;
    let linkedProjectId: string | null = null;
    let linkedProjectPath: string | null = detectedPath ?? null;
    if (detectedPath) {
      const projectByPath = db.prepare(`
        SELECT id, project_path
        FROM projects
        WHERE project_path = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(detectedPath) as { id: string; project_path: string } | undefined;
      if (projectByPath) {
        linkedProjectId = projectByPath.id;
        linkedProjectPath = projectByPath.project_path;
      }
    }
    if (!linkedProjectId && routing.requestedAgent?.current_task_id) {
      const currentProject = db.prepare(`
        SELECT t.project_id, p.project_path
        FROM tasks t
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.id = ?
        LIMIT 1
      `).get(routing.requestedAgent.current_task_id) as {
        project_id: string | null;
        project_path: string | null;
      } | undefined;
      linkedProjectId = normalizeTextField(currentProject?.project_id);
      if (!linkedProjectPath) linkedProjectPath = normalizeTextField(currentProject?.project_path);
    }
    const recommendationText = formatRecommendationList(routing.claudeRecommendations);

    const description = [
      `[REPORT REQUEST] ${cleanRequest}`,
      "[REPORT FLOW] review_meeting=skip_for_report",
      outputFormat === "ppt" ? "[REPORT FLOW] design_review=pending" : "[REPORT FLOW] design_review=not_required",
      outputFormat === "ppt" ? "[REPORT FLOW] final_regen=pending" : "[REPORT FLOW] final_regen=not_required",
      "",
      `Primary output format: ${outputLabel}`,
      `Target file path: ${outputPath}`,
      `Research notes path: ${researchNotesPath}`,
      outputFormat === "ppt" ? `Fallback markdown path: ${fallbackMdPath}` : "",
      "Tool preset: web-search + playwright-mcp + ppt_team_agent",
      "",
      "Default Tooling (must apply):",
      "- Web search: research the requested topic first and include source URLs + access date for major claims.",
      `- Browser MCP tool: playwright-mcp (${REPORT_PLAYWRIGHT_MCP_REPO})`,
      `- Local browser MCP workspace: ${REPORT_PLAYWRIGHT_MCP_DIR}`,
      `- PPT generation tool (required for PPT output when available): ${REPORT_PPT_TOOL_REPO}`,
      `- Local tool workspace: ${REPORT_PPT_TOOL_DIR}`,
      outputFormat === "ppt" ? `- [PPT SKILL MANDATE] Read and apply design skill guide first: ${REPORT_PPT_DESIGN_SKILL}` : "",
      outputFormat === "ppt" ? `- [PPT SKILL MANDATE] Follow pptx workflow guide: ${REPORT_PPT_PPTX_SKILL}` : "",
      outputFormat === "ppt" ? `- [PPT SKILL MANDATE] Use html->pptx conversion workflow/script: ${REPORT_PPT_HTML2PPTX_SCRIPT}` : "",
      outputFormat === "ppt" ? `- [PPT SKILL MANDATE] Use research/organizer agent guides for quality bar: ${REPORT_PPT_RESEARCH_AGENT_GUIDE}, ${REPORT_PPT_ORGANIZER_AGENT_GUIDE}` : "",
      `- This repository tracks both tools as pinned git submodules at ${REPORT_PLAYWRIGHT_MCP_DIR} and ${REPORT_PPT_TOOL_DIR}; do not auto-clone from runtime.`,
      `- If submodule content is missing: git submodule update --init --recursive ${REPORT_PLAYWRIGHT_MCP_DIR} ${REPORT_PPT_TOOL_DIR}`,
      "Rules:",
      "- This is a report/documentation request only; do not execute implementation work.",
      "- Follow sequence: research -> evidence notes -> output artifact.",
      outputFormat === "ppt"
        ? "- For PPT workflow, generate and maintain editable HTML slide sources first (do not skip HTML intermediate artifacts)."
        : "",
      outputFormat === "ppt"
        ? `- For PPT output, do not skip ${REPORT_PPT_TOOL_DIR} skill workflow; apply design-skill and pptx-skill guidance before final deck generation.`
        : "",
      outputFormat === "ppt"
        ? "- Final PPT must be regenerated from the HTML sources after the design checkpoint handoff."
        : "",
      outputFormat === "ppt"
        ? "- Deliver .pptx first. If PPT generation fails, submit markdown fallback with failure reason and manual conversion guidance."
        : "- Create a complete markdown report with structured headings and evidence.",
      routing.claudeUnavailable
        ? "- Claude Code assignee is unavailable in the priority departments. You must attempt PPT creation yourself first; fallback to markdown only when PPT generation fails."
        : "- Claude Code priority routing is enabled for PPT reliability.",
      "- Include executive summary, key findings, quantitative evidence, risks, and next actions.",
    ].join("\n");

    db.prepare(`
      INSERT INTO tasks (id, title, description, department_id, assigned_agent_id, project_id, status, priority, task_type, project_path, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'planned', 1, ?, ?, ?, ?)
    `).run(
      taskId,
      taskTitle,
      description,
      assigneeDeptId,
      reportAssignee.id,
      linkedProjectId,
      taskType,
      linkedProjectPath,
      t,
      t,
    );
    recordTaskCreationAudit({
      taskId,
      taskTitle,
      taskStatus: "planned",
      departmentId: assigneeDeptId,
      assignedAgentId: reportAssignee.id,
      taskType,
      projectPath: linkedProjectPath,
      trigger: "workflow.report_request",
      triggerDetail: `format=${outputFormat}; assignee=${reportAssignee.name}`,
      actorType: "agent",
      actorId: reportAssignee.id,
      actorName: reportAssignee.name,
      body: {
        clean_request: cleanRequest,
        output_format: outputFormat,
        output_path: outputPath,
        research_notes_path: researchNotesPath,
        fallback_md_path: fallbackMdPath,
      },
    });
    if (linkedProjectId) {
      db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(t, t, linkedProjectId);
    }

    db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(taskId, reportAssignee.id);
    appendTaskLog(taskId, "system", `Report request received via chat: ${cleanRequest}`);
    appendTaskLog(
      taskId,
      "system",
      `Report routing: assignee=${reportAssignee.name} provider=${reportAssignee.cli_provider || "unknown"} format=${outputLabel}`,
    );
    if (routing.reroutedToClaude && routing.requestedAgent) {
      appendTaskLog(
        taskId,
        "system",
        `Claude Code recommendation applied (requested=${routing.requestedAgent.name}/${routing.requestedAgent.cli_provider || "unknown"}): ${recommendationText}`,
      );
    }
    if (routing.claudeUnavailable) {
      appendTaskLog(taskId, "system", "No Claude Code candidate found in priority departments; fallback assignment used.");
    }
    if (detectedPath) {
      appendTaskLog(taskId, "system", `Project path detected: ${detectedPath}`);
    }

    const assigneeName = getAgentDisplayName(reportAssignee, lang);
    const providerLabel = reportAssignee.cli_provider || "claude";
    sendAgentMessage(
      reportAssignee,
      pickL(l(
        [`${assigneeName}입니다. 보고 요청을 접수했습니다. ${outputLabel} 형식으로 작성해 제출하겠습니다.`],
        [`${assigneeName} here. Report request received. I'll deliver it in ${outputLabel} format.`],
        [`${assigneeName}です。レポート依頼を受領しました。${outputLabel}形式で作成して提出します。`],
        [`${assigneeName}收到报告请求，将按${outputLabel}格式完成并提交。`],
      ), lang),
      "report",
      "all",
      null,
      taskId,
    );

    notifyCeo(pickL(l(
      [`[REPORT ROUTING] '${taskTitle}' 요청을 ${assigneeName}(${providerLabel})에게 배정했습니다. 출력 형식: ${outputLabel}`],
      [`[REPORT ROUTING] Assigned '${taskTitle}' to ${assigneeName} (${providerLabel}). Output format: ${outputLabel}`],
      [`[REPORT ROUTING] '${taskTitle}' を ${assigneeName} (${providerLabel}) に割り当てました。出力形式: ${outputLabel}`],
      [`[REPORT ROUTING] 已将'${taskTitle}'分配给${assigneeName}（${providerLabel}）。输出格式：${outputLabel}`],
    ), lang), taskId);
    if (routing.reroutedToClaude && routing.requestedAgent) {
      const requestedName = getAgentDisplayName(routing.requestedAgent, lang);
      notifyCeo(pickL(l(
        [`[CLAUDE RECOMMENDATION] 요청 대상 ${requestedName}(${routing.requestedAgent.cli_provider || "unknown"})는 Claude Code가 아니어서 Claude Code 우선 라우팅을 적용했습니다. 우선순위 추천: ${recommendationText}`],
        [`[CLAUDE RECOMMENDATION] Requested agent ${requestedName} (${routing.requestedAgent.cli_provider || "unknown"}) is not on Claude Code, so Claude-priority routing was applied. Priority recommendations: ${recommendationText}`],
        [`[CLAUDE RECOMMENDATION] 依頼先 ${requestedName}（${routing.requestedAgent.cli_provider || "unknown"}）は Claude Code ではないため、Claude 優先ルーティングを適用しました。優先候補: ${recommendationText}`],
        [`[CLAUDE RECOMMENDATION] 请求目标 ${requestedName}（${routing.requestedAgent.cli_provider || "unknown"}）不是 Claude Code，已启用 Claude 优先路由。优先推荐：${recommendationText}`],
      ), lang), taskId);
    }
    if (routing.claudeUnavailable) {
      notifyCeo(pickL(l(
        ["[CLAUDE RECOMMENDATION] 우선순위 부서(기획>개발>디자인>QA>운영)에서 Claude Code 에이전트를 찾지 못해 현재 담당자가 PPT를 우선 시도하고, 실패 시 MD로 대체하도록 지시했습니다."],
        ["[CLAUDE RECOMMENDATION] No Claude Code agent was found in priority departments (Planning>Development>Design>QA>Operations). The current assignee was instructed to attempt PPT first, then fallback to MD on failure."],
        ["[CLAUDE RECOMMENDATION] 優先部門（企画>開発>デザイン>QA>運用）に Claude Code エージェントがいないため、現担当者にPPT優先・失敗時MD代替を指示しました。"],
        ["[CLAUDE RECOMMENDATION] 在优先部门（企划>开发>设计>QA>运营）中未找到 Claude Code 代理，已要求当前负责人先尝试 PPT，失败时改为 MD。"],
      ), lang), taskId);
    }

    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
    broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(reportAssignee.id));

    setTimeout(() => {
      if (isTaskWorkflowInterrupted(taskId)) return;
      startTaskExecutionForAgent(taskId, reportAssignee, assigneeDeptId, assigneeDeptName);
    }, randomDelay(900, 1600));

    return true;
  }

  return {
    handleReportRequest,
    pickPlanningReportAssignee,
  };
}
