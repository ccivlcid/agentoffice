// @ts-nocheck
import { randomUUID } from "node:crypto";

export interface MeetingMinutesRow {
  id: string;
  task_id: string;
  meeting_type: "planned" | "review";
  round: number;
  title: string;
  status: "in_progress" | "completed" | "revision_requested" | "failed";
  started_at: number;
  completed_at: number | null;
  created_at: number;
}

export interface MeetingMinuteEntryRow {
  id: number;
  meeting_id: string;
  seq: number;
  speaker_agent_id: string | null;
  speaker_name: string;
  department_name: string | null;
  role_label: string | null;
  message_type: string;
  content: string;
  created_at: number;
}

export interface MinutesCtx {
  db: any;
  nowMs: () => number;
  getDeptName: (deptId: string) => string;
  getRoleLabel: (role: string, lang: any) => string;
  getAgentDisplayName: (agent: any, lang: string) => string;
}

export function makeMinutesHelpers(ctx: MinutesCtx) {
  const { db, nowMs, getDeptName, getRoleLabel, getAgentDisplayName } = ctx;

  function beginMeetingMinutes(
    taskId: string,
    meetingType: "planned" | "review",
    round: number,
    title: string,
  ): string {
    const meetingId = randomUUID();
    const t = nowMs();
    db.prepare(`
      INSERT INTO meeting_minutes (id, task_id, meeting_type, round, title, status, started_at, created_at)
      VALUES (?, ?, ?, ?, ?, 'in_progress', ?, ?)
    `).run(meetingId, taskId, meetingType, round, title, t, t);
    return meetingId;
  }

  function appendMeetingMinuteEntry(
    meetingId: string,
    seq: number,
    agent: any,
    lang: string,
    messageType: string,
    content: string,
  ): void {
    const deptName = getDeptName(agent.department_id ?? "");
    const roleLabel = getRoleLabel(agent.role, lang as any);
    db.prepare(`
      INSERT INTO meeting_minute_entries
        (meeting_id, seq, speaker_agent_id, speaker_name, department_name, role_label, message_type, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      meetingId,
      seq,
      agent.id,
      getAgentDisplayName(agent, lang),
      deptName || null,
      roleLabel || null,
      messageType,
      content,
      nowMs(),
    );
  }

  function finishMeetingMinutes(
    meetingId: string,
    status: "completed" | "revision_requested" | "failed",
  ): void {
    db.prepare(
      "UPDATE meeting_minutes SET status = ?, completed_at = ? WHERE id = ?"
    ).run(status, nowMs(), meetingId);
  }

  return {
    beginMeetingMinutes,
    appendMeetingMinuteEntry,
    finishMeetingMinutes,
  };
}
