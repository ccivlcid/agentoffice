/**
 * RouteCollabExports — from registerRoutesPartB (routes/collab.ts).
 */

export interface RouteCollabExports {
  DEPT_KEYWORDS: Record<string, string[]>;
  sendAgentMessage: (...args: any[]) => any;
  getPreferredLanguage: (...args: any[]) => any;
  resolveLang: (...args: any[]) => any;
  detectLang: (...args: any[]) => any;
  l: (...args: any[]) => any;
  pickL: (...args: any[]) => any;
  getRoleLabel: (...args: any[]) => any;
  scheduleAnnouncementReplies: (...args: any[]) => any;
  normalizeTextField: (...args: any[]) => any;
  analyzeDirectivePolicy: (...args: any[]) => any;
  shouldExecuteDirectiveDelegation: (...args: any[]) => any;
  detectTargetDepartments: (...args: any[]) => any;
  detectMentions: (...args: any[]) => any;
  handleMentionDelegation: (...args: any[]) => any;
  findTeamLeader: (...args: any[]) => any;
  getDeptName: (...args: any[]) => any;
  getDeptRoleConstraint: (...args: any[]) => any;
  formatTaskSubtaskProgressSummary: (...args: any[]) => any;
  processSubtaskDelegations: (...args: any[]) => any;
  reconcileCrossDeptSubtasks: (...args: any[]) => any;
  recoverCrossDeptQueueAfterMissingCallback: (...args: any[]) => any;
  resolveProjectPath: (...args: any[]) => any;
  handleReportRequest: (...args: any[]) => any;
  handleTaskDelegation: (...args: any[]) => any;
  scheduleAgentReply: (...args: any[]) => any;
}
