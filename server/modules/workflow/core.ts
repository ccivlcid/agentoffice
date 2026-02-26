// @ts-nocheck

import type { RuntimeContext, WorkflowCoreExports } from "../../types/runtime-context.ts";
import { readNonNegativeIntEnv } from "../../db/runtime.ts";
import { createWsHub } from "../../ws/hub.ts";
import { createWorktreeModule } from "./worktree.ts";
import {
  hasExplicitWarningFixRequest,
  buildTaskExecutionPrompt,
  buildAvailableSkillsPromptBlock as _buildAvailableSkillsPromptBlock,
} from "./core-prompt-policy.ts";
import {
  generateProjectContext as _generateProjectContext,
  getRecentChanges as _getRecentChanges,
  ensureClaudeMd,
} from "./core-project-context.ts";
import {
  buildAgentArgs,
  shouldSkipDuplicateCliOutput as _shouldSkipDuplicateCliOutput,
  clearCliOutputDedup,
  normalizeStreamChunk,
  hasStructuredJsonLines,
  getRecentConversationContext as _getRecentConversationContext,
  getTaskContinuationContext as _getTaskContinuationContext,
} from "./core-cli-helpers.ts";
import {
  sleepMs,
  randomDelay,
  getAgentDisplayName,
  normalizeMeetingLang,
  localeInstruction,
  normalizeConversationReply,
  summarizeForMeetingBubble as _summarizeForMeetingBubble,
  formatMeetingTranscript,
  compactTaskDescriptionForMeeting,
  classifyMeetingReviewDecision,
  wantsReviewRevision,
  isDeferrableReviewHold,
  findLatestTranscriptContentByAgent,
} from "./core-meeting-utils.ts";
import { runAgentOneShot as _runAgentOneShot } from "./core-oneshot.ts";
import {
  buildMeetingPrompt as _buildMeetingPrompt,
  buildDirectReplyPrompt as _buildDirectReplyPrompt,
  buildCliFailureMessage,
  chooseSafeReply as _chooseSafeReply,
} from "./core-prompt-builders.ts";

