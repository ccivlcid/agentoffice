// @ts-nocheck

import type { RuntimeContext } from "../../../types/runtime-context.ts";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
import { PKG_VERSION } from "../../../config/runtime.ts";
import { notifyTaskStatus } from "../../../gateway/client.ts";
import { BUILTIN_GITHUB_CLIENT_ID, BUILTIN_GOOGLE_CLIENT_ID, BUILTIN_GOOGLE_CLIENT_SECRET, OAUTH_BASE_URL, OAUTH_ENCRYPTION_SECRET, OAUTH_STATE_TTL_MS, appendOAuthQuery, b64url, pkceVerifier, sanitizeOAuthRedirect, encryptSecret, decryptSecret } from "../../../oauth/helpers.ts";
import { initializeCollabHelpers } from "./coordination-helpers.ts";
import { initializeCollabPaths } from "./coordination-paths.ts";
import { initializeCollabDirectives } from "./coordination-directives.ts";
import { initializeCollabRecovery } from "./coordination-recovery.ts";
import { initializeCollabReportHelpers } from "./coordination-report-helpers.ts";
import { initializeCollabReport } from "./coordination-report.ts";

export function initializeCollabCoordination(ctx: RuntimeContext): any {
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
  const buildTaskExecutionPrompt = __ctx.buildTaskExecutionPrompt;
  const buildAvailableSkillsPromptBlock = __ctx.buildAvailableSkillsPromptBlock || ((provider: string) => `[Available Skills][provider=${provider || "unknown"}][unavailable]`);
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
  const httpAgentCounter = __ctx.httpAgentCounter;
  const insertMessageWithIdempotency = __ctx.insertMessageWithIdempotency;
  const interruptPidTree = __ctx.interruptPidTree;
  const isTaskWorkflowInterrupted = __ctx.isTaskWorkflowInterrupted;
  const killPidTree = __ctx.killPidTree;
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
  const sendAgentMessage = __ctx.sendAgentMessage;
  const findBestSubordinate = __ctx.findBestSubordinate;
  const findTeamLeader = __ctx.findTeamLeader;
  const getDeptName = __ctx.getDeptName;
  const getDeptRoleConstraint = __ctx.getDeptRoleConstraint;
  const maybeNotifyAllSubtasksComplete = __ctx.maybeNotifyAllSubtasksComplete;
  const resolveLang = __ctx.resolveLang;
  const l = __ctx.l;
  const pickL = __ctx.pickL;
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
  // Initialize sub-modules
  // ---------------------------------------------------------------------------

  const helpers = initializeCollabHelpers({ db, nowMs, broadcast, delegatedTaskToSubtask });
  const {
    normalizeTextField,
    deriveSubtaskStateFromDelegatedTask,
    pickUnlinkedTargetSubtask,
    syncSubtaskWithDelegatedTask,
    linkCrossDeptTaskToParentSubtask,
    reconcileCrossDeptSubtasks,
  } = helpers;

  const paths = initializeCollabPaths({ db, normalizeTextField });
  const {
    detectProjectPath,
    resolveProjectPath,
    getLatestKnownProjectPath,
    getDefaultProjectRoot,
    resolveDirectiveProjectPath,
  } = paths;

  const directives = initializeCollabDirectives({
    db, nowMs, broadcast, randomUUID, path, logsDir,
    delegatedTaskToSubtask, crossDeptNextCallbacks,
    findTeamLeader, findBestSubordinate, getDeptName, getDeptRoleConstraint,
    resolveLang, l, pickL, getAgentDisplayName, notifyCeo, sendAgentMessage,
    appendTaskLog, recordTaskCreationAudit, startTaskExecutionForAgent,
    startProgressTimer, ensureTaskExecutionSession, spawnCliAgent,
    getProviderModelConfig, getRecentConversationContext, buildTaskExecutionPrompt,
    buildAvailableSkillsPromptBlock, hasExplicitWarningFixRequest,
    handleTaskRunComplete,
    handleSubtaskDelegationComplete: (taskId: string, subtaskId: string, code: number) => {
      // forward to subtask delegation handler available in outer scope via ctx
      const fn = __ctx.handleSubtaskDelegationComplete;
      if (fn) fn(taskId, subtaskId, code);
    },
    linkCrossDeptTaskToParentSubtask,
    detectProjectPath,
    resolveProjectPath,
  });
  const { startCrossDeptCooperation } = directives;

  const recovery = initializeCollabRecovery({
    db, nowMs, broadcast, appendTaskLog,
    findTeamLeader, findBestSubordinate, getDeptName, getAgentDisplayName,
    resolveLang, startTaskExecutionForAgent, startCrossDeptCooperation,
  });
  const { recoverCrossDeptQueueAfterMissingCallback } = recovery;

  const reportHelpers = initializeCollabReportHelpers({ db });
  const {
    stripReportRequestPrefix,
    detectReportOutputFormat,
    resolveReportAssignee,
    pickPlanningReportAssignee,
    formatRecommendationList,
  } = reportHelpers;

  const report = initializeCollabReport({
    db, nowMs, randomUUID, broadcast, resolveLang, l, pickL,
    getAgentDisplayName, notifyCeo, sendAgentMessage, appendTaskLog,
    recordTaskCreationAudit, startTaskExecutionForAgent,
    isTaskWorkflowInterrupted, randomDelay, normalizeTextField,
    detectProjectPath, resolveReportAssignee, stripReportRequestPrefix,
    detectReportOutputFormat, formatRecommendationList, pickPlanningReportAssignee,
  });
  const { handleReportRequest } = report;

  return {
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
  };
}
