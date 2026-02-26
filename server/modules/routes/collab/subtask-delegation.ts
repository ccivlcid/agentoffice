// @ts-nocheck

import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Lang } from "../../../types/lang.ts";
import type { AgentRow } from "./agent-types.ts";
import { l, pickL } from "./agent-types.ts";
import type { SubtaskRow } from "./delegation-helpers.ts";
import { makeSubtaskDelegationPromptBuilder } from "./subtask-prompt.ts";

export function initializeSubtaskDelegation(deps: {
  db: any; nowMs: () => number; broadcast: any; logsDir: string;
  resolveLang: (text?: string, fallback?: Lang) => Lang;
  getPreferredLanguage: () => Lang; getAgentDisplayName: any;
  getDeptName: (deptId: string) => string;
  getDeptRoleConstraint: (deptId: string, deptName: string) => string;
  getRecentConversationContext: any; buildTaskExecutionPrompt: any; hasExplicitWarningFixRequest: any;
  findTeamLeader: (deptId: string | null) => AgentRow | null;
  findBestSubordinate: (deptId: string, excludeId: string) => AgentRow | null;
  notifyCeo: any; appendTaskLog: any; recordTaskCreationAudit: any;
  ensureTaskExecutionSession: any; ensureClaudeMd: any; createWorktree: any;
  spawnCliAgent: any; launchApiProviderAgent: any; launchHttpAgent: any;
  getNextHttpAgentPid: any; getProviderModelConfig: any; startProgressTimer: any; sendAgentMessage: any;
  maybeNotifyAllSubtasksComplete: (parentTaskId: string, noticeSent: Set<string>) => void;
  groupSubtasksByTargetDepartment: (subtasks: SubtaskRow[]) => SubtaskRow[][];
  orderSubtaskQueuesByDepartment: (queues: SubtaskRow[][]) => SubtaskRow[][];
  subtaskDelegationDispatchInFlight: Set<string>; subtaskDelegationCompletionNoticeSent: Set<string>;
  subtaskDelegationCallbacks: Map<string, () => void>; delegatedTaskToSubtask: Map<string, string>;
  resolveProjectPath: any;
}) {
  const {
    db, nowMs, broadcast, logsDir, resolveLang, getPreferredLanguage, getAgentDisplayName,
    getDeptName, getDeptRoleConstraint, getRecentConversationContext, buildTaskExecutionPrompt,
    hasExplicitWarningFixRequest, findTeamLeader, findBestSubordinate, notifyCeo, appendTaskLog,
    recordTaskCreationAudit, ensureTaskExecutionSession, ensureClaudeMd, createWorktree,
    spawnCliAgent, launchApiProviderAgent, launchHttpAgent, getNextHttpAgentPid,
    getProviderModelConfig, startProgressTimer, sendAgentMessage, maybeNotifyAllSubtasksComplete,
    groupSubtasksByTargetDepartment, orderSubtaskQueuesByDepartment,
    subtaskDelegationDispatchInFlight, subtaskDelegationCompletionNoticeSent,
    subtaskDelegationCallbacks, delegatedTaskToSubtask, resolveProjectPath,
  } = deps;

  const buildSubtaskDelegationPrompt = makeSubtaskDelegationPromptBuilder({
    db, resolveLang, getDeptName, getDeptRoleConstraint, getRecentConversationContext,
    getAgentDisplayName, buildTaskExecutionPrompt, hasExplicitWarningFixRequest,
  });

  function processSubtaskDelegations(taskId: string, handleSubtaskDelegationBatchComplete: any): void {
    if (subtaskDelegationDispatchInFlight.has(taskId)) return;
    const foreignSubtasks = db.prepare(
      "SELECT * FROM subtasks WHERE task_id = ? AND target_department_id IS NOT NULL AND (delegated_task_id IS NULL OR delegated_task_id = '') ORDER BY created_at"
    ).all(taskId) as unknown as SubtaskRow[];
    if (foreignSubtasks.length === 0) return;
    const parentTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as {
      id: string; title: string; description: string | null;
      project_id: string | null; project_path: string | null; department_id: string | null;
    } | undefined;
    if (!parentTask) return;
    const lang = resolveLang(parentTask.description ?? parentTask.title);
    const queues = orderSubtaskQueuesByDepartment(groupSubtasksByTargetDepartment(foreignSubtasks));
    subtaskDelegationDispatchInFlight.add(taskId);
    subtaskDelegationCompletionNoticeSent.delete(parentTask.id);
    notifyCeo(pickL(l(
      [`'${parentTask.title}' 의 외부 부서 서브태스크 ${foreignSubtasks.length}건을 부서별 배치로 순차 위임합니다.`],
      [`Delegating ${foreignSubtasks.length} external-department subtasks for '${parentTask.title}' sequentially by department, one batched request at a time.`],
      [`'${parentTask.title}' の他部門サブタスク${foreignSubtasks.length}件を、部門ごとにバッチ化して順次委任します。`],
      [`将把'${parentTask.title}'的${foreignSubtasks.length}个外部门 SubTask 按部门批量后顺序委派。`],
    ), lang), taskId);
    appendTaskLog(taskId, "system",
      `Subtask delegation mode: sequential_by_department_batched (queues=${queues.length}, items=${foreignSubtasks.length})`,
    );
    const runQueue = (index: number) => {
      if (index >= queues.length) {
        subtaskDelegationDispatchInFlight.delete(taskId);
        maybeNotifyAllSubtasksComplete(parentTask.id, subtaskDelegationCompletionNoticeSent);
        return;
      }
      delegateSubtaskBatch(queues[index], index, queues.length, parentTask, handleSubtaskDelegationBatchComplete, () => {
        setTimeout(() => runQueue(index + 1), 900 + Math.random() * 700);
      });
    };
    runQueue(0);
  }

  function delegateSubtaskBatch(
    subtasks: SubtaskRow[], queueIndex: number, queueTotal: number,
    parentTask: { id: string; title: string; description: string | null; project_id: string | null; project_path: string | null; department_id: string | null },
    handleSubtaskDelegationBatchComplete: any, onBatchDone?: () => void,
  ): void {
    const lang = resolveLang(parentTask.description ?? parentTask.title);
    if (subtasks.length === 0) { onBatchDone?.(); return; }
    const targetDeptId = subtasks[0].target_department_id!;
    const targetDeptName = getDeptName(targetDeptId);
    const subtaskIds = subtasks.map((st) => st.id);
    const firstTitle = subtasks[0].title;
    const batchTitle = subtasks.length > 1 ? `${firstTitle} +${subtasks.length - 1}` : firstTitle;
    const crossLeader = findTeamLeader(targetDeptId);
    if (!crossLeader) {
      const doneAt = nowMs();
      for (const sid of subtaskIds) {
        db.prepare("UPDATE subtasks SET status = 'done', completed_at = ?, blocked_reason = NULL WHERE id = ?").run(doneAt, sid);
        broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sid));
      }
      maybeNotifyAllSubtasksComplete(parentTask.id, subtaskDelegationCompletionNoticeSent);
      onBatchDone?.();
      return;
    }
    const originLeader = findTeamLeader(parentTask.department_id);
    const originLeaderName = originLeader
      ? getAgentDisplayName(originLeader, lang)
      : pickL(l(["팀장"], ["Team Lead"], ["チームリーダー"], ["组长"]), lang);
    const crossLeaderName = getAgentDisplayName(crossLeader, lang);
    if (queueTotal > 1) {
      notifyCeo(pickL(l(
        [`서브태스크 배치 위임 진행: ${targetDeptName} (${queueIndex + 1}/${queueTotal}, ${subtasks.length}건)`],
        [`Batched subtask delegation in progress: ${targetDeptName} (${queueIndex + 1}/${queueTotal}, ${subtasks.length} item(s))`],
        [`サブタスク一括委任進行中: ${targetDeptName} (${queueIndex + 1}/${queueTotal}, ${subtasks.length}件)`],
        [`批量 SubTask 委派进行中：${targetDeptName}（${queueIndex + 1}/${queueTotal}，${subtasks.length}项）`],
      ), lang), parentTask.id);
    }
    if (originLeader) {
      sendAgentMessage(originLeader, pickL(l(
        [`${crossLeaderName}님, '${parentTask.title}' 프로젝트의 서브태스크 ${subtasks.length}건(${batchTitle})을 순차 체크리스트로 일괄 처리 부탁드립니다! 🤝`],
        [`${crossLeaderName}, please process ${subtasks.length} subtasks (${batchTitle}) for '${parentTask.title}' as one sequential checklist in a single run. 🤝`],
        [`${crossLeaderName}さん、'${parentTask.title}' のサブタスク${subtasks.length}件（${batchTitle}）を順次チェックリストで一括対応お願いします！🤝`],
        [`${crossLeaderName}，请将'${parentTask.title}'的 ${subtasks.length} 个 SubTask（${batchTitle}）按顺序清单一次性处理！🤝`],
      ), lang), "chat", "agent", crossLeader.id, parentTask.id);
    }
    broadcast("cross_dept_delivery", { from_agent_id: originLeader?.id || null, to_agent_id: crossLeader.id, task_title: batchTitle });
    setTimeout(() => {
      _runDelegatedBatchExecution({
        subtasks, subtaskIds, batchTitle, targetDeptId, targetDeptName, crossLeader,
        originLeaderName, crossLeaderName, parentTask, lang, onBatchDone,
        handleSubtaskDelegationBatchComplete,
      });
    }, 1500 + Math.random() * 1000);
  }

  function _runDelegatedBatchExecution(args: {
    subtasks: SubtaskRow[]; subtaskIds: string[]; batchTitle: string;
    targetDeptId: string; targetDeptName: string; crossLeader: AgentRow;
    originLeaderName: string; crossLeaderName: string;
    parentTask: any; lang: Lang; onBatchDone?: () => void;
    handleSubtaskDelegationBatchComplete: any;
  }): void {
    const {
      subtasks, subtaskIds, batchTitle, targetDeptId, targetDeptName, crossLeader,
      originLeaderName, crossLeaderName, parentTask, lang, onBatchDone,
      handleSubtaskDelegationBatchComplete,
    } = args;
    const crossSub = findBestSubordinate(targetDeptId, crossLeader.id);
    const execAgent = crossSub || crossLeader;
    const execName = getAgentDisplayName(execAgent, lang);
    sendAgentMessage(crossLeader,
      crossSub
        ? pickL(l(
          [`네, ${originLeaderName}님! ${subtasks.length}건(${batchTitle})을 ${execName}에게 일괄 배정해 순차 처리하겠습니다 👍`],
          [`Got it, ${originLeaderName}! I'll assign ${subtasks.length} items (${batchTitle}) to ${execName} as one ordered batch. 👍`],
          [`了解です、${originLeaderName}さん！${subtasks.length}件（${batchTitle}）を${execName}に一括割り当てて順次対応します 👍`],
          [`收到，${originLeaderName}！将把 ${subtasks.length} 项（${batchTitle}）批量分配给 ${execName} 按顺序处理 👍`],
        ), lang)
        : pickL(l(
          [`네, ${originLeaderName}님! ${subtasks.length}건(${batchTitle})을 제가 직접 순차 처리하겠습니다 👍`],
          [`Understood, ${originLeaderName}! I'll handle ${subtasks.length} items (${batchTitle}) myself in order. 👍`],
          [`承知しました、${originLeaderName}さん！${subtasks.length}件（${batchTitle}）を私が順次対応します 👍`],
          [`明白，${originLeaderName}！这 ${subtasks.length} 项（${batchTitle}）由我按顺序亲自处理 👍`],
        ), lang),
      "chat", "agent", null, parentTask.id,
    );
    const delegatedTaskId = randomUUID();
    const ct = nowMs();
    const delegatedTitle = pickL(l(
      [`[서브태스크 일괄협업 x${subtasks.length}] ${batchTitle}`],
      [`[Batched Subtask Collaboration x${subtasks.length}] ${batchTitle}`],
      [`[サブタスク一括協業 x${subtasks.length}] ${batchTitle}`],
      [`[批量 SubTask 协作 x${subtasks.length}] ${batchTitle}`],
    ), lang);
    const delegatedChecklist = subtasks.map((st, idx) => `${idx + 1}. ${st.title}`).join("\n");
    const delegatedDescription = pickL(l(
      [`[서브태스크 위임 from ${getDeptName(parentTask.department_id ?? "")}] ${parentTask.description || parentTask.title}\n\n[순차 체크리스트]\n${delegatedChecklist}`],
      [`[Subtasks delegated from ${getDeptName(parentTask.department_id ?? "")}] ${parentTask.description || parentTask.title}\n\n[Sequential checklist]\n${delegatedChecklist}`],
      [`[サブタスク委任元 ${getDeptName(parentTask.department_id ?? "")}] ${parentTask.description || parentTask.title}\n\n[順次チェックリスト]\n${delegatedChecklist}`],
      [`[SubTask 委派来源 ${getDeptName(parentTask.department_id ?? "")}] ${parentTask.description || parentTask.title}\n\n[顺序清单]\n${delegatedChecklist}`],
    ), lang);
    db.prepare(`
      INSERT INTO tasks (id, title, description, department_id, project_id, status, priority, task_type, project_path, source_task_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'planned', 1, 'general', ?, ?, ?, ?)
    `).run(delegatedTaskId, delegatedTitle, delegatedDescription, targetDeptId, parentTask.project_id ?? null, parentTask.project_path, parentTask.id, ct, ct);
    recordTaskCreationAudit({
      taskId: delegatedTaskId, taskTitle: delegatedTitle, taskStatus: "planned",
      departmentId: targetDeptId, sourceTaskId: parentTask.id, taskType: "general",
      projectPath: parentTask.project_path ?? null, trigger: "workflow.subtask_batch_delegation",
      triggerDetail: `parent_task=${parentTask.id}; subtasks=${subtasks.length}; target_dept=${targetDeptId}`,
      actorType: "agent", actorId: crossLeader.id, actorName: crossLeader.name,
      body: { parent_task_id: parentTask.id, subtask_ids: subtaskIds, target_department_id: targetDeptId },
    });
    if (parentTask.project_id) db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(ct, ct, parentTask.project_id);
    appendTaskLog(delegatedTaskId, "system", `Subtask delegation from '${parentTask.title}' → ${targetDeptName}`);
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(delegatedTaskId));
    const ct2 = nowMs();
    db.prepare("UPDATE tasks SET assigned_agent_id = ?, status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?")
      .run(execAgent.id, ct2, ct2, delegatedTaskId);
    db.prepare("UPDATE agents SET status = 'working', current_task_id = ? WHERE id = ?").run(delegatedTaskId, execAgent.id);
    appendTaskLog(delegatedTaskId, "system", `${crossLeaderName} → ${execName}`);
    broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(delegatedTaskId));
    broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(execAgent.id));
    for (const sid of subtaskIds) {
      db.prepare("UPDATE subtasks SET delegated_task_id = ?, status = 'in_progress', blocked_reason = NULL WHERE id = ?").run(delegatedTaskId, sid);
      broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sid));
    }
    delegatedTaskToSubtask.set(delegatedTaskId, subtaskIds[0]);
    if (onBatchDone) subtaskDelegationCallbacks.set(delegatedTaskId, onBatchDone);
    const execProvider = execAgent.cli_provider || "claude";
    if (!["claude", "codex", "gemini", "opencode", "copilot", "antigravity", "api"].includes(execProvider)) {
      onBatchDone?.(); return;
    }
    const projPath = resolveProjectPath({ project_id: parentTask.project_id, project_path: parentTask.project_path, description: parentTask.description, title: parentTask.title });
    const worktreePath = createWorktree(projPath, delegatedTaskId, execAgent.name);
    const agentCwd = worktreePath || projPath;
    if (worktreePath) appendTaskLog(delegatedTaskId, "system", `Git worktree created: ${worktreePath} (branch: climpire/${delegatedTaskId.slice(0, 8)})`);
    const logFilePath = path.join(logsDir, `${delegatedTaskId}.log`);
    const spawnPrompt = buildSubtaskDelegationPrompt(parentTask, subtasks, execAgent, targetDeptId, targetDeptName);
    const executionSession = ensureTaskExecutionSession(delegatedTaskId, execAgent.id, execProvider);
    const worktreeNote = worktreePath ? `\nNOTE: You are working in an isolated Git worktree branch (climpire/${delegatedTaskId.slice(0, 8)}). Commit your changes normally.` : "";
    const sessionPrompt = [
      `[Task Session] id=${executionSession.sessionId} owner=${executionSession.agentId} provider=${executionSession.provider}`,
      "Task-scoped session: keep continuity only within this delegated task.",
      spawnPrompt, worktreeNote,
    ].join("\n");
    if (worktreePath && execProvider === "claude") ensureClaudeMd(projPath, worktreePath);
    appendTaskLog(delegatedTaskId, "system", `RUN start (agent=${execAgent.name}, provider=${execProvider})`);
    const wrapCallbackForHttpProvider = () => {
      const originalCallback = subtaskDelegationCallbacks.get(delegatedTaskId);
      subtaskDelegationCallbacks.set(delegatedTaskId, () => {
        const finishedTask = db.prepare("SELECT status FROM tasks WHERE id = ?").get(delegatedTaskId) as { status: string } | undefined;
        if (!finishedTask || finishedTask.status === "cancelled" || finishedTask.status === "pending") {
          delegatedTaskToSubtask.delete(delegatedTaskId);
          appendTaskLog(delegatedTaskId, "system", `Delegated batch callback skipped (status=${finishedTask?.status ?? "missing"})`);
          if (originalCallback) originalCallback();
          return;
        }
        const succeeded = finishedTask?.status === "done" || finishedTask?.status === "review";
        const doneAt = nowMs();
        for (const sid of subtaskIds) {
          if (succeeded) {
            db.prepare("UPDATE subtasks SET status = 'done', completed_at = ?, blocked_reason = NULL WHERE id = ?").run(doneAt, sid);
          } else {
            db.prepare("UPDATE subtasks SET status = 'blocked', blocked_reason = ? WHERE id = ?").run("Delegated task failed", sid);
          }
          broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sid));
        }
        delegatedTaskToSubtask.delete(delegatedTaskId);
        if (succeeded) {
          const touchedParents = new Set<string>();
          for (const sid of subtaskIds) {
            const sub = db.prepare("SELECT task_id FROM subtasks WHERE id = ?").get(sid) as { task_id: string } | undefined;
            if (sub?.task_id) touchedParents.add(sub.task_id);
          }
          for (const pid of touchedParents) maybeNotifyAllSubtasksComplete(pid, subtaskDelegationCompletionNoticeSent);
        }
        if (originalCallback) originalCallback();
      });
    };
    if (execProvider === "api") {
      wrapCallbackForHttpProvider();
      launchApiProviderAgent(delegatedTaskId, execAgent.api_provider_id ?? null, execAgent.api_model ?? null, sessionPrompt, agentCwd, logFilePath, new AbortController(), getNextHttpAgentPid());
    } else if (execProvider === "copilot" || execProvider === "antigravity") {
      wrapCallbackForHttpProvider();
      launchHttpAgent(delegatedTaskId, execProvider, sessionPrompt, agentCwd, logFilePath, new AbortController(), getNextHttpAgentPid(), execAgent.oauth_account_id ?? null);
    } else {
      const delegateModelConfig = getProviderModelConfig();
      const child = spawnCliAgent(delegatedTaskId, execProvider, sessionPrompt, agentCwd, logFilePath, delegateModelConfig[execProvider]?.model, delegateModelConfig[execProvider]?.reasoningLevel);
      child.on("close", (code) => { handleSubtaskDelegationBatchComplete(delegatedTaskId, subtaskIds, code ?? 1); });
    }
    const worktreeCeoNote = worktreePath ? pickL(l(
      [` (격리 브랜치: climpire/${delegatedTaskId.slice(0, 8)})`],
      [` (isolated branch: climpire/${delegatedTaskId.slice(0, 8)})`],
      [` (分離ブランチ: climpire/${delegatedTaskId.slice(0, 8)})`],
      [`（隔离分支: climpire/${delegatedTaskId.slice(0, 8)}）`],
    ), lang) : "";
    notifyCeo(pickL(l(
      [`${targetDeptName} ${execName}가 서브태스크 ${subtasks.length}건 일괄 작업을 시작했습니다.${worktreeCeoNote}`],
      [`${targetDeptName} ${execName} started one batched run for ${subtasks.length} subtasks.${worktreeCeoNote}`],
      [`${targetDeptName}の${execName}がサブタスク${subtasks.length}件の一括作業を開始しました。${worktreeCeoNote}`],
      [`${targetDeptName} 的 ${execName} 已开始 ${subtasks.length} 个 SubTask 的批量处理。${worktreeCeoNote}`],
    ), lang), delegatedTaskId);
    startProgressTimer(delegatedTaskId, delegatedTitle, targetDeptId);
  }

  return { processSubtaskDelegations, delegateSubtaskBatch };
}
