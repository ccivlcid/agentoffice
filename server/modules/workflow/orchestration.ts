// @ts-nocheck

import type { RuntimeContext, WorkflowOrchestrationExports } from "../../types/runtime-context.ts";
import { notifyTaskStatus } from "../../gateway/client.ts";
import { initializeWorkflowMeetingTools } from "./orchestration/meetings.ts";
import {
  progressTimers, crossDeptNextCallbacks, subtaskDelegationCallbacks,
  subtaskDelegationDispatchInFlight, delegatedTaskToSubtask,
  subtaskDelegationCompletionNoticeSent, reviewRoundState, reviewInFlight,
  meetingPresenceUntil, meetingSeatIndexByAgent, meetingPhaseByAgent,
  meetingTaskIdByAgent, meetingReviewDecisionByAgent, projectReviewGateNotifiedAt,
  taskExecutionSessions, createSessionHelpers,
} from "./orchestration/state.ts";
import { getReviewRoundMode, createReviewRoundHelpers } from "./orchestration/review-rounds.ts";
import {
  readReportFlowValue, upsertReportFlowValue, isReportRequestTask,
  isPresentationReportTask, isReportDesignCheckpointTask, extractReportDesignParentTaskId,
  createReportFlowHelpers,
} from "./orchestration/report-flow.ts";
import { createArchiveHelpers } from "./orchestration/archive.ts";
import { createPlanningArchiveHelpers } from "./orchestration/planning-archive.ts";
import { createProgressTimerHelpers } from "./orchestration/progress-timer.ts";
import { createTaskExecutionHelpers } from "./orchestration/task-execution.ts";
import { createPlannedMeetingHelpers } from "./orchestration/planned-meeting.ts";
import { createReconcileHelpers } from "./orchestration/reconcile.ts";
import { createRunCompleteHelpers } from "./orchestration/run-complete.ts";
import { createFinishReviewHelpers } from "./orchestration/finish-review.ts";

