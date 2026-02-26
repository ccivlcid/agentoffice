// @ts-nocheck

import type { RuntimeContext, RouteCollabExports } from "../../types/runtime-context.ts";
import { isLang, type Lang } from "../../types/lang.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { PKG_VERSION } from "../../config/runtime.ts";
import { notifyTaskStatus } from "../../gateway/client.ts";
import { BUILTIN_GITHUB_CLIENT_ID, BUILTIN_GOOGLE_CLIENT_ID, BUILTIN_GOOGLE_CLIENT_SECRET, OAUTH_BASE_URL, OAUTH_ENCRYPTION_SECRET, OAUTH_STATE_TTL_MS, appendOAuthQuery, b64url, pkceVerifier, sanitizeOAuthRedirect, encryptSecret, decryptSecret } from "../../oauth/helpers.ts";
import { initializeCollabCoordination } from "./collab/coordination.ts";
import { DEPT_KEYWORDS, l, pickL, getRoleLabel, initializeAgentTypes } from "./collab/agent-types.ts";
import { initializeChatReplies } from "./collab/chat-replies.ts";
import {
  analyzeDirectivePolicy,
  shouldExecuteDirectiveDelegation,
  normalizeTextField,
  buildRoundGoal,
  initializeDirectivePolicy,
} from "./collab/directive-policy.ts";
import { initializeDelegationHelpers } from "./collab/delegation-helpers.ts";
import { initializeSubtaskDelegation } from "./collab/subtask-delegation.ts";
import { initializeSubtaskFinalization } from "./collab/subtask-finalization.ts";
import { initializeTaskDelegation } from "./collab/task-delegation.ts";
import { initializeDirectChat } from "./collab/direct-chat.ts";

