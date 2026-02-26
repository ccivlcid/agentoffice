// @ts-nocheck
/**
 * DB query helpers and section builder for task reports.
 * Extracted from task-reports.ts to reduce single-file size.
 */

import { randomUUID } from "node:crypto";
import {
  normalizeTaskText,
  buildTextPreview,
  extractTargetFilePath,
  extractDocumentPathCandidates,
  readReportDocument,
  sortReportDocuments,
  REPORT_DOC_TEXT_LIMIT,
} from "./task-reports-helpers.ts";

export function fetchMeetingMinutesForTask(db: any, taskId: string): Array<Record<string, unknown>> {
  return db.prepare(`
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
}

export function fetchReportMessages(db: any, taskId: string): Array<Record<string, unknown>> {
  return db.prepare(`
    SELECT m.id, m.content, m.created_at, m.sender_id,
           COALESCE(a.name, '') AS sender_name,
           COALESCE(a.name_ko, '') AS sender_name_ko,
           COALESCE(a.department_id, '') AS sender_department_id,
           COALESCE(d.name, '') AS sender_department_name,
           COALESCE(d.name_ko, '') AS sender_department_name_ko
    FROM messages m
    LEFT JOIN agents a ON a.id = m.sender_id
    LEFT JOIN departments d ON d.id = a.department_id
    WHERE m.task_id = ? AND m.message_type = 'report'
    ORDER BY m.created_at DESC
  `).all(taskId) as Array<Record<string, unknown>>;
}

function addTextDocument(
  docs: Array<Record<string, unknown>>,
  id: string,
  title: string,
  source: string,
  contentRaw: string,
  createdAt: number | null,
): void {
  const content = contentRaw.trim();
  if (!content) return;
  const truncated = content.length > REPORT_DOC_TEXT_LIMIT;
  const trimmed = truncated ? `${content.slice(0, REPORT_DOC_TEXT_LIMIT)}\n\n...[truncated]` : content;
  docs.push({
    id,
    title,
    source,
    path: null,
    mime: "text/plain",
    size_bytes: null,
    updated_at: createdAt,
    truncated,
    text_preview: buildTextPreview(trimmed),
    content: trimmed,
  });
}

export function buildTaskSection(
  db: any,
  taskRow: Record<string, unknown>,
  linkedSubtasks: Array<Record<string, unknown>>,
): Record<string, unknown> {
  const taskId = String(taskRow.id ?? "");
  const taskLogs = db.prepare(
    "SELECT kind, message, created_at FROM task_logs WHERE task_id = ? ORDER BY created_at ASC"
  ).all(taskId) as Array<{ kind: string; message: string; created_at: number }>;
  const taskMinutes = fetchMeetingMinutesForTask(db, taskId);
  const reportMessages = fetchReportMessages(db, taskId);
  const taskResult = normalizeTaskText(taskRow.result);
  const docs: Array<Record<string, unknown>> = [];

  if (taskResult) {
    addTextDocument(docs, `result:${taskId}`, "Execution Result", "task_result", taskResult, Number(taskRow.completed_at ?? 0) || null);
  }

  for (const msg of reportMessages.slice(0, 6)) {
    const content = normalizeTaskText(msg.content);
    if (!content) continue;
    const msgId = String(msg.id ?? randomUUID());
    const senderName = normalizeTaskText(msg.sender_name) || "Agent";
    addTextDocument(docs, `report-msg:${msgId}`, `Report by ${senderName}`, "report_message", content, Number(msg.created_at ?? 0) || null);
  }

  const targetFile = extractTargetFilePath(taskRow.description);
  const pathCandidates = new Set<string>();
  if (targetFile) pathCandidates.add(targetFile);
  for (const c of extractDocumentPathCandidates([
    normalizeTaskText(taskRow.description),
    taskResult,
    ...reportMessages.slice(0, 6).map((m) => normalizeTaskText(m.content)),
    ...taskLogs.slice(-8).map((l) => normalizeTaskText(l.message)),
  ])) {
    pathCandidates.add(c);
  }
  for (const candidate of pathCandidates) {
    const doc = readReportDocument(candidate, normalizeTaskText(taskRow.project_path) || null);
    if (doc) docs.push(doc);
  }

  const latestReportContent = normalizeTaskText(reportMessages[0]?.content);
  const fallbackSummary = latestReportContent
    || buildTextPreview(taskResult, 400)
    || buildTextPreview(normalizeTaskText(taskLogs[taskLogs.length - 1]?.message), 400);

  return {
    id: taskId,
    task_id: taskId,
    source_task_id: taskRow.source_task_id ?? null,
    title: taskRow.title ?? "",
    status: taskRow.status ?? "",
    department_id: taskRow.department_id ?? null,
    department_name: taskRow.dept_name ?? "",
    department_name_ko: taskRow.dept_name_ko ?? "",
    agent_id: taskRow.assigned_agent_id ?? null,
    agent_name: taskRow.agent_name ?? "",
    agent_name_ko: taskRow.agent_name_ko ?? "",
    agent_role: taskRow.agent_role ?? "",
    created_at: Number(taskRow.created_at ?? 0) || 0,
    started_at: Number(taskRow.started_at ?? 0) || null,
    completed_at: Number(taskRow.completed_at ?? 0) || null,
    summary: fallbackSummary,
    report_messages: reportMessages,
    logs: taskLogs,
    meeting_minutes: taskMinutes,
    documents: sortReportDocuments(docs),
    linked_subtasks: linkedSubtasks,
  };
}
