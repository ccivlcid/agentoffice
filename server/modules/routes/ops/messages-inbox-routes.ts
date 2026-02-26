// @ts-nocheck

import { handleProjectReviewReply, handleReviewRoundReply, handleTimeoutResumeReply } from "./messages-inbox-reply-handlers.ts";

export function registerInboxRoutes(ctx: {
  app: any;
  db: any;
  nowMs: () => number;
  broadcast: (event: string, data: any) => void;
  appendTaskLog: (taskId: string, kind: string, msg: string) => void;
  activeProcesses: Set<string>;
  startTaskExecutionForAgent: (taskId: string, agent: any, deptId: any, deptName: string) => void;
  getDeptName: (deptId: string) => string;
  finishReview: (taskId: string, title: string, opts: any) => void;
  seedReviewRevisionSubtasks: (taskId: string, deptId: any, notes: string[]) => number;
  processSubtaskDelegations: (taskId: string) => void;
  scheduleNextReviewRound: (taskId: string, title: string, round: number, lang: string) => void;
  normalizeTextField: (val: any) => string | null;
  resolveLang: (text: string) => string;
  l: (...args: any[]) => any;
  pickL: (val: any, lang: string) => string;
  inboxHelpers: {
    getDecisionInboxItems: () => any[];
    getProjectReviewTaskChoices: (projectId: string) => any[];
    getReviewDecisionNotes: (taskId: string, round: number, limit?: number) => string[];
    getReviewDecisionFallbackLabel: (lang: string) => string;
  };
  stateHelpers: {
    getProjectReviewDecisionState: (id: string) => any;
    recordProjectReviewDecisionEvent: (input: any) => void;
  };
  PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX: string;
  REVIEW_DECISION_RESOLVED_LOG_PREFIX: string;
}) {
  const {
    app, db, nowMs, broadcast, appendTaskLog, activeProcesses,
    startTaskExecutionForAgent, getDeptName, finishReview,
    seedReviewRevisionSubtasks, processSubtaskDelegations, scheduleNextReviewRound,
    normalizeTextField, resolveLang, l, pickL,
    inboxHelpers, stateHelpers,
    PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX,
    REVIEW_DECISION_RESOLVED_LOG_PREFIX,
  } = ctx;
  const { getDecisionInboxItems, getProjectReviewTaskChoices, getReviewDecisionNotes, getReviewDecisionFallbackLabel } = inboxHelpers;
  const { getProjectReviewDecisionState, recordProjectReviewDecisionEvent } = stateHelpers;

  type AgentRow = any;

  function openSupplementRound(
    taskId: string,
    assignedAgentId: string | null,
    fallbackDepartmentId: string | null,
    logPrefix = "Decision inbox",
  ): { started: boolean; reason: string } {
    const branchTs = nowMs();
    db.prepare("UPDATE tasks SET status = 'pending', updated_at = ? WHERE id = ?").run(branchTs, taskId);
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
    appendTaskLog(taskId, "system", `${logPrefix}: supplement round opened (review -> pending)`);
    if (!assignedAgentId) {
      appendTaskLog(taskId, "system", `${logPrefix}: supplement round pending (no assigned agent)`);
      return { started: false, reason: "no_assignee" };
    }
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(assignedAgentId) as AgentRow | undefined;
    if (!agent) {
      appendTaskLog(taskId, "system", `${logPrefix}: supplement round pending (assigned agent not found)`);
      return { started: false, reason: "agent_not_found" };
    }
    if (agent.status === "offline") {
      appendTaskLog(taskId, "system", `${logPrefix}: supplement round pending (assigned agent offline)`);
      return { started: false, reason: "agent_offline" };
    }
    if (activeProcesses.has(taskId)) return { started: false, reason: "already_running" };
    if (agent.status === "working" && agent.current_task_id && agent.current_task_id !== taskId && activeProcesses.has(agent.current_task_id)) {
      appendTaskLog(taskId, "system", `${logPrefix}: supplement round pending (agent busy on ${agent.current_task_id})`);
      return { started: false, reason: "agent_busy" };
    }
    const deptId = agent.department_id ?? fallbackDepartmentId ?? null;
    const deptName = deptId ? getDeptName(deptId) : "Unassigned";
    appendTaskLog(taskId, "system", `${logPrefix}: supplement round execution started`);
    startTaskExecutionForAgent(taskId, agent, deptId, deptName);
    return { started: true, reason: "started" };
  }

  const handlerCtx = {
    db, nowMs, broadcast, appendTaskLog, activeProcesses,
    startTaskExecutionForAgent, getDeptName, finishReview,
    seedReviewRevisionSubtasks, processSubtaskDelegations, scheduleNextReviewRound,
    normalizeTextField, resolveLang, l, pickL,
    openSupplementRound,
    getProjectReviewTaskChoices,
    getReviewDecisionNotes,
    getReviewDecisionFallbackLabel,
    getProjectReviewDecisionState,
    recordProjectReviewDecisionEvent,
    PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX,
    REVIEW_DECISION_RESOLVED_LOG_PREFIX,
  };

  app.get("/api/decision-inbox", (_req, res) => {
    res.json({ items: getDecisionInboxItems() });
  });

  app.post("/api/decision-inbox/:id/reply", (req, res) => {
    const decisionId = String(req.params.id || "");
    const optionNumber = Number(req.body?.option_number ?? req.body?.optionNumber ?? req.body?.option);
    if (!Number.isFinite(optionNumber)) return res.status(400).json({ error: "option_number_required" });

    const currentItem = getDecisionInboxItems().find((item) => item.id === decisionId);
    if (!currentItem) return res.status(404).json({ error: "decision_not_found" });
    const selectedOption = currentItem.options.find((option) => option.number === optionNumber);
    if (!selectedOption) {
      if (currentItem.options.length <= 0) {
        return res.status(409).json({ error: "decision_options_not_ready", kind: currentItem.kind });
      }
      return res.status(400).json({ error: "option_not_found", option_number: optionNumber });
    }

    if (currentItem.kind === "project_review_ready") {
      handleProjectReviewReply(req, res, currentItem, selectedOption, optionNumber, handlerCtx);
      return;
    }

    if (currentItem.kind === "review_round_pick") {
      handleReviewRoundReply(req, res, currentItem, selectedOption, optionNumber, handlerCtx);
      return;
    }

    if (currentItem.kind === "task_timeout_resume") {
      handleTimeoutResumeReply(res, currentItem, selectedOption, handlerCtx);
      return;
    }

    return res.status(400).json({ error: "unknown_decision_id" });
  });
}
