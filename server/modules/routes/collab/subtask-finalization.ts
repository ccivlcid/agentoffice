// @ts-nocheck

import type { Lang } from "../../../types/lang.ts";
import { l, pickL } from "./agent-types.ts";

// ---------------------------------------------------------------------------
// Subtask delegation finalization, completion handlers
// ---------------------------------------------------------------------------

export function initializeSubtaskFinalization(deps: {
  db: any;
  nowMs: () => number;
  broadcast: any;
  getPreferredLanguage: () => Lang;
  appendTaskLog: any;
  handleTaskRunComplete: any;
  stopRequestedTasks: Set<string>;
  stopRequestModeByTask: Map<string, string>;
  delegatedTaskToSubtask: Map<string, string>;
  subtaskDelegationCompletionNoticeSent: Set<string>;
  maybeNotifyAllSubtasksComplete: (parentTaskId: string, subtaskDelegationCompletionNoticeSent: Set<string>) => void;
}) {
  const {
    db, nowMs, broadcast, getPreferredLanguage, appendTaskLog, handleTaskRunComplete,
    stopRequestedTasks, stopRequestModeByTask, delegatedTaskToSubtask,
    subtaskDelegationCompletionNoticeSent, maybeNotifyAllSubtasksComplete,
  } = deps;

  function finalizeDelegatedSubtasks(delegatedTaskId: string, subtaskIds: string[], exitCode: number): void {
    if (subtaskIds.length === 0) return;

    const pausedRun = exitCode !== 0
      && stopRequestedTasks.has(delegatedTaskId)
      && stopRequestModeByTask.get(delegatedTaskId) === "pause";
    if (pausedRun) {
      appendTaskLog(
        delegatedTaskId, "system",
        "Delegated subtask finalization deferred (pause requested, waiting for resume)",
      );
      handleTaskRunComplete(delegatedTaskId, exitCode);
      return;
    }

    delegatedTaskToSubtask.delete(delegatedTaskId);
    handleTaskRunComplete(delegatedTaskId, exitCode);

    const lang = getPreferredLanguage();
    const blockedReason = pickL(l(
      ["위임 작업 실패"], ["Delegated task failed"],
      ["委任タスク失敗"], ["委派任务失败"],
    ), lang);
    const doneAt = nowMs();
    const touchedParentTaskIds = new Set<string>();

    for (const subtaskId of subtaskIds) {
      const sub = db.prepare("SELECT task_id FROM subtasks WHERE id = ?").get(subtaskId) as { task_id: string } | undefined;
      if (sub?.task_id) touchedParentTaskIds.add(sub.task_id);
      if (exitCode === 0) {
        db.prepare("UPDATE subtasks SET status = 'done', completed_at = ?, blocked_reason = NULL WHERE id = ?").run(doneAt, subtaskId);
      } else {
        db.prepare("UPDATE subtasks SET status = 'blocked', blocked_reason = ? WHERE id = ?").run(blockedReason, subtaskId);
      }
      broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(subtaskId));
    }

    if (exitCode === 0) {
      for (const parentTaskId of touchedParentTaskIds) {
        maybeNotifyAllSubtasksComplete(parentTaskId, subtaskDelegationCompletionNoticeSent);
      }
    }
  }

  function handleSubtaskDelegationComplete(delegatedTaskId: string, subtaskId: string, exitCode: number): void {
    finalizeDelegatedSubtasks(delegatedTaskId, [subtaskId], exitCode);
  }

  function handleSubtaskDelegationBatchComplete(delegatedTaskId: string, subtaskIds: string[], exitCode: number): void {
    finalizeDelegatedSubtasks(delegatedTaskId, subtaskIds, exitCode);
  }

  return {
    finalizeDelegatedSubtasks,
    handleSubtaskDelegationComplete,
    handleSubtaskDelegationBatchComplete,
  };
}
