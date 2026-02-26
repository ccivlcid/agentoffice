/**
 * WorkflowCoreExports — from initializeWorkflowPartA (workflow/core.ts).
 */

import type { ChildProcess } from "node:child_process";
import type { WebSocket } from "ws";

export interface WorkflowCoreExports {
  wsClients: Set<WebSocket>;
  activeProcesses: Map<string, ChildProcess>;
  stopRequestedTasks: Set<string>;
  stopRequestModeByTask: Map<string, "pause" | "cancel">;
  taskWorktrees: Map<string, { worktreePath: string; branchName: string; projectPath: string }>;
  TASK_RUN_IDLE_TIMEOUT_MS: number;
  TASK_RUN_HARD_TIMEOUT_MS: number;

  broadcast(type: string, payload: unknown): void;
  createWorktree: (...args: any[]) => any;
  mergeWorktree: (...args: any[]) => any;
  mergeToDevAndCreatePR: (...args: any[]) => any;
  cleanupWorktree: (...args: any[]) => any;
  rollbackTaskWorktree: (...args: any[]) => any;
  getWorktreeDiffSummary: (...args: any[]) => any;
  hasExplicitWarningFixRequest: (...args: any[]) => any;
  buildTaskExecutionPrompt: (...args: any[]) => any;
  generateProjectContext: (...args: any[]) => any;
  getRecentChanges: (...args: any[]) => any;
  ensureClaudeMd: (...args: any[]) => any;
  buildAgentArgs: (...args: any[]) => any;
  shouldSkipDuplicateCliOutput: (...args: any[]) => any;
  clearCliOutputDedup: (...args: any[]) => any;
  normalizeStreamChunk: (...args: any[]) => any;
  hasStructuredJsonLines: (...args: any[]) => any;
  getRecentConversationContext: (...args: any[]) => any;
  getTaskContinuationContext: (...args: any[]) => any;
  sleepMs(ms: number): Promise<void>;
  randomDelay: (...args: any[]) => any;
  getAgentDisplayName: (...args: any[]) => any;
  chooseSafeReply: (...args: any[]) => any;
  summarizeForMeetingBubble: (...args: any[]) => any;
  hasVisibleDiffSummary: (...args: any[]) => any;
  isDeferrableReviewHold: (...args: any[]) => any;
  classifyMeetingReviewDecision: (...args: any[]) => any;
  wantsReviewRevision: (...args: any[]) => any;
  findLatestTranscriptContentByAgent: (...args: any[]) => any;
  buildMeetingPrompt: (...args: any[]) => any;
  buildDirectReplyPrompt: (...args: any[]) => any;
  buildCliFailureMessage: (...args: any[]) => any;
  runAgentOneShot: (...args: any[]) => any;
}