export function initializeWorkflowPartA(ctx: RuntimeContext): WorkflowCoreExports {
  const __ctx: RuntimeContext = ctx;
  const db = __ctx.db;
  const logsDir = __ctx.logsDir;
  const nowMs = __ctx.nowMs;

  // ---------------------------------------------------------------------------
  // Track active child processes
  // ---------------------------------------------------------------------------
  const activeProcesses = new Map<string, any>();
  const stopRequestedTasks = new Set<string>();
  const stopRequestModeByTask = new Map<string, "pause" | "cancel">();

  function readTimeoutMsEnv(name: string, fallbackMs: number): number {
    return readNonNegativeIntEnv(name, fallbackMs);
  }

  const TASK_RUN_IDLE_TIMEOUT_MS = readTimeoutMsEnv("TASK_RUN_IDLE_TIMEOUT_MS", 15 * 60_000);
  const TASK_RUN_HARD_TIMEOUT_MS = readTimeoutMsEnv("TASK_RUN_HARD_TIMEOUT_MS", 0);

  const worktree = createWorktreeModule(ctx);

  // ---------------------------------------------------------------------------
  // WebSocket setup
  // ---------------------------------------------------------------------------
  const { wsClients, broadcast } = createWsHub(nowMs);

  // ---------------------------------------------------------------------------
  // Bound helpers
  // ---------------------------------------------------------------------------

  function buildAvailableSkillsPromptBlock(provider: string): string {
    return _buildAvailableSkillsPromptBlock(db, provider);
  }

  function generateProjectContext(projectPath: string): string {
    return _generateProjectContext(projectPath, worktree.isGitRepo);
  }

  function getRecentChanges(projectPath: string, taskId: string): string {
    return _getRecentChanges(projectPath, taskId, db, worktree.isGitRepo);
  }

  function shouldSkipDuplicateCliOutput(taskId: string, stream: "stdout" | "stderr", text: string): boolean {
    return _shouldSkipDuplicateCliOutput(nowMs, taskId, stream, text);
  }

  function getRecentConversationContext(agentId: string, limit = 10): string {
    return _getRecentConversationContext(db, agentId, limit);
  }

  function summarizeForMeetingBubble(text: string, maxChars = 96, lang?: any): string {
    return _summarizeForMeetingBubble(
      text,
      (raw, prettyFn, mc) => normalizeConversationReply(raw, prettyFn, mc),
      __ctx.prettyStreamJson,
      __ctx.pickL,
      __ctx.getPreferredLanguage,
      maxChars,
      lang,
    );
  }

  function getTaskContinuationContext(taskId: string): string {
    return _getTaskContinuationContext(db, taskId, normalizeStreamChunk, summarizeForMeetingBubble);
  }

  function chooseSafeReply(run: any, lang: string, kind: any, agent?: any): string {
    return _chooseSafeReply(run, lang, kind, __ctx.prettyStreamJson, __ctx.detectLang, agent);
  }

  function buildMeetingPrompt(agent: any, opts: any): string {
    return _buildMeetingPrompt(agent, opts, {
      getDeptName: __ctx.getDeptName,
      getRoleLabel: __ctx.getRoleLabel,
      getDeptRoleConstraint: __ctx.getDeptRoleConstraint,
      getRecentConversationContext,
      getAgentDisplayNameFn: getAgentDisplayName,
      localeInstructionFn: localeInstruction,
      compactTaskDescriptionFn: compactTaskDescriptionForMeeting,
      formatMeetingTranscriptFn: (transcript, lang) =>
        formatMeetingTranscript(transcript, (t, mc) => summarizeForMeetingBubble(t, mc, lang), lang),
      normalizeMeetingLangFn: (val) => normalizeMeetingLang(val, __ctx.getPreferredLanguage),
    });
  }

  function buildDirectReplyPrompt(agent: any, ceoMessage: string, messageType: string): { prompt: string; lang: string } {
    return _buildDirectReplyPrompt(agent, ceoMessage, messageType, {
      resolveLang: __ctx.resolveLang,
      getDeptName: __ctx.getDeptName,
      getRoleLabel: __ctx.getRoleLabel,
      getDeptRoleConstraint: __ctx.getDeptRoleConstraint,
      getRecentConversationContext,
      getAgentDisplayNameFn: getAgentDisplayName,
      localeInstructionFn: localeInstruction,
    });
  }

  function runAgentOneShot(agent: any, prompt: string, opts: any = {}): Promise<any> {
    return _runAgentOneShot(agent, prompt, opts, {
      logsDir,
      broadcast,
      killPidTree: (...args: any[]) => __ctx.killPidTree(...args),
      getProviderModelConfig: () => __ctx.getProviderModelConfig(),
      executeCopilotAgent: (...args: any[]) => __ctx.executeCopilotAgent(...args),
      executeAntigravityAgent: (...args: any[]) => __ctx.executeAntigravityAgent(...args),
      executeApiProviderAgent: (...args: any[]) => __ctx.executeApiProviderAgent(...args),
      prettyStreamJson: __ctx.prettyStreamJson,
      getPreferredLanguage: __ctx.getPreferredLanguage,
    });
  }

  return {
    wsClients,
    broadcast,
    activeProcesses,
    stopRequestedTasks,
    stopRequestModeByTask,
    TASK_RUN_IDLE_TIMEOUT_MS,
    TASK_RUN_HARD_TIMEOUT_MS,
    taskWorktrees: worktree.taskWorktrees,
    createWorktree: worktree.createWorktree,
    mergeWorktree: worktree.mergeWorktree,
    mergeToDevAndCreatePR: worktree.mergeToDevAndCreatePR,
    cleanupWorktree: worktree.cleanupWorktree,
    rollbackTaskWorktree: worktree.rollbackTaskWorktree,
    getWorktreeDiffSummary: worktree.getWorktreeDiffSummary,
    hasExplicitWarningFixRequest,
    buildTaskExecutionPrompt,
    buildAvailableSkillsPromptBlock,
    generateProjectContext,
    getRecentChanges,
    ensureClaudeMd,
    buildAgentArgs,
    shouldSkipDuplicateCliOutput,
    clearCliOutputDedup,
    normalizeStreamChunk,
    hasStructuredJsonLines,
    getRecentConversationContext,
    getTaskContinuationContext,
    sleepMs,
    randomDelay,
    getAgentDisplayName,
    chooseSafeReply,
    summarizeForMeetingBubble,
    hasVisibleDiffSummary: worktree.hasVisibleDiffSummary,
    isDeferrableReviewHold,
    classifyMeetingReviewDecision,
    wantsReviewRevision,
    findLatestTranscriptContentByAgent,
    buildMeetingPrompt,
    buildDirectReplyPrompt,
    buildCliFailureMessage,
    runAgentOneShot,
  };
}
