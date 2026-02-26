/**
 * WorkflowOrchestrationExports — from initializeWorkflowPartC (workflow/orchestration.ts).
 */

export interface WorkflowOrchestrationExports {
  crossDeptNextCallbacks: Map<string, () => void>;
  subtaskDelegationCallbacks: Map<string, () => void>;
  subtaskDelegationDispatchInFlight: Set<string>;
  delegatedTaskToSubtask: Map<string, string>;
  subtaskDelegationCompletionNoticeSent: Set<string>;
  meetingPresenceUntil: Map<string, number>;
  meetingSeatIndexByAgent: Map<string, number>;
  meetingPhaseByAgent: Map<string, "kickoff" | "review">;
  meetingTaskIdByAgent: Map<string, string>;
  meetingReviewDecisionByAgent: Map<string, "reviewing" | "approved" | "hold">;
  taskExecutionSessions: Map<string, any>;

  ensureTaskExecutionSession: (...args: any[]) => any;
  endTaskExecutionSession: (...args: any[]) => any;
  isTaskWorkflowInterrupted: (...args: any[]) => any;
  clearTaskWorkflowState: (...args: any[]) => any;
  startProgressTimer: (...args: any[]) => any;
  stopProgressTimer: (...args: any[]) => any;
  scheduleNextReviewRound: (...args: any[]) => any;
  notifyCeo: (...args: any[]) => any;
  isAgentInMeeting: (...args: any[]) => any;
  startTaskExecutionForAgent: (...args: any[]) => any;
  startPlannedApprovalMeeting: (...args: any[]) => any;
  handleTaskRunComplete: (...args: any[]) => any;
  finishReview: (...args: any[]) => any;
}
