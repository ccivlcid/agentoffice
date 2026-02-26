// @ts-nocheck

import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Shared workflow state maps and types
// ---------------------------------------------------------------------------

export const progressTimers = new Map<string, ReturnType<typeof setInterval>>();

export const crossDeptNextCallbacks = new Map<string, () => void>();

export const subtaskDelegationCallbacks = new Map<string, () => void>();
export const subtaskDelegationDispatchInFlight = new Set<string>();

export const delegatedTaskToSubtask = new Map<string, string>();
export const subtaskDelegationCompletionNoticeSent = new Set<string>();

export const reviewRoundState = new Map<string, number>();
export const reviewInFlight = new Set<string>();
export const meetingPresenceUntil = new Map<string, number>();
export const meetingSeatIndexByAgent = new Map<string, number>();
export const meetingPhaseByAgent = new Map<string, "kickoff" | "review">();
export const meetingTaskIdByAgent = new Map<string, string>();
export type MeetingReviewDecision = "reviewing" | "approved" | "hold";
export const meetingReviewDecisionByAgent = new Map<string, MeetingReviewDecision>();
export const projectReviewGateNotifiedAt = new Map<string, number>();

export interface TaskExecutionSessionState {
  sessionId: string;
  taskId: string;
  agentId: string;
  provider: string;
  openedAt: number;
  lastTouchedAt: number;
}

export const taskExecutionSessions = new Map<string, TaskExecutionSessionState>();

// ---------------------------------------------------------------------------
// Session helpers — created via factory to close over ctx
// ---------------------------------------------------------------------------

export function createSessionHelpers(ctx: {
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  stopRequestedTasks: Set<string>;
  clearCliOutputDedup: (taskId: string) => void;
  db: any;
}) {
  const { nowMs, appendTaskLog, stopRequestedTasks, clearCliOutputDedup, db } = ctx;

  function ensureTaskExecutionSession(
    taskId: string,
    agentId: string,
    provider: string,
  ): TaskExecutionSessionState {
    const now = nowMs();
    const existing = taskExecutionSessions.get(taskId);
    if (existing && existing.agentId === agentId && existing.provider === provider) {
      existing.lastTouchedAt = now;
      taskExecutionSessions.set(taskId, existing);
      return existing;
    }

    const nextSession: TaskExecutionSessionState = {
      sessionId: randomUUID(),
      taskId,
      agentId,
      provider,
      openedAt: now,
      lastTouchedAt: now,
    };
    taskExecutionSessions.set(taskId, nextSession);
    appendTaskLog(
      taskId,
      "system",
      existing
        ? `Execution session rotated: ${existing.sessionId} -> ${nextSession.sessionId} (agent=${agentId}, provider=${provider})`
        : `Execution session opened: ${nextSession.sessionId} (agent=${agentId}, provider=${provider})`,
    );
    return nextSession;
  }

  function endTaskExecutionSession(taskId: string, reason: string): void {
    const existing = taskExecutionSessions.get(taskId);
    if (!existing) return;
    taskExecutionSessions.delete(taskId);
    appendTaskLog(
      taskId,
      "system",
      `Execution session closed: ${existing.sessionId} (reason=${reason}, duration_ms=${Math.max(0, nowMs() - existing.openedAt)})`,
    );
  }

  function getTaskStatusById(taskId: string): string | null {
    const row = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status: string } | undefined;
    return row?.status ?? null;
  }

  function isTaskWorkflowInterrupted(taskId: string): boolean {
    const status = getTaskStatusById(taskId);
    if (!status) return true;
    if (stopRequestedTasks.has(taskId)) return true;
    return status === "cancelled" || status === "pending" || status === "done" || status === "inbox";
  }

  function clearTaskWorkflowState(taskId: string): void {
    clearCliOutputDedup(taskId);
    crossDeptNextCallbacks.delete(taskId);
    subtaskDelegationCallbacks.delete(taskId);
    subtaskDelegationDispatchInFlight.delete(taskId);
    delegatedTaskToSubtask.delete(taskId);
    subtaskDelegationCompletionNoticeSent.delete(taskId);
    reviewInFlight.delete(taskId);
    reviewInFlight.delete(`planned:${taskId}`);
    reviewRoundState.delete(taskId);
    reviewRoundState.delete(`planned:${taskId}`);
    const status = getTaskStatusById(taskId);
    if (status === "done" || status === "cancelled") {
      endTaskExecutionSession(taskId, `workflow_cleared_${status}`);
    }
  }

  return {
    ensureTaskExecutionSession,
    endTaskExecutionSession,
    getTaskStatusById,
    isTaskWorkflowInterrupted,
    clearTaskWorkflowState,
  };
}