export function registerRoutesPartB(ctx: RuntimeContext): RouteCollabExports {
  const __ctx: RuntimeContext = ctx;
  const CLI_STATUS_TTL = __ctx.CLI_STATUS_TTL;
  const CLI_TOOLS = __ctx.CLI_TOOLS;
  const MODELS_CACHE_TTL = __ctx.MODELS_CACHE_TTL;
  const IdempotencyConflictError = __ctx.IdempotencyConflictError;
  const StorageBusyError = __ctx.StorageBusyError;
  const activeProcesses = __ctx.activeProcesses;
  const analyzeSubtaskDepartment = __ctx.analyzeSubtaskDepartment;
  const app = __ctx.app;
  const appendTaskLog = __ctx.appendTaskLog;
  const broadcast = __ctx.broadcast;
  const buildCliFailureMessage = __ctx.buildCliFailureMessage;
  const buildDirectReplyPrompt = __ctx.buildDirectReplyPrompt;
  const executeApiProviderAgent = __ctx.executeApiProviderAgent;
  const executeCopilotAgent = __ctx.executeCopilotAgent;
  const executeAntigravityAgent = __ctx.executeAntigravityAgent;
  const buildTaskExecutionPrompt = __ctx.buildTaskExecutionPrompt;
  const cachedCliStatus = __ctx.cachedCliStatus;
  const cachedModels = __ctx.cachedModels;
  const chooseSafeReply = __ctx.chooseSafeReply;
  const cleanupWorktree = __ctx.cleanupWorktree;
  const clearTaskWorkflowState = __ctx.clearTaskWorkflowState;
  const createWorktree = __ctx.createWorktree;
  const crossDeptNextCallbacks = __ctx.crossDeptNextCallbacks;
  const db = __ctx.db;
  const dbPath = __ctx.dbPath;
  const delegatedTaskToSubtask = __ctx.delegatedTaskToSubtask;
  const deptCount = __ctx.deptCount;
  const detectAllCli = __ctx.detectAllCli;
  const endTaskExecutionSession = __ctx.endTaskExecutionSession;
  const ensureClaudeMd = __ctx.ensureClaudeMd;
  const ensureOAuthActiveAccount = __ctx.ensureOAuthActiveAccount;
  const ensureTaskExecutionSession = __ctx.ensureTaskExecutionSession;
  const execWithTimeout = __ctx.execWithTimeout;
  const fetchClaudeUsage = __ctx.fetchClaudeUsage;
  const fetchCodexUsage = __ctx.fetchCodexUsage;
  const fetchGeminiUsage = __ctx.fetchGeminiUsage;
  const finishReview = __ctx.finishReview;
  const firstQueryValue = __ctx.firstQueryValue;
  const generateProjectContext = __ctx.generateProjectContext;
  const getActiveOAuthAccountIds = __ctx.getActiveOAuthAccountIds;
  const getAgentDisplayName = __ctx.getAgentDisplayName;
  const getNextOAuthLabel = __ctx.getNextOAuthLabel;
  const getOAuthAccounts = __ctx.getOAuthAccounts;
  const getPreferredOAuthAccounts = __ctx.getPreferredOAuthAccounts;
  const getProviderModelConfig = __ctx.getProviderModelConfig;
  const getRecentChanges = __ctx.getRecentChanges;
  const getRecentConversationContext = __ctx.getRecentConversationContext;
  const getTaskContinuationContext = __ctx.getTaskContinuationContext;
  const handleTaskRunComplete = __ctx.handleTaskRunComplete;
  const hasExplicitWarningFixRequest = __ctx.hasExplicitWarningFixRequest;
  const hasStructuredJsonLines = __ctx.hasStructuredJsonLines;
  const getNextHttpAgentPid = __ctx.getNextHttpAgentPid;
  const insertMessageWithIdempotency = __ctx.insertMessageWithIdempotency;
  const interruptPidTree = __ctx.interruptPidTree;
  const isTaskWorkflowInterrupted = __ctx.isTaskWorkflowInterrupted;
  const killPidTree = __ctx.killPidTree;
  const launchApiProviderAgent = __ctx.launchApiProviderAgent;
  const launchHttpAgent = __ctx.launchHttpAgent;
  const logsDir = __ctx.logsDir;
  const meetingPhaseByAgent = __ctx.meetingPhaseByAgent;
  const meetingPresenceUntil = __ctx.meetingPresenceUntil;
  const meetingReviewDecisionByAgent = __ctx.meetingReviewDecisionByAgent;
  const meetingSeatIndexByAgent = __ctx.meetingSeatIndexByAgent;
  const meetingTaskIdByAgent = __ctx.meetingTaskIdByAgent;
  const mergeWorktree = __ctx.mergeWorktree;
  const normalizeOAuthProvider = __ctx.normalizeOAuthProvider;
  const notifyCeo = __ctx.notifyCeo;
  const nowMs = __ctx.nowMs;
  const randomDelay = __ctx.randomDelay;
  const recordAcceptedIngressAuditOrRollback = __ctx.recordAcceptedIngressAuditOrRollback;
  const recordMessageIngressAuditOr503 = __ctx.recordMessageIngressAuditOr503;
  const recordTaskCreationAudit = __ctx.recordTaskCreationAudit;
  const refreshGoogleToken = __ctx.refreshGoogleToken;
  const removeActiveOAuthAccount = __ctx.removeActiveOAuthAccount;
  const resolveMessageIdempotencyKey = __ctx.resolveMessageIdempotencyKey;
  const rollbackTaskWorktree = __ctx.rollbackTaskWorktree;
  const runAgentOneShot = __ctx.runAgentOneShot;
  const seedApprovedPlanSubtasks = __ctx.seedApprovedPlanSubtasks;
  const setActiveOAuthAccount = __ctx.setActiveOAuthAccount;
  const setOAuthActiveAccounts = __ctx.setOAuthActiveAccounts;
  const spawnCliAgent = __ctx.spawnCliAgent;
  const startPlannedApprovalMeeting = __ctx.startPlannedApprovalMeeting;
  const startProgressTimer = __ctx.startProgressTimer;
  const startTaskExecutionForAgent = __ctx.startTaskExecutionForAgent;
  const stopProgressTimer = __ctx.stopProgressTimer;
  const stopRequestModeByTask = __ctx.stopRequestModeByTask;
  const stopRequestedTasks = __ctx.stopRequestedTasks;
  const subtaskDelegationCallbacks = __ctx.subtaskDelegationCallbacks;
  const subtaskDelegationCompletionNoticeSent = __ctx.subtaskDelegationCompletionNoticeSent;
  const subtaskDelegationDispatchInFlight = __ctx.subtaskDelegationDispatchInFlight;
  const taskExecutionSessions = __ctx.taskExecutionSessions;
  const taskWorktrees = __ctx.taskWorktrees;
  const withSqliteBusyRetry = __ctx.withSqliteBusyRetry;
  const prettyStreamJson = __ctx.prettyStreamJson;
  const refreshCliUsageData = __ctx.refreshCliUsageData;
  const buildHealthPayload = __ctx.buildHealthPayload;
  const consumeOAuthState = __ctx.consumeOAuthState;
  const upsertOAuthCredential = __ctx.upsertOAuthCredential;
  const startGitHubOAuth = __ctx.startGitHubOAuth;
  const startGoogleAntigravityOAuth = __ctx.startGoogleAntigravityOAuth;
  const handleGitHubCallback = __ctx.handleGitHubCallback;
  const handleGoogleAntigravityCallback = __ctx.handleGoogleAntigravityCallback;
  const buildOAuthStatus = __ctx.buildOAuthStatus;
  const fetchOpenCodeModels = __ctx.fetchOpenCodeModels;
  const cachedCliModels = __ctx.cachedCliModels;
  const readCodexModelsCache = __ctx.readCodexModelsCache;
  const fetchGeminiModels = __ctx.fetchGeminiModels;
  const toModelInfo = __ctx.toModelInfo;
  const cachedSkills = __ctx.cachedSkills;
  const SKILLS_CACHE_TTL = __ctx.SKILLS_CACHE_TTL;
  const fetchSkillsFromSite = __ctx.fetchSkillsFromSite;
  const readCliUsageFromDb = __ctx.readCliUsageFromDb;

  // ---------------------------------------------------------------------------
  // Initialize sub-module helpers
  // ---------------------------------------------------------------------------

  const agentTypesHelpers = initializeAgentTypes({ db, nowMs, broadcast });
  const { getPreferredLanguage, detectLang, resolveLang, sendAgentMessage } = agentTypesHelpers;

  const delegationHelpersModule = initializeDelegationHelpers({
    db, getPreferredLanguage, resolveLang, notifyCeo, appendTaskLog, finishReview,
  });
  const {
    getDeptName, getDeptRoleConstraint, findTeamLeader, findBestSubordinate,
    detectTargetDepartments, detectMentions, formatTaskSubtaskProgressSummary,
    maybeNotifyAllSubtasksComplete: _maybeNotifyAllSubtasksComplete,
    groupSubtasksByTargetDepartment, orderSubtaskQueuesByDepartment, hasOpenForeignSubtasks,
  } = delegationHelpersModule;

  // Wrap maybeNotifyAllSubtasksComplete to inject the shared Set
  function maybeNotifyAllSubtasksComplete(parentTaskId: string): void {
    _maybeNotifyAllSubtasksComplete(parentTaskId, subtaskDelegationCompletionNoticeSent);
  }

  const chatRepliesModule = initializeChatReplies({
    db, resolveLang, getDeptName, sendAgentMessage, getPreferredLanguage,
  });
  const { generateChatReply, scheduleAnnouncementReplies, scheduleTeamLeaderReplies } = chatRepliesModule;

  const directivePolicyModule = initializeDirectivePolicy({ db });
  const { resolveProjectFromOptions } = directivePolicyModule;

  const collabCoordination = initializeCollabCoordination({
    ...__ctx,
    resolveLang,
    l,
    pickL,
    sendAgentMessage,
    findBestSubordinate,
    findTeamLeader,
    getDeptName,
    getDeptRoleConstraint,
    maybeNotifyAllSubtasksComplete,
  });
  const {
    reconcileCrossDeptSubtasks,
    recoverCrossDeptQueueAfterMissingCallback,
    startCrossDeptCooperation,
    detectProjectPath,
    resolveProjectPath,
    getLatestKnownProjectPath,
    getDefaultProjectRoot,
    resolveDirectiveProjectPath,
    stripReportRequestPrefix,
    detectReportOutputFormat,
    pickPlanningReportAssignee,
    handleReportRequest,
  } = collabCoordination;

  const subtaskFinalizationModule = initializeSubtaskFinalization({
    db, nowMs, broadcast, getPreferredLanguage, appendTaskLog, handleTaskRunComplete,
    stopRequestedTasks, stopRequestModeByTask, delegatedTaskToSubtask,
    subtaskDelegationCompletionNoticeSent, maybeNotifyAllSubtasksComplete: _maybeNotifyAllSubtasksComplete,
  });
  const {
    finalizeDelegatedSubtasks,
    handleSubtaskDelegationComplete,
    handleSubtaskDelegationBatchComplete,
  } = subtaskFinalizationModule;

  const subtaskDelegationModule = initializeSubtaskDelegation({
    db, nowMs, broadcast, logsDir, resolveLang, getPreferredLanguage, getAgentDisplayName,
    getDeptName, getDeptRoleConstraint, getRecentConversationContext, buildTaskExecutionPrompt,
    hasExplicitWarningFixRequest, findTeamLeader, findBestSubordinate, notifyCeo, appendTaskLog,
    recordTaskCreationAudit, ensureTaskExecutionSession, ensureClaudeMd, createWorktree,
    spawnCliAgent, launchApiProviderAgent, launchHttpAgent, getNextHttpAgentPid,
    getProviderModelConfig, startProgressTimer, sendAgentMessage,
    maybeNotifyAllSubtasksComplete: _maybeNotifyAllSubtasksComplete,
    groupSubtasksByTargetDepartment, orderSubtaskQueuesByDepartment,
    subtaskDelegationDispatchInFlight, subtaskDelegationCompletionNoticeSent,
    subtaskDelegationCallbacks, delegatedTaskToSubtask, resolveProjectPath,
  });
  const { processSubtaskDelegations: _processSubtaskDelegations } = subtaskDelegationModule;

  // Wrap processSubtaskDelegations to inject handleSubtaskDelegationBatchComplete
  function processSubtaskDelegations(taskId: string): void {
    _processSubtaskDelegations(taskId, handleSubtaskDelegationBatchComplete);
  }

  const taskDelegationModule = initializeTaskDelegation({
    db, nowMs, broadcast, resolveLang, getDeptName, findTeamLeader, findBestSubordinate,
    detectTargetDepartments, sendAgentMessage, notifyCeo, appendTaskLog, recordTaskCreationAudit,
    isTaskWorkflowInterrupted, hasOpenForeignSubtasks, processSubtaskDelegations,
    startCrossDeptCooperation, startPlannedApprovalMeeting, seedApprovedPlanSubtasks,
    startTaskExecutionForAgent, resolveProjectFromOptions, resolveDirectiveProjectPath,
  });
  const { handleMentionDelegation, handleTaskDelegation } = taskDelegationModule;

  const directChatModule = initializeDirectChat({
    db, nowMs, broadcast, logsDir, resolveLang, randomDelay, getDeptName, sendAgentMessage,
    appendTaskLog, recordTaskCreationAudit, isTaskWorkflowInterrupted, startTaskExecutionForAgent,
    resolveProjectFromOptions, detectProjectPath, resolveProjectPath, buildDirectReplyPrompt,
    runAgentOneShot, chooseSafeReply, executeApiProviderAgent, executeCopilotAgent,
    executeAntigravityAgent, buildCliFailureMessage, handleTaskDelegation,
  });
  const { scheduleAgentReply } = directChatModule;

  return {
    DEPT_KEYWORDS,
    sendAgentMessage,
    getPreferredLanguage,
    resolveLang,
    detectLang,
    l,
    pickL,
    getRoleLabel,
    scheduleAnnouncementReplies,
    scheduleTeamLeaderReplies,
    normalizeTextField,
    analyzeDirectivePolicy,
    shouldExecuteDirectiveDelegation,
    detectTargetDepartments,
    detectMentions,
    handleMentionDelegation,
    findTeamLeader,
    getDeptName,
    getDeptRoleConstraint,
    formatTaskSubtaskProgressSummary,
    processSubtaskDelegations,
    reconcileCrossDeptSubtasks,
    recoverCrossDeptQueueAfterMissingCallback,
    resolveProjectPath,
    handleReportRequest,
    handleTaskDelegation,
    scheduleAgentReply,
  };
}
