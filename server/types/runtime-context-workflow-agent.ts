/**
 * WorkflowAgentExports — from initializeWorkflowPartB (workflow/agents.ts).
 */

export interface WorkflowAgentExports {
  httpAgentCounter: number;
  getNextHttpAgentPid: () => number;
  cachedModels: { data: Record<string, string[]>; loadedAt: number } | null;
  MODELS_CACHE_TTL: number;
  cachedCliStatus: { data: any; loadedAt: number } | null;
  CLI_STATUS_TTL: number;
  CLI_TOOLS: any[];

  analyzeSubtaskDepartment: (...args: any[]) => any;
  seedApprovedPlanSubtasks: (...args: any[]) => any;
  seedReviewRevisionSubtasks: (...args: any[]) => any;
  codexThreadToSubtask: (...args: any[]) => any;
  spawnCliAgent: (...args: any[]) => any;
  normalizeOAuthProvider: (...args: any[]) => any;
  getNextOAuthLabel: (...args: any[]) => any;
  getOAuthAccounts: (...args: any[]) => any;
  getPreferredOAuthAccounts: (...args: any[]) => any;
  getDecryptedOAuthToken: (...args: any[]) => any;
  getProviderModelConfig: (...args: any[]) => any;
  refreshGoogleToken: (...args: any[]) => any;
  executeCopilotAgent: (...args: any[]) => any;
  executeAntigravityAgent: (...args: any[]) => any;
  launchHttpAgent: (...args: any[]) => any;
  killPidTree: (...args: any[]) => any;
  isPidAlive: (...args: any[]) => any;
  interruptPidTree: (...args: any[]) => any;
  appendTaskLog: (...args: any[]) => any;
  fetchClaudeUsage: (...args: any[]) => any;
  fetchCodexUsage: (...args: any[]) => any;
  fetchGeminiUsage: (...args: any[]) => any;
  execWithTimeout: (...args: any[]) => any;
  detectAllCli: (...args: any[]) => any;
}
