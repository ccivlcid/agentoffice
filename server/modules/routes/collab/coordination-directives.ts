// @ts-nocheck

export function initializeCollabDirectives(deps: {
  db: any;
  nowMs: any;
  broadcast: any;
  randomUUID: any;
  path: any;
  logsDir: any;
  delegatedTaskToSubtask: any;
  crossDeptNextCallbacks: any;
  findTeamLeader: any;
  findBestSubordinate: any;
  getDeptName: any;
  getDeptRoleConstraint: any;
  resolveLang: any;
  l: any;
  pickL: any;
  getAgentDisplayName: any;
  notifyCeo: any;
  sendAgentMessage: any;
  appendTaskLog: any;
  recordTaskCreationAudit: any;
  startTaskExecutionForAgent: any;
  startProgressTimer: any;
  ensureTaskExecutionSession: any;
  spawnCliAgent: any;
  getProviderModelConfig: any;
  getRecentConversationContext: any;
  buildTaskExecutionPrompt: any;
  buildAvailableSkillsPromptBlock: any;
  hasExplicitWarningFixRequest: any;
  handleTaskRunComplete: any;
  handleSubtaskDelegationComplete: any;
  linkCrossDeptTaskToParentSubtask: any;
  detectProjectPath: any;
  resolveProjectPath: any;
}) {
  const {
    db, nowMs, broadcast, randomUUID, path, logsDir, delegatedTaskToSubtask, crossDeptNextCallbacks,
    findTeamLeader, findBestSubordinate, getDeptName, getDeptRoleConstraint, resolveLang, l, pickL,
    getAgentDisplayName, notifyCeo, sendAgentMessage, appendTaskLog, recordTaskCreationAudit,
    startTaskExecutionForAgent, startProgressTimer, ensureTaskExecutionSession, spawnCliAgent,
    getProviderModelConfig, getRecentConversationContext, buildTaskExecutionPrompt,
    buildAvailableSkillsPromptBlock, hasExplicitWarningFixRequest, handleTaskRunComplete,
    handleSubtaskDelegationComplete, linkCrossDeptTaskToParentSubtask, detectProjectPath,
    resolveProjectPath,
  } = deps;

  function startCrossDeptCooperation(
    deptIds: string[],
    index: number,
    ctx: any,
    onAllDone?: () => void,
  ): void {
    if (index >= deptIds.length) {
      onAllDone?.();
      return;
    }

    const crossDeptId = deptIds[index];
    const crossLeader = findTeamLeader(crossDeptId);
    if (!crossLeader) {
      // Skip this dept, try next
      startCrossDeptCooperation(deptIds, index + 1, ctx, onAllDone);
      return;
    }

    const { teamLeader, taskTitle, ceoMessage, leaderDeptId, leaderDeptName, leaderName, lang, taskId } = ctx;
    const crossDeptName = getDeptName(crossDeptId);
    const crossLeaderName = lang === "ko" ? (crossLeader.name_ko || crossLeader.name) : crossLeader.name;

    // Notify remaining queue
    if (deptIds.length > 1) {
      const remaining = deptIds.length - index;
      notifyCeo(pickL(l(
        [`협업 요청 진행 중: ${crossDeptName} (${index + 1}/${deptIds.length}, 남은 ${remaining}팀 순차 진행)`],
        [`Collaboration request in progress: ${crossDeptName} (${index + 1}/${deptIds.length}, ${remaining} team(s) remaining in queue)`],
        [`協業依頼進行中: ${crossDeptName} (${index + 1}/${deptIds.length}、残り${remaining}チーム)`],
        [`协作请求进行中：${crossDeptName}（${index + 1}/${deptIds.length}，队列剩余${remaining}个团队）`],
      ), lang), taskId);
    }

    const coopReq = pickL(l(
      [`${crossLeaderName}님, 안녕하세요! 대표님 지시로 "${taskTitle}" 업무 진행 중인데, ${crossDeptName} 협조가 필요합니다. 도움 부탁드려요! 🤝`, `${crossLeaderName}님! "${taskTitle}" 건으로 ${crossDeptName} 지원이 필요합니다. 시간 되시면 협의 부탁드립니다.`],
      [`Hi ${crossLeaderName}! We're working on "${taskTitle}" per CEO's directive and need ${crossDeptName}'s support. Could you help? 🤝`, `${crossLeaderName}, we need ${crossDeptName}'s input on "${taskTitle}". Let's sync when you have a moment.`],
      [`${crossLeaderName}さん、CEO指示の"${taskTitle}"で${crossDeptName}の協力が必要です。お願いします！🤝`],
      [`${crossLeaderName}，CEO安排的"${taskTitle}"需要${crossDeptName}配合，麻烦协调一下！🤝`],
    ), lang);
    sendAgentMessage(teamLeader, coopReq, "chat", "agent", crossLeader.id, taskId);

    // Broadcast delivery animation event for UI
    broadcast("cross_dept_delivery", {
      from_agent_id: teamLeader.id,
      to_agent_id: crossLeader.id,
      task_title: taskTitle,
    });

    // Cross-department leader acknowledges AND creates a real task
    const crossAckDelay = 1500 + Math.random() * 1000;
    setTimeout(() => {
      const crossSub = findBestSubordinate(crossDeptId, crossLeader.id);
      const crossSubName = crossSub
        ? (lang === "ko" ? (crossSub.name_ko || crossSub.name) : crossSub.name)
        : null;

      const crossAckMsg = crossSub
        ? pickL(l(
          [`네, ${leaderName}님! 확인했습니다. ${crossSubName}에게 바로 배정하겠습니다 👍`, `알겠습니다! ${crossSubName}가 지원하도록 하겠습니다. 진행 상황 공유드릴게요.`],
          [`Sure, ${leaderName}! I'll assign ${crossSubName} to support right away 👍`, `Got it! ${crossSubName} will handle the ${crossDeptName} side. I'll keep you posted.`],
          [`了解しました、${leaderName}さん！${crossSubName}を割り当てます 👍`],
          [`好的，${leaderName}！安排${crossSubName}支援 👍`],
        ), lang)
        : pickL(l(
          [`네, ${leaderName}님! 확인했습니다. 제가 직접 처리하겠습니다 👍`],
          [`Sure, ${leaderName}! I'll handle it personally 👍`],
          [`了解しました！私が直接対応します 👍`],
          [`好的！我亲自来处理 👍`],
        ), lang);
      sendAgentMessage(crossLeader, crossAckMsg, "chat", "agent", null, taskId);

      // Create actual task in the cross-department
      const crossTaskId = randomUUID();
      const ct = nowMs();
      const crossTaskTitle = pickL(l(
        [`[협업] ${taskTitle}`],
        [`[Collaboration] ${taskTitle}`],
        [`[協業] ${taskTitle}`],
        [`[协作] ${taskTitle}`],
      ), lang);
      const parentTaskPath = db.prepare("SELECT project_id, project_path FROM tasks WHERE id = ?").get(taskId) as {
        project_id: string | null;
        project_path: string | null;
      } | undefined;
      const crossDetectedPath = parentTaskPath?.project_path ?? detectProjectPath(ceoMessage);
      db.prepare(`
        INSERT INTO tasks (id, title, description, department_id, project_id, status, priority, task_type, project_path, source_task_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'planned', 1, 'general', ?, ?, ?, ?)
      `).run(
        crossTaskId,
        crossTaskTitle,
        `[Cross-dept from ${leaderDeptName}] ${ceoMessage}`,
        crossDeptId,
        parentTaskPath?.project_id ?? null,
        crossDetectedPath,
        taskId,
        ct,
        ct,
      );
      recordTaskCreationAudit({
        taskId: crossTaskId,
        taskTitle: crossTaskTitle,
        taskStatus: "planned",
        departmentId: crossDeptId,
        sourceTaskId: taskId,
        taskType: "general",
        projectPath: crossDetectedPath ?? null,
        trigger: "workflow.cross_dept_cooperation",
        triggerDetail: `from_dept=${leaderDeptId}; to_dept=${crossDeptId}`,
        actorType: "agent",
        actorId: crossLeader.id,
        actorName: crossLeader.name,
        body: {
          parent_task_id: taskId,
          ceo_message: ceoMessage,
          from_department_id: leaderDeptId,
          to_department_id: crossDeptId,
        },
      });
      if (parentTaskPath?.project_id) {
        db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(ct, ct, parentTaskPath.project_id);
      }
      appendTaskLog(crossTaskId, "system", `Cross-dept request from ${leaderName} (${leaderDeptName})`);
      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(crossTaskId));
      const linkedSubtaskId = linkCrossDeptTaskToParentSubtask(taskId, crossDeptId, crossTaskId);
      if (linkedSubtaskId) {
        delegatedTaskToSubtask.set(crossTaskId, linkedSubtaskId);
      }

      // Delegate to cross-dept subordinate and spawn CLI
      const execAgent = crossSub || crossLeader;
      const execName = lang === "ko" ? (execAgent.name_ko || execAgent.name) : execAgent.name;
      const ct2 = nowMs();
      db.prepare(
        "UPDATE tasks SET assigned_agent_id = ?, status = 'in_progress', started_at = ?, updated_at = ? WHERE id = ?"
      ).run(execAgent.id, ct2, ct2, crossTaskId);
      db.prepare("UPDATE agents SET status = 'working', current_task_id = ? WHERE id = ?").run(crossTaskId, execAgent.id);
      appendTaskLog(crossTaskId, "system", `${crossLeaderName} → ${execName}`);

      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(crossTaskId));
      broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(execAgent.id));

      // Register callback to start next department when this one finishes
      if (index + 1 < deptIds.length) {
        crossDeptNextCallbacks.set(crossTaskId, () => {
          const nextDelay = 2000 + Math.random() * 1000;
          setTimeout(() => {
            startCrossDeptCooperation(deptIds, index + 1, ctx, onAllDone);
          }, nextDelay);
        });
      } else if (onAllDone) {
        // Last department in the queue: continue only after this cross task completes review.
        crossDeptNextCallbacks.set(crossTaskId, () => {
          const nextDelay = 1200 + Math.random() * 800;
          setTimeout(() => onAllDone(), nextDelay);
        });
      }

      // Actually spawn the CLI agent
      const execProvider = execAgent.cli_provider || "claude";
      if (["claude", "codex", "gemini", "opencode"].includes(execProvider)) {
        const crossTaskData = db.prepare("SELECT * FROM tasks WHERE id = ?").get(crossTaskId) as {
          title: string; description: string | null; project_path: string | null;
        } | undefined;
        if (crossTaskData) {
          const projPath = resolveProjectPath(crossTaskData);
          const logFilePath = path.join(logsDir, `${crossTaskId}.log`);
          const roleLabel = { team_leader: "Team Leader", senior: "Senior", junior: "Junior", intern: "Intern" }[execAgent.role] || execAgent.role;
          const deptConstraint = getDeptRoleConstraint(crossDeptId, crossDeptName);
          const crossConversationCtx = getRecentConversationContext(execAgent.id);
          const taskLang = resolveLang(crossTaskData.description ?? crossTaskData.title);
          const availableSkillsPromptBlock = buildAvailableSkillsPromptBlock(execProvider);
          const spawnPrompt = buildTaskExecutionPrompt([
            availableSkillsPromptBlock,
            `[Task] ${crossTaskData.title}`,
            crossTaskData.description ? `\n${crossTaskData.description}` : "",
            crossConversationCtx,
            `\n---`,
            `Agent: ${execAgent.name} (${roleLabel}, ${crossDeptName})`,
            execAgent.personality ? `Personality: ${execAgent.personality}. Act in character: your work and replies should reflect this.` : "",
            deptConstraint,
            pickL(l(
              ["위 작업을 충분히 완수하세요. 필요 시 위 대화 맥락을 참고하세요."],
              ["Please complete the task above thoroughly. Use the conversation context above if relevant."],
      
            ), taskLang),
          ], {
            allowWarningFix: hasExplicitWarningFixRequest(crossTaskData.title, crossTaskData.description),
          });
          const executionSession = ensureTaskExecutionSession(crossTaskId, execAgent.id, execProvider);
          const sessionPrompt = [
            `[Task Session] id=${executionSession.sessionId} owner=${executionSession.agentId} provider=${executionSession.provider}`,
            "Task-scoped session: keep continuity only for this collaboration task.",
            spawnPrompt,
          ].join("\n");

          appendTaskLog(crossTaskId, "system", `RUN start (agent=${execAgent.name}, provider=${execProvider})`);
          const crossModelConfig = getProviderModelConfig();
          const crossModel = crossModelConfig[execProvider]?.model || undefined;
          const crossReasoningLevel = crossModelConfig[execProvider]?.reasoningLevel || undefined;
          const child = spawnCliAgent(crossTaskId, execProvider, sessionPrompt, projPath, logFilePath, crossModel, crossReasoningLevel);
          child.on("close", (code) => {
            const linked = delegatedTaskToSubtask.get(crossTaskId);
            if (linked) {
              handleSubtaskDelegationComplete(crossTaskId, linked, code ?? 1);
            } else {
              handleTaskRunComplete(crossTaskId, code ?? 1);
            }
          });

          notifyCeo(pickL(l(
            [`${crossDeptName} ${execName}가 '${taskTitle}' 협업 작업을 시작했습니다.`],
            [`${crossDeptName} ${execName} started collaboration work for '${taskTitle}'.`],
 
          ), lang), crossTaskId);
          startProgressTimer(crossTaskId, crossTaskData.title, crossDeptId);
        }
      }
    }, crossAckDelay);
  }

  return {
    startCrossDeptCooperation,
  };
}
