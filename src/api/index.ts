/**
 * API client — re-exports from domain modules.
 * Import as: import * as api from '../api' or import { x } from '../api'
 */

export {
  ApiRequestError,
  isApiRequestError,
  setApiAuthToken,
  bootstrapSession,
  makeIdempotencyKey,
  extractMessageId,
} from './client';

export { getDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment, reorderDepartments } from './departments';
export { getAgents, getAgent, getMeetingPresence, updateAgent, createAgent, deleteAgent } from './agents';

export {
  getTasks,
  getTask,
  createTask,
  updateTask,
  bulkHideTasks,
  deleteTask,
  assignTask,
  runTask,
  stopTask,
  pauseTask,
  resumeTask,
  getTerminal,
  getTaskMeetingMinutes,
  getTaskDiff,
  mergeTask,
  discardTask,
  getWorktrees,
  getTaskGitInfo,
  getActiveSubtasks,
  createSubtask,
  updateSubtask,
  type TaskGitInfo,
  type TerminalProgressHint,
  type TerminalProgressHintsPayload,
  type TaskDiffResult,
  type MergeResult,
  type WorktreeEntry,
  getTaskTimeline,
  cloneTask,
  type TaskTimelineEvent,
} from './tasks';

export {
  getProjects,
  createProject,
  updateProject,
  checkProjectPath,
  getProjectPathSuggestions,
  browseProjectPath,
  pickProjectPathNative,
  deleteProject,
  getProjectDetail,
  getProjectBranches,
  type ProjectTaskHistoryItem,
  type ProjectReportHistoryItem,
  type ProjectDecisionEventItem,
  type ProjectDetailResponse,
  type ProjectPathCheckResult,
  type ProjectPathBrowseEntry,
  type ProjectPathBrowseResult,
} from './projects';

export {
  getMessages,
  getDecisionInbox,
  replyDecisionInbox,
  sendMessage,
  sendAnnouncement,
  sendAnnouncementToTeamLeaders,
  sendDirective,
  sendDirectiveWithProject,
  clearMessages,
  type DecisionInboxRouteOption,
  type DecisionInboxRouteItem,
  type DecisionInboxReplyResult,
} from './messages';

export {
  getCliStatus,
  getStats,
  getSettings,
  getSettingsRaw,
  saveSettings,
  saveSettingsPatch,
  saveRoomThemes,
  getUpdateStatus,
  setAutoUpdateEnabled,
  type UpdateStatus,
} from './settings';

export {
  getOAuthStatus,
  getOAuthStartUrl,
  disconnectOAuth,
  refreshOAuthToken,
  activateOAuthAccount,
  updateOAuthAccount,
  deleteOAuthAccount,
  startGitHubDeviceFlow,
  pollGitHubDevice,
  getOAuthModels,
  getCliModels,
  type OAuthAccountInfo,
  type OAuthProviderStatus,
  type OAuthConnectProvider,
  type OAuthStatus,
  type OAuthRefreshResult,
  type DeviceCodeStart,
  type DevicePollResult,
} from './oauth';

export {
  getSkills,
  getSkillDetail,
  startSkillLearning,
  getSkillLearningJob,
  getSkillLearningHistory,
  getAvailableLearnedSkills,
  unlearnSkill,
  type SkillEntry,
  type SkillDetail,
  type SkillLearnProvider,
  type SkillLearnStatus,
  type SkillHistoryProvider,
  type SkillLearnJob,
  type SkillLearningHistoryEntry,
  type LearnedSkillEntry,
} from './skills';

export {
  getCustomSkills,
  createCustomSkill,
  updateCustomSkill,
  deleteCustomSkill,
  uploadCustomSkill,
  type CustomSkill,
} from './custom-skills';

export {
  getMcpServers,
  createMcpServer,
  updateMcpServer,
  deleteMcpServer,
  toggleMcpServer,
  syncMcpServers,
  getMcpPresets,
  getMcpRegistry,
  type McpServer,
  type McpPreset,
  type McpRegistryEntry,
} from './mcp-servers';

export {
  getRules,
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
  syncRules,
  getRulePresets,
  type ProjectRule,
  type RulePreset,
} from './rules';

export {
  getGatewayTargets,
  sendGatewayMessage,
  type GatewayTarget,
} from './gateway';

export {
  getApiProviders,
  createApiProvider,
  updateApiProvider,
  deleteApiProvider,
  testApiProvider,
  getApiProviderModels,
  getApiProviderPresets,
  type ApiProviderType,
  type ApiProvider,
  type ApiProviderPreset,
} from './api-providers';

export {
  getTaskReports,
  getTaskReportDetail,
  archiveTaskReport,
  getCliUsage,
  refreshCliUsage,
  type TaskReportSummary,
  type TaskReportDocument,
  type TaskReportTeamSection,
  type TaskReportDetail,
  type CliUsageWindow,
  type CliUsageEntry,
} from './task-reports';

export {
  getActiveAgents,
  getCliProcesses,
  killCliProcess,
  type ActiveAgentInfo,
  type CliProcessInfo,
} from './active-agents';

export {
  getTestRuns,
  startTestRun,
  detectTestScripts,
  getPreviewSessions,
  startPreview,
  stopPreview,
  getChecklist,
  addChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  generateChecklist,
  type TestRun,
  type DetectedScript,
  type PreviewSession,
  type ChecklistItem,
} from './testing';

export {
  getGitHubStatus,
  getGitHubRepos,
  getGitHubBranches,
  cloneGitHubRepo,
  getCloneStatus,
  type GitHubRepo,
  type GitHubBranch,
  type GitHubStatus,
  type CloneStatus,
} from './github';
