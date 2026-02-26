// @ts-nocheck

import { randomUUID } from "node:crypto";
import { cleanArchiveText, clipArchiveText, buildFallbackPlanningArchive } from "./archive.ts";

// ---------------------------------------------------------------------------
// emitTaskReportEvent + shouldDeferTaskReportUntilPlanningArchive +
// archivePlanningConsolidatedReport
// ---------------------------------------------------------------------------

export function createPlanningArchiveHelpers(ctx: {
  db: any;
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  broadcast: (...args: any[]) => void;
  notifyCeo: (content: string, taskId?: string | null) => void;
  resolveLang: (...args: any[]) => any;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  findTeamLeader: (...args: any[]) => any;
  sendAgentMessage: (...args: any[]) => void;
  runAgentOneShot: (...args: any[]) => Promise<any>;
  normalizeConversationReply: (...args: any[]) => string;
}) {
  const {
    db, nowMs, appendTaskLog, broadcast, notifyCeo,
    resolveLang, pickL, l, findTeamLeader,
    sendAgentMessage, runAgentOneShot, normalizeConversationReply,
  } = ctx;

  function emitTaskReportEvent(taskId: string): void {
    try {
      const reportTask = db.prepare(`
        SELECT t.id, t.title, t.description, t.department_id, t.assigned_agent_id,
               t.status, t.project_path, t.created_at, t.completed_at,
               COALESCE(a.name, '') AS agent_name,
               COALESCE(a.name_ko, '') AS agent_name_ko,
               COALESCE(a.role, '') AS agent_role,
               COALESCE(d.name, '') AS dept_name,
               COALESCE(d.name_ko, '') AS dept_name_ko
        FROM tasks t
        LEFT JOIN agents a ON a.id = t.assigned_agent_id
        LEFT JOIN departments d ON d.id = t.department_id
        WHERE t.id = ?
      `).get(taskId) as Record<string, unknown> | undefined;
      const reportLogs = db.prepare(
        "SELECT kind, message, created_at FROM task_logs WHERE task_id = ? ORDER BY created_at ASC"
      ).all(taskId) as Array<{ kind: string; message: string; created_at: number }>;
      const reportSubtasks = db.prepare(
        "SELECT id, title, status, assigned_agent_id, completed_at FROM subtasks WHERE task_id = ? ORDER BY created_at ASC"
      ).all(taskId) as Array<Record<string, unknown>>;
      const reportMinutes = db.prepare(`
        SELECT
          mm.meeting_type,
          mm.round AS round_number,
          COALESCE((
            SELECT group_concat(entry_line, '\n')
            FROM (
              SELECT printf('[%s] %s', COALESCE(e.speaker_name, 'Unknown'), e.content) AS entry_line
              FROM meeting_minute_entries e
              WHERE e.meeting_id = mm.id
              ORDER BY e.seq ASC, e.id ASC
            )
          ), '') AS entries,
          mm.created_at
        FROM meeting_minutes mm
        WHERE mm.task_id = ?
        ORDER BY mm.created_at ASC
      `).all(taskId) as Array<Record<string, unknown>>;
      if (reportTask) {
        broadcast("task_report", {
          task: reportTask,
          logs: reportLogs.slice(-30),
          subtasks: reportSubtasks,
          meeting_minutes: reportMinutes,
        });
      }
    } catch (reportErr) {
      console.error("[HyperClaw] task_report broadcast error:", reportErr);
    }
  }

  function shouldDeferTaskReportUntilPlanningArchive(task: {
    source_task_id?: string | null;
    department_id?: string | null;
  }): boolean {
    if (task.source_task_id) return false;
    const planningLeader = findTeamLeader("planning") || findTeamLeader(task.department_id ?? "");
    return Boolean(planningLeader);
  }

  async function archivePlanningConsolidatedReport(rootTaskId: string): Promise<void> {
    try {
      const rootTask = db.prepare(`
        SELECT id, title, description, project_path, completed_at, department_id
        FROM tasks
        WHERE id = ?
      `).get(rootTaskId) as {
        id: string;
        title: string;
        description: string | null;
        project_path: string | null;
        completed_at: number | null;
        department_id: string | null;
      } | undefined;
      if (!rootTask) return;

      const planningLeader = findTeamLeader("planning") || findTeamLeader(rootTask.department_id ?? "");
      if (!planningLeader) return;

      const relatedTasks = db.prepare(`
        SELECT t.id, t.title, t.status, t.department_id, t.assigned_agent_id, t.result, t.completed_at,
               COALESCE(a.name, '') AS agent_name,
               COALESCE(a.name_ko, '') AS agent_name_ko,
               COALESCE(d.name, '') AS dept_name,
               COALESCE(d.name_ko, '') AS dept_name_ko
        FROM tasks t
        LEFT JOIN agents a ON a.id = t.assigned_agent_id
        LEFT JOIN departments d ON d.id = t.department_id
        WHERE t.id = ? OR t.source_task_id = ?
        ORDER BY CASE WHEN t.id = ? THEN 0 ELSE 1 END, t.created_at ASC
      `).all(rootTaskId, rootTaskId, rootTaskId) as Array<Record<string, unknown>>;
      if (!relatedTasks.length) return;

      const entries = relatedTasks.map((task) => {
        const latestReport = db.prepare(`
          SELECT m.content, m.created_at
          FROM messages m
          WHERE m.task_id = ? AND m.message_type = 'report'
            AND m.content NOT LIKE '%최종 취합본을 생성해 아카이빙%'
            AND m.content NOT LIKE '%consolidated final report has been generated and archived%'
            AND m.content NOT LIKE '%最終統合レポートを生成し、アーカイブ%'
            AND m.content NOT LIKE '%最终汇总报告已生成并归档%'
          ORDER BY m.created_at DESC
          LIMIT 1
        `).get(task.id) as { content: string; created_at: number } | undefined;
        return {
          id: task.id,
          title: task.title,
          status: task.status,
          department_id: task.department_id,
          dept_name: task.dept_name,
          agent_name: task.agent_name,
          completed_at: task.completed_at,
          latest_report: clipArchiveText(latestReport?.content ?? "", 0),
          result_snippet: clipArchiveText(task.result ?? "", 0),
        };
      });

      const lang = resolveLang(rootTask.description ?? rootTask.title);
      const projectPath = rootTask.project_path || process.cwd();
      const evidenceBlock = entries.map((entry, idx) => [
        `### ${idx + 1}. ${entry.title ?? "Task"}`,
        `- Department: ${entry.dept_name || entry.department_id || "-"}`,
        `- Agent: ${entry.agent_name || "-"}`,
        `- Status: ${entry.status || "-"}`,
        `- Latest report: ${entry.latest_report || "-"}`,
        `- Result snippet: ${entry.result_snippet || "-"}`,
      ].join("\n")).join("\n\n");

      const consolidationPrompt = [
        `You are the planning lead (${planningLeader.name}).`,
        `Create one final consolidated markdown report for the CEO in language: ${lang}.`,
        "Requirements:",
        "- Must be concrete, not generic.",
        "- Include: Executive Summary, Team-by-team Consolidation, Evidence & Logs, Risks, Final Approval Note.",
        "- Mention all participating teams/tasks from the source.",
        "- Output only markdown.",
        `Project title: ${rootTask.title}`,
        `Project root task id: ${rootTaskId}`,
        "",
        "Source material:",
        evidenceBlock,
      ].join("\n");

      let summaryMarkdown = "";
      try {
        const run = await runAgentOneShot(planningLeader, consolidationPrompt, {
          projectPath,
          timeoutMs: 45_000,
        });
        summaryMarkdown = cleanArchiveText(normalizeConversationReply(run.text || "", 12_000, { maxSentences: 0 }).trim());
      } catch {
        summaryMarkdown = "";
      }

      if (!summaryMarkdown || summaryMarkdown.length < 240) {
        summaryMarkdown = buildFallbackPlanningArchive(rootTask as Record<string, unknown>, entries, lang);
      }
      const evidenceHeader = "## Consolidation Evidence Snapshot";
      const hasEvidenceHeader = summaryMarkdown.includes(evidenceHeader);
      if (!hasEvidenceHeader) {
        const evidenceLines = entries.map((entry, idx) => {
          const dept = String(entry.dept_name || entry.department_id || "-");
          const agent = String(entry.agent_name || "-");
          const latestReport = cleanArchiveText(entry.latest_report ?? "");
          const resultSnippet = cleanArchiveText(entry.result_snippet ?? "");
          return [
            `### ${idx + 1}. ${entry.title ?? "Task"}`,
            `- Department: ${dept}`,
            `- Agent: ${agent}`,
            `- Status: ${entry.status || "-"}`,
            `- Latest report: ${latestReport || "-"}`,
            `- Result snippet: ${resultSnippet || "-"}`,
          ].join("\n");
        }).join("\n\n");
        summaryMarkdown = `${summaryMarkdown}\n\n${evidenceHeader}\n\n${evidenceLines}`.trim();
      }

      const t = nowMs();
      const snapshot = JSON.stringify({
        root_task_id: rootTaskId,
        generated_at: t,
        entries,
      });
      db.prepare(`
        INSERT INTO task_report_archives (
          id, root_task_id, generated_by_agent_id, summary_markdown, source_snapshot_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(root_task_id) DO UPDATE SET
          generated_by_agent_id = excluded.generated_by_agent_id,
          summary_markdown = excluded.summary_markdown,
          source_snapshot_json = excluded.source_snapshot_json,
          updated_at = excluded.updated_at
      `).run(randomUUID(), rootTaskId, planningLeader.id, summaryMarkdown, snapshot, t, t);

      appendTaskLog(
        rootTaskId,
        "system",
        `Planning consolidated archive updated (${planningLeader.name}, chars=${summaryMarkdown.length})`,
      );
      sendAgentMessage(
        planningLeader,
        pickL(l(
          ["대표님, 기획팀장 최종 취합본을 생성해 아카이빙했습니다. 보고서 팝업에서 확인하실 수 있습니다."],
          ["CEO, the planning lead consolidated final report has been generated and archived. You can review it from the report popup."],
          ["CEO、企画リード最終統合レポートを生成し、アーカイブしました。レポートポップアップから確認できます。"],
          ["CEO，规划负责人最终汇总报告已生成并归档，可在报告弹窗中查看。"],
        ), lang),
        "report",
        "all",
        null,
        rootTaskId,
      );
      broadcast("task_report", { task: { id: rootTaskId } });
    } catch (err) {
      console.error("[HyperClaw] planning archive generation error:", err);
    }
  }

  return { emitTaskReportEvent, shouldDeferTaskReportUntilPlanningArchive, archivePlanningConsolidatedReport };
}
