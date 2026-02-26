// @ts-nocheck

import { createHash } from "node:crypto";
import type {
  ProjectReviewDecisionStateRow,
  ReviewRoundDecisionStateRow,
  PlanningLeadStateLike,
} from "./messages-types.ts";

export function buildDecisionStateHelpers(ctx: {
  db: any;
  nowMs: () => number;
  findTeamLeader: (dept: string) => any;
  getAgentDisplayName: (agent: any, lang: string) => string;
  l: (...args: any[]) => any;
  pickL: (val: any, lang: string) => string;
}) {
  const { db, nowMs, findTeamLeader, getAgentDisplayName, l, pickL } = ctx;

  function buildProjectReviewSnapshotHash(
    projectId: string,
    reviewTaskChoices: Array<{ id: string; updated_at: number }>,
  ): string {
    const base = [...reviewTaskChoices]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((task) => `${task.id}:${task.updated_at}`)
      .join("|");
    return createHash("sha256")
      .update(`${projectId}|${base}`)
      .digest("hex")
      .slice(0, 24);
  }

  function getProjectReviewDecisionState(projectId: string): ProjectReviewDecisionStateRow | null {
    const row = db.prepare(`
      SELECT
        project_id, snapshot_hash, status, planner_summary,
        planner_agent_id, planner_agent_name, created_at, updated_at
      FROM project_review_decision_states
      WHERE project_id = ?
    `).get(projectId) as ProjectReviewDecisionStateRow | undefined;
    return row ?? null;
  }

  function upsertProjectReviewDecisionState(
    projectId: string,
    snapshotHash: string,
    status: "collecting" | "ready" | "failed",
    plannerSummary: string | null,
    plannerAgentId: string | null,
    plannerAgentName: string | null,
  ): void {
    const ts = nowMs();
    db.prepare(`
      INSERT INTO project_review_decision_states (
        project_id, snapshot_hash, status, planner_summary,
        planner_agent_id, planner_agent_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        snapshot_hash = excluded.snapshot_hash,
        status = excluded.status,
        planner_summary = excluded.planner_summary,
        planner_agent_id = excluded.planner_agent_id,
        planner_agent_name = excluded.planner_agent_name,
        updated_at = excluded.updated_at
    `).run(projectId, snapshotHash, status, plannerSummary, plannerAgentId, plannerAgentName, ts, ts);
  }

  function buildReviewRoundSnapshotHash(
    meetingId: string,
    reviewRound: number,
    notes: string[],
  ): string {
    const base = [...notes]
      .map((note) => String(note ?? "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("|");
    return createHash("sha256")
      .update(`${meetingId}|round=${reviewRound}|${base}`)
      .digest("hex")
      .slice(0, 24);
  }

  function getReviewRoundDecisionState(meetingId: string): ReviewRoundDecisionStateRow | null {
    const row = db.prepare(`
      SELECT
        meeting_id, snapshot_hash, status, planner_summary,
        planner_agent_id, planner_agent_name, created_at, updated_at
      FROM review_round_decision_states
      WHERE meeting_id = ?
    `).get(meetingId) as ReviewRoundDecisionStateRow | undefined;
    return row ?? null;
  }

  function upsertReviewRoundDecisionState(
    meetingId: string,
    snapshotHash: string,
    status: "collecting" | "ready" | "failed",
    plannerSummary: string | null,
    plannerAgentId: string | null,
    plannerAgentName: string | null,
  ): void {
    const ts = nowMs();
    db.prepare(`
      INSERT INTO review_round_decision_states (
        meeting_id, snapshot_hash, status, planner_summary,
        planner_agent_id, planner_agent_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(meeting_id) DO UPDATE SET
        snapshot_hash = excluded.snapshot_hash,
        status = excluded.status,
        planner_summary = excluded.planner_summary,
        planner_agent_id = excluded.planner_agent_id,
        planner_agent_name = excluded.planner_agent_name,
        updated_at = excluded.updated_at
    `).run(meetingId, snapshotHash, status, plannerSummary, plannerAgentId, plannerAgentName, ts, ts);
  }

  function recordProjectReviewDecisionEvent(input: {
    project_id: string;
    snapshot_hash?: string | null;
    event_type: "planning_summary" | "representative_pick" | "followup_request" | "start_review_meeting";
    summary: string;
    selected_options_json?: string | null;
    note?: string | null;
    task_id?: string | null;
    meeting_id?: string | null;
  }): void {
    db.prepare(`
      INSERT INTO project_review_decision_events (
        project_id, snapshot_hash, event_type, summary,
        selected_options_json, note, task_id, meeting_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.project_id,
      input.snapshot_hash ?? null,
      input.event_type,
      input.summary,
      input.selected_options_json ?? null,
      input.note ?? null,
      input.task_id ?? null,
      input.meeting_id ?? null,
      nowMs(),
    );
  }

  function parseDecisionEventSelectedLabels(rawJson: string | null | undefined, limit = 4): string[] {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit || 4), 12));
    if (!rawJson || !String(rawJson).trim()) return [];
    try {
      const parsed = JSON.parse(String(rawJson));
      if (!Array.isArray(parsed)) return [];
      const out: string[] = [];
      const seen = new Set<string>();
      for (const item of parsed) {
        const label = String((item as { label?: unknown })?.label ?? "").replace(/\s+/g, " ").trim();
        if (!label) continue;
        const key = label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(label);
        if (out.length >= boundedLimit) break;
      }
      return out;
    } catch {
      return [];
    }
  }

  function getProjectReviewRoundDecisionContext(
    projectId: string,
    lang: string,
    limit = 8,
  ): string[] {
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit || 8), 20));
    const rows = db.prepare(`
      SELECT e.summary, e.selected_options_json, e.note, e.task_id, e.created_at,
        COALESCE(t.title, '') AS task_title
      FROM project_review_decision_events e
      LEFT JOIN tasks t ON t.id = e.task_id
      WHERE e.project_id = ? AND e.meeting_id IS NOT NULL
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT ?
    `).all(projectId, Math.max(boundedLimit * 3, boundedLimit)) as Array<{
      summary: string | null; selected_options_json: string | null;
      note: string | null; task_id: string | null;
      created_at: number | null; task_title: string | null;
    }>;

    const clip = (text: string, max = 200) => {
      const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
      if (!normalized) return "";
      return normalized.length > max ? `${normalized.slice(0, max - 3).trimEnd()}...` : normalized;
    };
    const taskLabel = pickL(l(["작업"], ["Task"], ["タスク"], ["任务"]), lang);
    const selectedLabel = pickL(l(["선택"], ["Picked"], ["選択"], ["已选"]), lang);
    const noteLabel = pickL(l(["추가의견"], ["Note"], ["追加意見"], ["追加意见"]), lang);
    const out: string[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const summary = clip(row.summary ?? "", 220);
      const selected = parseDecisionEventSelectedLabels(row.selected_options_json, 4)
        .map((label) => clip(label, 140)).filter(Boolean);
      const note = clip(row.note ?? "", 180);
      const taskTitle = clip(row.task_title ?? "", 120);
      const segments: string[] = [];
      if (taskTitle) segments.push(`${taskLabel}=${taskTitle}`);
      if (summary) segments.push(summary);
      if (selected.length > 0) segments.push(`${selectedLabel}=${selected.join(" | ")}`);
      if (note) segments.push(`${noteLabel}=${note}`);
      if (segments.length <= 0) continue;
      const line = `- ${segments.join(" / ")}`;
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
      if (out.length >= boundedLimit) break;
    }
    return out;
  }

  function formatPlannerSummaryForDisplay(input: string): string {
    let text = String(input ?? "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return "";
    text = text.replace(/\s*;\s*/g, ";\n").replace(/\s+(?=\d+[.)]\s)/g, "\n")
      .replace(/\s+(?=-\s)/g, "\n");
    if (!text.includes("\n") && text.length > 220) {
      text = text.replace(/([.!?])\s+/g, "$1\n")
        .replace(/(합니다\.|입니다\.|됩니다\.|습니다\.|요\.)\s+/g, "$1\n");
    }
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  function resolvePlanningLeadMeta(
    lang: string,
    decisionState?: PlanningLeadStateLike | null,
  ): { agent_id: string | null; agent_name: string; agent_name_ko: string; agent_avatar: string } {
    const fallbackLead = findTeamLeader("planning");
    const stateAgentId = String(decisionState?.planner_agent_id ?? "").trim();
    const stateAgent = stateAgentId
      ? db.prepare(`SELECT id, name, name_ko, avatar_emoji FROM agents WHERE id = ? LIMIT 1`)
          .get(stateAgentId) as { id: string; name: string; name_ko: string; avatar_emoji: string | null } | undefined
      : undefined;
    const picked = stateAgent ?? fallbackLead;
    const defaultName = pickL(l(["기획팀장"], ["Planning Lead"], ["企画リード"], ["规划负责人"]), lang);
    const normalizePlanningLeadAvatar = (rawAvatar: string | null | undefined): string => {
      const avatar = String(rawAvatar ?? "").trim();
      if (!avatar || avatar === "🧠") return "🧑‍💼";
      return avatar;
    };
    return {
      agent_id: picked?.id ?? null,
      agent_name: (picked?.name || decisionState?.planner_agent_name || defaultName).trim(),
      agent_name_ko: (picked?.name_ko || decisionState?.planner_agent_name || "기획팀장").trim(),
      agent_avatar: normalizePlanningLeadAvatar(picked?.avatar_emoji),
    };
  }

  return {
    buildProjectReviewSnapshotHash,
    getProjectReviewDecisionState,
    upsertProjectReviewDecisionState,
    buildReviewRoundSnapshotHash,
    getReviewRoundDecisionState,
    upsertReviewRoundDecisionState,
    recordProjectReviewDecisionEvent,
    parseDecisionEventSelectedLabels,
    getProjectReviewRoundDecisionContext,
    formatPlannerSummaryForDisplay,
    resolvePlanningLeadMeta,
  };
}
