// @ts-nocheck

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Text cleaning utilities
// ---------------------------------------------------------------------------

export function cleanArchiveText(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return "";
  const normalized = raw
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\u001b\[[0-9;]*m/g, "");
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (/^{"type":/i.test(line)) return false;
      if (/^{"id":"item_/i.test(line)) return false;
      if (/"type":"(item\.completed|command_execution|reasoning|agent_message|item\.started|item\.in_progress)"/i.test(line)) return false;
      if (/"aggregated_output"|\"exit_code\"|\"session_id\"|\"total_cost_usd\"|\"usage\"/i.test(line)) return false;
      if (/^\(Use `node --trace-warnings/i.test(line)) return false;
      if (/^command\s+["'`]/i.test(line)) return false;
      if (/^\[[A-Za-z-]+\]\s+/.test(line) && line.includes("listening on http://")) return false;
      return true;
    });
  const text = lines.join("\n").replace(/[ \t]+\n/g, "\n").trim();
  return text;
}

export function clipArchiveText(value: unknown, maxChars = 1800): string {
  const text = cleanArchiveText(value);
  if (!text) return "";
  if (!Number.isFinite(maxChars) || maxChars <= 0) return text;
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()}...`;
}

export function buildFallbackPlanningArchive(
  rootTask: Record<string, unknown>,
  entries: Array<Record<string, unknown>>,
  lang: string,
): string {
  const header = `# Final Consolidated Report: ${rootTask.title ?? "Project"}`;
  const summaryTitle = "## Executive Summary";
  const teamTitle = "## Team Consolidation";
  const lines = [
    header,
    "",
    summaryTitle,
    "Compiled team outputs at project completion. See the sections below for latest team report/result snippets.",
    "",
    teamTitle,
    "",
  ];
  entries.forEach((entry, idx) => {
    const dept = String(entry.dept_name ?? entry.department_id ?? "-");
    const agent = String(entry.agent_name ?? "-");
    const status = String(entry.status ?? "-");
    const completedAt = Number(entry.completed_at ?? 0);
    const latestReport = String(entry.latest_report ?? "");
    const resultSnippet = String(entry.result_snippet ?? "");
    lines.push(`### ${idx + 1}. ${entry.title ?? "Task"}`);
    lines.push(`- Department: ${dept}`);
    lines.push(`- Agent: ${agent}`);
    lines.push(`- Status: ${status}`);
    lines.push(`- Completed: ${completedAt > 0 ? new Date(completedAt).toISOString() : "-"}`);
    lines.push(`- Latest report: ${latestReport || "-"}`);
    lines.push(`- Result snippet: ${resultSnippet || "-"}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Archive helpers factory
// ---------------------------------------------------------------------------

export function createArchiveHelpers(ctx: {
  db: any;
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  broadcast: (...args: any[]) => void;
  notifyCeo: (content: string, taskId?: string | null) => void;
  notifyTaskStatus: (...args: any[]) => void;
  resolveLang: (...args: any[]) => any;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  findTeamLeader: (...args: any[]) => any;
  getAgentDisplayName: (...args: any[]) => string;
  getRoleLabel: (...args: any[]) => string;
  sendAgentMessage: (...args: any[]) => void;
  runAgentOneShot: (...args: any[]) => Promise<any>;
  normalizeConversationReply: (...args: any[]) => string;
  setTaskCreationAuditCompletion: (...args: any[]) => void;
  refreshCliUsageData: () => Promise<any>;
  recoverCrossDeptQueueAfterMissingCallback: (...args: any[]) => void;
  crossDeptNextCallbacks: Map<string, () => void>;
  subtaskDelegationCallbacks: Map<string, () => void>;
  reviewRoundState: Map<string, number>;
  reviewInFlight: Set<string>;
  endTaskExecutionSession: (taskId: string, reason: string) => void;
  archivePlanningConsolidatedReport: (rootTaskId: string) => Promise<void>;
  shouldDeferTaskReportUntilPlanningArchive: (task: any) => boolean;
  emitTaskReportEvent: (taskId: string) => void;
}) {
  const {
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus,
    resolveLang, pickL, l, findTeamLeader, getAgentDisplayName, getRoleLabel,
    sendAgentMessage, runAgentOneShot, normalizeConversationReply,
    setTaskCreationAuditCompletion, refreshCliUsageData,
    recoverCrossDeptQueueAfterMissingCallback,
    crossDeptNextCallbacks, subtaskDelegationCallbacks,
    reviewRoundState, reviewInFlight, endTaskExecutionSession,
    archivePlanningConsolidatedReport, shouldDeferTaskReportUntilPlanningArchive,
    emitTaskReportEvent,
  } = ctx;

  function completeTaskWithoutReview(
    task: {
      id: string;
      title: string;
      description: string | null;
      department_id: string | null;
      source_task_id: string | null;
      assigned_agent_id: string | null;
    },
    note: string,
  ): void {
    const t = nowMs();
    const lang = resolveLang(task.description ?? task.title);
    appendTaskLog(task.id, "system", note);
    db.prepare(
      "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?"
    ).run(t, t, task.id);
    setTaskCreationAuditCompletion(task.id, true);
    reviewRoundState.delete(task.id);
    reviewInFlight.delete(task.id);
    endTaskExecutionSession(task.id, "task_done_no_review");

    const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id);
    broadcast("task_update", updatedTask);
    notifyTaskStatus(task.id, task.title, "done", lang);

    refreshCliUsageData().then((usage) => broadcast("cli_usage_update", usage)).catch(() => {});
    const deferTaskReport = shouldDeferTaskReportUntilPlanningArchive(task);
    if (deferTaskReport) {
      appendTaskLog(task.id, "system", "Task report popup deferred until planning consolidated archive is ready");
    } else {
      emitTaskReportEvent(task.id);
    }

    const reporter = task.assigned_agent_id
      ? (db.prepare("SELECT * FROM agents WHERE id = ?").get(task.assigned_agent_id) as any | undefined)
      : undefined;
    if (reporter) {
      sendAgentMessage(
        reporter,
        pickL(l(
          [`대표님, '${task.title}' 보고 업무를 검토 회의 없이 완료 처리했습니다.`],
          [`CEO, '${task.title}' report work was completed without review meeting.`],
          [`CEO、'${task.title}' の報告業務をレビュー会議なしで完了処理しました。`],
          [`CEO，'${task.title}' 报告任务已在无评审会议情况下完成。`],
        ), lang),
        "report",
        "all",
        null,
        task.id,
      );
    }

    const leader = findTeamLeader(task.department_id);
    const leaderName = leader
      ? getAgentDisplayName(leader, lang)
      : pickL(l(["팀장"], ["Team Lead"], ["チームリーダー"], ["组长"]), lang);
    notifyCeo(pickL(l(
      [`${leaderName}: '${task.title}' 보고 업무를 검토 회의 없이 마감했습니다.`],
      [`${leaderName}: '${task.title}' report task was closed without review meeting.`],
      [`${leaderName}: '${task.title}' の報告業務をレビュー会議なしでクローズしました。`],
      [`${leaderName}：'${task.title}' 报告任务已无评审会议直接关闭。`],
    ), lang), task.id);

    if (!task.source_task_id) {
      void archivePlanningConsolidatedReport(task.id);
    }

    const nextCallback = crossDeptNextCallbacks.get(task.id);
    if (nextCallback) {
      crossDeptNextCallbacks.delete(task.id);
      nextCallback();
    } else {
      recoverCrossDeptQueueAfterMissingCallback(task.id);
    }
    const subtaskNext = subtaskDelegationCallbacks.get(task.id);
    if (subtaskNext) {
      subtaskDelegationCallbacks.delete(task.id);
      subtaskNext();
    }
  }

  return { completeTaskWithoutReview };
}