export function initializeWorkflowPartC(ctx: RuntimeContext): WorkflowOrchestrationExports {
  const __ctx: RuntimeContext = ctx;
  const { db, nowMs, broadcast, appendTaskLog, randomDelay, sleepMs, getAgentDisplayName,
    runAgentOneShot, chooseSafeReply, buildMeetingPrompt, setTaskCreationAuditCompletion,
    recordTaskCreationAudit, normalizeConversationReply, activeProcesses, stopRequestedTasks,
    stopRequestModeByTask, codexThreadToSubtask, taskWorktrees, logsDir, clearCliOutputDedup,
    getWorktreeDiffSummary, hasVisibleDiffSummary, mergeWorktree, mergeToDevAndCreatePR,
    cleanupWorktree, createWorktree, ensureClaudeMd, getProviderModelConfig, getNextHttpAgentPid,
    launchApiProviderAgent, launchHttpAgent, spawnCliAgent, getRecentConversationContext,
    getTaskContinuationContext, getRecentChanges, buildTaskExecutionPrompt, hasExplicitWarningFixRequest,
  } = __ctx;
  const buildAvailableSkillsPromptBlock = __ctx.buildAvailableSkillsPromptBlock || ((p: string) => `[Available Skills][provider=${p || "unknown"}][unavailable]`);
  const resolveLang = (...a: any[]) => __ctx.resolveLang(...a);
  const pickL = (...a: any[]) => __ctx.pickL(...a);
  const l = (...a: any[]) => __ctx.l(...a);
  const findTeamLeader = (...a: any[]) => __ctx.findTeamLeader(...a);
  const getDeptName = (...a: any[]) => __ctx.getDeptName(...a);
  const getRoleLabel = (...a: any[]) => __ctx.getRoleLabel(...a);
  const sendAgentMessage = (...a: any[]) => __ctx.sendAgentMessage(...a);
  const formatTaskSubtaskProgressSummary = (...a: any[]) => __ctx.formatTaskSubtaskProgressSummary(...a);
  const getPreferredLanguage = (...a: any[]) => __ctx.getPreferredLanguage(...a);
  const refreshCliUsageData = (...a: any[]) => __ctx.refreshCliUsageData(...a);
  const recoverCrossDeptQueueAfterMissingCallback = (...a: any[]) => __ctx.recoverCrossDeptQueueAfterMissingCallback(...a);
  const processSubtaskDelegations = (...a: any[]) => __ctx.processSubtaskDelegations(...a);
  const resolveProjectPath = (...a: any[]) => __ctx.resolveProjectPath(...a);
  const prettyStreamJson = (...a: any[]) => __ctx.prettyStreamJson(...a);
  const getDeptRoleConstraint = (...a: any[]) => __ctx.getDeptRoleConstraint(...a);

  const sessionHelpers = createSessionHelpers({ nowMs, appendTaskLog, stopRequestedTasks, clearCliOutputDedup, db });
  const { ensureTaskExecutionSession, endTaskExecutionSession, getTaskStatusById, isTaskWorkflowInterrupted, clearTaskWorkflowState } = sessionHelpers;

  const progressTimerHelpers = createProgressTimerHelpers({ db, nowMs, broadcast, resolveLang, pickL, l, findTeamLeader, sendAgentMessage, progressTimers });
  const { startProgressTimer, stopProgressTimer, notifyCeo } = progressTimerHelpers;

  const planningArchiveHelpers = createPlanningArchiveHelpers({ db, nowMs, appendTaskLog, broadcast, notifyCeo, resolveLang, pickL, l, findTeamLeader, sendAgentMessage, runAgentOneShot, normalizeConversationReply });
  const { emitTaskReportEvent, shouldDeferTaskReportUntilPlanningArchive, archivePlanningConsolidatedReport } = planningArchiveHelpers;

  // Forward refs for circular dependency resolution
  let finishReviewFn: (...args: any[]) => void;
  let taskExecutionHelpers: ReturnType<typeof createTaskExecutionHelpers>;

  const reviewRoundHelpers = createReviewRoundHelpers({
    db, nowMs, appendTaskLog, reviewRoundState, reviewInFlight, projectReviewGateNotifiedAt,
    randomDelay, resolveLang, pickL, l, notifyCeo,
    finishReview: (tid, ttitle, opts) => finishReviewFn(tid, ttitle, opts),
  });
  const { getProjectReviewGateSnapshot, scheduleNextReviewRound } = reviewRoundHelpers;

  const workflowMeetingTools = initializeWorkflowMeetingTools(Object.assign(Object.create(__ctx), {
    progressTimers, reviewRoundState, reviewInFlight, meetingPresenceUntil,
    meetingSeatIndexByAgent, meetingPhaseByAgent, meetingTaskIdByAgent,
    meetingReviewDecisionByAgent, getTaskStatusById, getReviewRoundMode,
    scheduleNextReviewRound,
    startTaskExecutionForAgent: (tid: string, ag: any, deptId: string | null, dn: string) => taskExecutionHelpers.startTaskExecutionForAgent(tid, ag, deptId, dn),
    startProgressTimer, stopProgressTimer, notifyCeo,
  }));
  const {
    getLeadersByDepartmentIds, getAllActiveTeamLeaders, getTaskRelatedDepartmentIds,
    getTaskReviewLeaders, beginMeetingMinutes, appendMeetingMinuteEntry, finishMeetingMinutes,
    normalizeRevisionMemoNote, reserveReviewRevisionMemoItems, loadRecentReviewRevisionMemoItems,
    collectRevisionMemoItems, collectPlannedActionItems, appendTaskProjectMemo,
    appendTaskReviewFinalMemo, markAgentInMeeting, isAgentInMeeting, callLeadersToCeoOffice,
    dismissLeadersFromCeoOffice, emitMeetingSpeech, startReviewConsensusMeeting,
  } = workflowMeetingTools;

  const reportFlowHelpers = createReportFlowHelpers({
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus,
    recordTaskCreationAudit, resolveLang, pickL, l, randomDelay, getDeptName,
    getAgentDisplayName, sendAgentMessage, findTeamLeader,
    startTaskExecutionForAgent: (tid: string, ag: any, deptId: string | null, dn: string) => taskExecutionHelpers.startTaskExecutionForAgent(tid, ag, deptId, dn),
  });
  const { startReportDesignCheckpoint, resumeReportAfterDesignCheckpoint } = reportFlowHelpers;

  const archiveHelpers = createArchiveHelpers({
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus, resolveLang, pickL, l,
    findTeamLeader, getAgentDisplayName, getRoleLabel, sendAgentMessage, runAgentOneShot,
    normalizeConversationReply, setTaskCreationAuditCompletion, refreshCliUsageData,
    recoverCrossDeptQueueAfterMissingCallback, crossDeptNextCallbacks, subtaskDelegationCallbacks,
    reviewRoundState, reviewInFlight, endTaskExecutionSession,
    archivePlanningConsolidatedReport, shouldDeferTaskReportUntilPlanningArchive, emitTaskReportEvent,
  });
  const { completeTaskWithoutReview } = archiveHelpers;

  const finishReviewHelpers = createFinishReviewHelpers({
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus, resolveLang, pickL, l,
    findTeamLeader, getAgentDisplayName, formatTaskSubtaskProgressSummary,
    setTaskCreationAuditCompletion, refreshCliUsageData, taskWorktrees, mergeWorktree,
    mergeToDevAndCreatePR, cleanupWorktree, recoverCrossDeptQueueAfterMissingCallback,
    crossDeptNextCallbacks, subtaskDelegationCallbacks, reviewRoundState, reviewInFlight,
    projectReviewGateNotifiedAt, endTaskExecutionSession, getProjectReviewGateSnapshot,
    startReviewConsensusMeeting, archivePlanningConsolidatedReport,
    shouldDeferTaskReportUntilPlanningArchive, emitTaskReportEvent,
  });
  finishReviewFn = finishReviewHelpers.finishReview;
  const { finishReview } = finishReviewHelpers;

  const reconcileHelpers = createReconcileHelpers({ db, nowMs, appendTaskLog, broadcast, getPreferredLanguage, pickL, l, finishReview });
  const { reconcileDelegatedSubtasksAfterRun } = reconcileHelpers;

  const runCompleteHelpers = createRunCompleteHelpers({
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus, resolveLang, pickL, l,
    getPreferredLanguage, logsDir, activeProcesses, stopRequestedTasks, stopRequestModeByTask,
    codexThreadToSubtask, crossDeptNextCallbacks, subtaskDelegationCallbacks, taskWorktrees,
    stopProgressTimer, clearTaskWorkflowState, processSubtaskDelegations, prettyStreamJson,
    getWorktreeDiffSummary, hasVisibleDiffSummary, formatTaskSubtaskProgressSummary, findTeamLeader,
    getAgentDisplayName, sendAgentMessage, cleanupWorktree, recoverCrossDeptQueueAfterMissingCallback,
    reconcileDelegatedSubtasksAfterRun, finishReview, isReportDesignCheckpointTask,
    isPresentationReportTask, isReportRequestTask, extractReportDesignParentTaskId,
    readReportFlowValue, upsertReportFlowValue, startReportDesignCheckpoint,
    completeTaskWithoutReview, resumeReportAfterDesignCheckpoint,
  });
  const { handleTaskRunComplete } = runCompleteHelpers;

  taskExecutionHelpers = createTaskExecutionHelpers({
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus, resolveLang, pickL, l,
    logsDir, getDeptRoleConstraint, getDeptName, getAgentDisplayName, getRecentConversationContext,
    getTaskContinuationContext, getRecentChanges, getProviderModelConfig, getNextHttpAgentPid,
    resolveProjectPath, createWorktree, ensureClaudeMd, buildAvailableSkillsPromptBlock,
    buildTaskExecutionPrompt, hasExplicitWarningFixRequest, launchApiProviderAgent, launchHttpAgent,
    spawnCliAgent, startProgressTimer, ensureTaskExecutionSession, handleTaskRunComplete, randomDelay,
  });
  const { startTaskExecutionForAgent } = taskExecutionHelpers;

  const plannedMeetingHelpers = createPlannedMeetingHelpers({
    db, nowMs, appendTaskLog, broadcast, notifyCeo, resolveLang, pickL, l, randomDelay, sleepMs,
    getAgentDisplayName, getDeptName, getRoleLabel, resolveProjectPath, sendAgentMessage,
    runAgentOneShot, chooseSafeReply, buildMeetingPrompt, reviewRoundState, reviewInFlight,
    isTaskWorkflowInterrupted, getTaskStatusById, clearTaskWorkflowState, getTaskReviewLeaders,
    beginMeetingMinutes, finishMeetingMinutes, appendMeetingMinuteEntry, callLeadersToCeoOffice,
    dismissLeadersFromCeoOffice, emitMeetingSpeech, collectPlannedActionItems, appendTaskProjectMemo,
  });
  const { startPlannedApprovalMeeting } = plannedMeetingHelpers;

  return {
    crossDeptNextCallbacks, subtaskDelegationCallbacks, subtaskDelegationDispatchInFlight,
    delegatedTaskToSubtask, subtaskDelegationCompletionNoticeSent, meetingPresenceUntil,
    meetingSeatIndexByAgent, meetingPhaseByAgent, meetingTaskIdByAgent, meetingReviewDecisionByAgent,
    taskExecutionSessions, ensureTaskExecutionSession, endTaskExecutionSession,
    isTaskWorkflowInterrupted, clearTaskWorkflowState, startProgressTimer, stopProgressTimer,
    notifyCeo, archivePlanningConsolidatedReport, isAgentInMeeting, startTaskExecutionForAgent,
    startPlannedApprovalMeeting, scheduleNextReviewRound, handleTaskRunComplete, finishReview,
  };
}
