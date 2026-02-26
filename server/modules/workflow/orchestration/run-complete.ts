// @ts-nocheck

import fs from "node:fs";
import path from "node:path";
import { createRunReviewHelpers } from "./run-complete-review.ts";

export function createRunCompleteHelpers(ctx: {
  db: any;
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  broadcast: (...args: any[]) => void;
  notifyCeo: (content: string, taskId?: string | null) => void;
  notifyTaskStatus: (...args: any[]) => void;
  resolveLang: (...args: any[]) => any;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  getPreferredLanguage: () => string;
  logsDir: string;
  activeProcesses: Map<string, any>;
  stopRequestedTasks: Set<string>;
  stopRequestModeByTask: Map<string, string>;
  codexThreadToSubtask: Map<string, string>;
  crossDeptNextCallbacks: Map<string, () => void>;
  subtaskDelegationCallbacks: Map<string, () => void>;
  taskWorktrees: Map<string, any>;
  stopProgressTimer: (taskId: string) => void;
  clearTaskWorkflowState: (taskId: string) => void;
  processSubtaskDelegations: (taskId: string) => void;
  prettyStreamJson: (...args: any[]) => string;
  getWorktreeDiffSummary: (...args: any[]) => string;
  hasVisibleDiffSummary: (...args: any[]) => boolean;
  formatTaskSubtaskProgressSummary: (...args: any[]) => string;
  findTeamLeader: (...args: any[]) => any;
  getAgentDisplayName: (...args: any[]) => string;
  sendAgentMessage: (...args: any[]) => void;
  cleanupWorktree: (...args: any[]) => void;
  recoverCrossDeptQueueAfterMissingCallback: (...args: any[]) => void;
  reconcileDelegatedSubtasksAfterRun: (taskId: string, exitCode: number) => void;
  finishReview: (taskId: string, taskTitle: string, options?: any) => void;
  isReportDesignCheckpointTask: (task: any) => boolean;
  isPresentationReportTask: (task: any) => boolean;
  isReportRequestTask: (task: any) => boolean;
  extractReportDesignParentTaskId: (task: any) => string | null;
  readReportFlowValue: (desc: string | null | undefined, key: string) => string | null;
  upsertReportFlowValue: (desc: string | null | undefined, key: string, value: string) => string;
  startReportDesignCheckpoint: (task: any) => boolean;
  completeTaskWithoutReview: (task: any, note: string) => void;
  resumeReportAfterDesignCheckpoint: (parentTaskId: string, triggerTaskId: string) => void;
}) {
  const {
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus,
    resolveLang, pickL, l, logsDir,
    activeProcesses, stopRequestedTasks, stopRequestModeByTask,
    codexThreadToSubtask, crossDeptNextCallbacks, subtaskDelegationCallbacks,
    taskWorktrees, stopProgressTimer, clearTaskWorkflowState,
    processSubtaskDelegations, prettyStreamJson, getWorktreeDiffSummary,
    hasVisibleDiffSummary, formatTaskSubtaskProgressSummary, findTeamLeader,
    getAgentDisplayName, sendAgentMessage, cleanupWorktree,
    recoverCrossDeptQueueAfterMissingCallback,
    reconcileDelegatedSubtasksAfterRun, finishReview,
    isReportDesignCheckpointTask, isPresentationReportTask, isReportRequestTask,
    extractReportDesignParentTaskId, readReportFlowValue, upsertReportFlowValue,
    startReportDesignCheckpoint, completeTaskWithoutReview,
    resumeReportAfterDesignCheckpoint,
  } = ctx;

  const { handleRunSuccess, handleRunFailure } = createRunReviewHelpers({
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus,
    resolveLang, pickL, l, logsDir,
    crossDeptNextCallbacks, subtaskDelegationCallbacks, taskWorktrees,
    prettyStreamJson, getWorktreeDiffSummary, hasVisibleDiffSummary,
    formatTaskSubtaskProgressSummary, findTeamLeader, getAgentDisplayName,
    sendAgentMessage, cleanupWorktree, recoverCrossDeptQueueAfterMissingCallback,
    reconcileDelegatedSubtasksAfterRun, finishReview,
  });

  function handleTaskRunComplete(taskId: string, exitCode: number): void {
    activeProcesses.delete(taskId);
    stopProgressTimer(taskId);

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as {
      assigned_agent_id: string | null;
      department_id: string | null;
      title: string;
      description: string | null;
      status: string;
      task_type: string | null;
      project_id: string | null;
      project_path: string | null;
      source_task_id: string | null;
    } | undefined;
    const stopRequested = stopRequestedTasks.has(taskId);
    const stopMode = stopRequestModeByTask.get(taskId);
    stopRequestedTasks.delete(taskId);
    stopRequestModeByTask.delete(taskId);

    if (!task || stopRequested || task.status !== "in_progress") {
      if (task) {
        appendTaskLog(
          taskId,
          "system",
          `RUN completion ignored (status=${task.status}, exit=${exitCode}, stop_requested=${stopRequested ? "yes" : "no"}, stop_mode=${stopMode ?? "none"})`,
        );
      }
      const keepWorkflowForResume = stopRequested && stopMode === "pause";
      if (!keepWorkflowForResume) { clearTaskWorkflowState(taskId); }
      return;
    }

    for (const [tid, itemId] of codexThreadToSubtask) {
      const row = db.prepare("SELECT id FROM subtasks WHERE cli_tool_use_id = ? AND task_id = ?").get(itemId, taskId);
      if (row) codexThreadToSubtask.delete(tid);
    }

    const t = nowMs();
    const logKind = exitCode === 0 ? "completed" : "failed";
    appendTaskLog(taskId, "system", `RUN ${logKind} (exit code: ${exitCode})`);

    try {
      const logPath = path.join(logsDir, `${taskId}.log`);
      if (fs.existsSync(logPath)) {
        const raw = fs.readFileSync(logPath, "utf8");
        const result = raw.slice(-2000);
        if (result) db.prepare("UPDATE tasks SET result = ? WHERE id = ?").run(result, taskId);
      }
    } catch { /* ignore */ }

    if (exitCode === 0) {
      const pendingSubtasks = db.prepare(
        "SELECT id, target_department_id FROM subtasks WHERE task_id = ? AND status != 'done'"
      ).all(taskId) as Array<{ id: string; target_department_id: string | null }>;
      if (pendingSubtasks.length > 0) {
        const now = nowMs();
        for (const sub of pendingSubtasks) {
          if (!sub.target_department_id) {
            db.prepare("UPDATE subtasks SET status = 'done', completed_at = ? WHERE id = ?").run(now, sub.id);
            broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sub.id));
          }
        }
      }
      processSubtaskDelegations(taskId);
    }

    if (task?.assigned_agent_id) {
      db.prepare("UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ?").run(task.assigned_agent_id);
      if (exitCode === 0) {
        db.prepare("UPDATE agents SET stats_tasks_done = stats_tasks_done + 1, stats_xp = stats_xp + 10 WHERE id = ?").run(task.assigned_agent_id);
      }
      broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(task.assigned_agent_id));
    }

    if (exitCode === 0 && task) {
      if (isReportDesignCheckpointTask(task)) {
        const parentTaskId = extractReportDesignParentTaskId(task);
        completeTaskWithoutReview(
          { id: taskId, title: task.title, description: task.description, department_id: task.department_id, source_task_id: task.source_task_id, assigned_agent_id: task.assigned_agent_id },
          "Status → done (report design checkpoint completed; review meeting skipped)",
        );
        if (parentTaskId) { resumeReportAfterDesignCheckpoint(parentTaskId, taskId); }
        return;
      }

      if (isPresentationReportTask(task)) {
        const designReview = (readReportFlowValue(task.description, "design_review") ?? "pending").toLowerCase();
        if (designReview !== "done") {
          const started = startReportDesignCheckpoint({ id: taskId, title: task.title, description: task.description, project_id: task.project_id, project_path: task.project_path, assigned_agent_id: task.assigned_agent_id });
          if (started) return;
          db.prepare("UPDATE tasks SET description = ?, updated_at = ? WHERE id = ?").run(
            upsertReportFlowValue(upsertReportFlowValue(task.description, "design_review", "skipped"), "final_regen", "ready"),
            nowMs(), taskId,
          );
        }
        completeTaskWithoutReview(
          { id: taskId, title: task.title, description: task.description, department_id: task.department_id, source_task_id: task.source_task_id, assigned_agent_id: task.assigned_agent_id },
          "Status → done (report workflow: final PPT regenerated; second design confirmation skipped)",
        );
        return;
      }

      if (isReportRequestTask(task)) {
        completeTaskWithoutReview(
          { id: taskId, title: task.title, description: task.description, department_id: task.department_id, source_task_id: task.source_task_id, assigned_agent_id: task.assigned_agent_id },
          "Status → done (report workflow: review meeting skipped for documentation/report task)",
        );
        return;
      }
    }

    if (exitCode === 0) {
      handleRunSuccess(taskId, t, task);
    } else {
      handleRunFailure(taskId, exitCode, t, task);
    }
  }

  return { handleTaskRunComplete };
}
