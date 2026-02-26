// @ts-nocheck

export function createFinishReviewHelpers(ctx: {
  db: any;
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  broadcast: (...args: any[]) => void;
  notifyCeo: (content: string, taskId?: string | null) => void;
  notifyTaskStatus: (...args: any[]) => void;
  resolveLang: (...args: any[]) => any;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  findTeamLeader: (...args: any[]) => any;
  getAgentDisplayName: (...args: any[]) => string;
  formatTaskSubtaskProgressSummary: (...args: any[]) => string;
  setTaskCreationAuditCompletion: (...args: any[]) => void;
  refreshCliUsageData: () => Promise<any>;
  taskWorktrees: Map<string, any>;
  mergeWorktree: (...args: any[]) => any;
  mergeToDevAndCreatePR: (...args: any[]) => any;
  cleanupWorktree: (...args: any[]) => void;
  recoverCrossDeptQueueAfterMissingCallback: (...args: any[]) => void;
  crossDeptNextCallbacks: Map<string, () => void>;
  subtaskDelegationCallbacks: Map<string, () => void>;
  reviewRoundState: Map<string, number>;
  reviewInFlight: Set<string>;
  projectReviewGateNotifiedAt: Map<string, number>;
  endTaskExecutionSession: (taskId: string, reason: string) => void;
  getProjectReviewGateSnapshot: (projectId: string) => any;
  startReviewConsensusMeeting: (...args: any[]) => void;
  archivePlanningConsolidatedReport: (rootTaskId: string) => Promise<void>;
  shouldDeferTaskReportUntilPlanningArchive: (task: any) => boolean;
  emitTaskReportEvent: (taskId: string) => void;
}) {
  const {
    db, nowMs, appendTaskLog, broadcast, notifyCeo, notifyTaskStatus,
    resolveLang, pickL, l, findTeamLeader, getAgentDisplayName,
    formatTaskSubtaskProgressSummary, setTaskCreationAuditCompletion,
    refreshCliUsageData, taskWorktrees, mergeWorktree, mergeToDevAndCreatePR,
    cleanupWorktree, recoverCrossDeptQueueAfterMissingCallback,
    crossDeptNextCallbacks, subtaskDelegationCallbacks,
    reviewRoundState, reviewInFlight, projectReviewGateNotifiedAt,
    endTaskExecutionSession, getProjectReviewGateSnapshot,
    startReviewConsensusMeeting, archivePlanningConsolidatedReport,
    shouldDeferTaskReportUntilPlanningArchive, emitTaskReportEvent,
  } = ctx;

  function finishReview(
    taskId: string,
    taskTitle: string,
    options?: { bypassProjectDecisionGate?: boolean; trigger?: string },
  ): void {
    const lang = resolveLang(taskTitle);
    const currentTask = db.prepare("SELECT status, department_id, source_task_id, project_id FROM tasks WHERE id = ?").get(taskId) as {
      status: string;
      department_id: string | null;
      source_task_id: string | null;
      project_id: string | null;
    } | undefined;
    if (!currentTask || currentTask.status !== "review") return;

    if (!options?.bypassProjectDecisionGate && !currentTask.source_task_id && currentTask.project_id) {
      const gateSnapshot = getProjectReviewGateSnapshot(currentTask.project_id);
      appendTaskLog(
        taskId,
        "system",
        `Review gate: waiting for project-level decision (${gateSnapshot.activeReview}/${gateSnapshot.activeTotal} active tasks in review)`,
      );
      if (gateSnapshot.ready) {
        const now = nowMs();
        const lastNotified = projectReviewGateNotifiedAt.get(currentTask.project_id) ?? 0;
        if (now - lastNotified > 30_000) {
          projectReviewGateNotifiedAt.set(currentTask.project_id, now);
          const project = db.prepare("SELECT name FROM projects WHERE id = ?").get(currentTask.project_id) as { name: string | null } | undefined;
          const projectName = (project?.name || currentTask.project_id).trim();
          notifyCeo(pickL(l(
            [`[CEO OFFICE] 프로젝트 '${projectName}'의 활성 항목 ${gateSnapshot.activeTotal}건이 모두 Review 상태입니다. 의사결정 인박스에서 승인하면 팀장 회의를 시작합니다.`],
            [`[CEO OFFICE] Project '${projectName}' now has all ${gateSnapshot.activeTotal} active tasks in Review. Approve from Decision Inbox to start team-lead review meetings.`],
            [`[CEO OFFICE] プロジェクト'${projectName}'のアクティブタスク${gateSnapshot.activeTotal}件がすべてReviewに到達しました。Decision Inboxで承認するとチームリーダー会議を開始します。`],
            [`[CEO OFFICE] 项目'${projectName}'的 ${gateSnapshot.activeTotal} 个活跃任务已全部进入 Review。请在 Decision Inbox 批准后启动组长评审会议。`],
          ), lang), taskId);
        }
      } else {
        projectReviewGateNotifiedAt.delete(currentTask.project_id);
      }
      return;
    }
    if (options?.bypassProjectDecisionGate && currentTask.project_id) {
      projectReviewGateNotifiedAt.delete(currentTask.project_id);
      appendTaskLog(taskId, "system", `Review gate bypassed (trigger=${options.trigger ?? "manual"})`);
    }

    const healed = db.prepare(`
      UPDATE subtasks
      SET status = 'done',
          completed_at = COALESCE(completed_at, ?),
          blocked_reason = NULL
      WHERE task_id = ?
        AND status = 'blocked'
        AND delegated_task_id IS NOT NULL
        AND delegated_task_id != ''
        AND EXISTS (
          SELECT 1
          FROM tasks dt
          WHERE dt.id = subtasks.delegated_task_id
            AND dt.status IN ('review', 'done')
        )
    `).run(nowMs(), taskId) as { changes?: number } | undefined;
    if ((healed?.changes ?? 0) > 0) {
      appendTaskLog(
        taskId,
        "system",
        `Review gate auto-heal: recovered ${healed?.changes ?? 0} blocked delegated subtask(s) after successful resume`,
      );
    }

    const remainingSubtasks = db.prepare(
      "SELECT COUNT(*) as cnt FROM subtasks WHERE task_id = ? AND status != 'done'"
    ).get(taskId) as { cnt: number };
    if (remainingSubtasks.cnt > 0) {
      notifyCeo(pickL(l(
        [`'${taskTitle}' 는 아직 ${remainingSubtasks.cnt}개 서브태스크가 남아 있어 Review 단계에서 대기합니다.`],
        [`'${taskTitle}' is waiting in Review because ${remainingSubtasks.cnt} subtasks are still unfinished.`],
        [`'${taskTitle}' は未完了サブタスクが${remainingSubtasks.cnt}件あるため、Reviewで待機しています。`],
        [`'${taskTitle}' 仍有 ${remainingSubtasks.cnt} 个 SubTask 未完成，当前在 Review 阶段等待。`],
      ), lang), taskId);
      appendTaskLog(taskId, "system", `Review hold: waiting for ${remainingSubtasks.cnt} unfinished subtasks`);
      return;
    }

    if (!currentTask.source_task_id) {
      const childProgress = db.prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status = 'review' THEN 1 ELSE 0 END) AS review_cnt,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done_cnt
        FROM tasks
        WHERE source_task_id = ?
      `).get(taskId) as { total: number; review_cnt: number | null; done_cnt: number | null } | undefined;
      const childTotal = childProgress?.total ?? 0;
      const childReview = childProgress?.review_cnt ?? 0;
      const childDone = childProgress?.done_cnt ?? 0;
      const childReady = childReview + childDone;
      if (childTotal > 0 && childReady < childTotal) {
        const waiting = childTotal - childReady;
        notifyCeo(pickL(l(
          [`'${taskTitle}' 는 협업 하위 태스크 ${waiting}건이 아직 Review 진입 전이라 전체 팀장회의를 대기합니다.`],
          [`'${taskTitle}' is waiting for ${waiting} collaboration child task(s) to reach review before the single team-lead meeting starts.`],
          [`'${taskTitle}' は協業子タスク${waiting}件がまだReview未到達のため、全体チームリーダー会議を待機しています。`],
          [`'${taskTitle}' 仍有 ${waiting} 个协作子任务尚未进入 Review，当前等待后再开启一次团队负责人会议。`],
        ), lang), taskId);
        appendTaskLog(taskId, "system", `Review hold: waiting for collaboration children to reach review (${childReady}/${childTotal})`);
        return;
      }
    }

    const finalizeApprovedReview = () => {
      const t = nowMs();
      const latestTask = db.prepare("SELECT status, department_id FROM tasks WHERE id = ?").get(taskId) as { status: string; department_id: string | null } | undefined;
      if (!latestTask || latestTask.status !== "review") return;

      const wtInfo = taskWorktrees.get(taskId);
      let mergeNote = "";
      if (wtInfo) {
        const projectRow = currentTask.project_id
          ? db.prepare("SELECT github_repo FROM projects WHERE id = ?").get(currentTask.project_id) as { github_repo: string | null } | undefined
          : undefined;
        const githubRepo = projectRow?.github_repo;

        const mergeResult = githubRepo
          ? mergeToDevAndCreatePR(wtInfo.projectPath, taskId, githubRepo)
          : mergeWorktree(wtInfo.projectPath, taskId);

        if (mergeResult.success) {
          appendTaskLog(taskId, "system", `Git merge completed: ${mergeResult.message}`);
          cleanupWorktree(wtInfo.projectPath, taskId);
          appendTaskLog(taskId, "system", "Worktree cleaned up after successful merge");
          mergeNote = githubRepo
            ? pickL(l(
              [" (dev 병합 + PR 생성)"],
              [" (merged to dev + PR)"],
              [" (dev マージ + PR)"],
              ["（合并到 dev + PR）"],
            ), lang)
            : pickL(l(
              [" (병합 완료)"],
              [" (merged)"],
              [" (マージ完了)"],
              ["（已合并）"],
            ), lang);
        } else {
          appendTaskLog(taskId, "system", `Git merge failed: ${mergeResult.message}`);

          const conflictLeader = findTeamLeader(latestTask.department_id);
          const conflictLeaderName = conflictLeader
            ? getAgentDisplayName(conflictLeader, lang)
            : pickL(l(["팀장"], ["Team Lead"], ["チームリーダー"], ["组长"]), lang);
          const conflictFiles = mergeResult.conflicts?.length
            ? pickL(l(
              [`\n충돌 파일: ${mergeResult.conflicts.join(", ")}`],
              [`\nConflicting files: ${mergeResult.conflicts.join(", ")}`],
              [`\n競合ファイル: ${mergeResult.conflicts.join(", ")}`],
              [`\n冲突文件: ${mergeResult.conflicts.join(", ")}`],
            ), lang)
            : "";
          notifyCeo(
            pickL(l(
              [`${conflictLeaderName}: '${taskTitle}' 병합 중 충돌이 발생했습니다. 수동 해결이 필요합니다.${conflictFiles}\n브랜치: ${wtInfo.branchName}`],
              [`${conflictLeaderName}: Merge conflict while merging '${taskTitle}'. Manual resolution is required.${conflictFiles}\nBranch: ${wtInfo.branchName}`],
              [`${conflictLeaderName}: '${taskTitle}' のマージ中に競合が発生しました。手動解決が必要です。${conflictFiles}\nブランチ: ${wtInfo.branchName}`],
              [`${conflictLeaderName}：合并 '${taskTitle}' 时发生冲突，需要手动解决。${conflictFiles}\n分支: ${wtInfo.branchName}`],
            ), lang),
            taskId,
          );

          mergeNote = pickL(l(
            [" (병합 충돌 - 수동 해결 필요)"],
            [" (merge conflict - manual resolution required)"],
            [" (マージ競合 - 手動解決が必要)"],
            ["（合并冲突 - 需要手动解决）"],
          ), lang);
        }
      }

      db.prepare(
        "UPDATE tasks SET status = 'done', completed_at = ?, updated_at = ? WHERE id = ?"
      ).run(t, t, taskId);
      setTaskCreationAuditCompletion(taskId, true);

      appendTaskLog(taskId, "system", "Status → done (all leaders approved)");
      endTaskExecutionSession(taskId, "task_done");

      const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId);
      broadcast("task_update", updatedTask);
      notifyTaskStatus(taskId, taskTitle, "done", lang);

      refreshCliUsageData().then((usage) => broadcast("cli_usage_update", usage)).catch(() => {});
      const deferTaskReport = shouldDeferTaskReportUntilPlanningArchive(currentTask);
      if (deferTaskReport) {
        appendTaskLog(taskId, "system", "Task report popup deferred until planning consolidated archive is ready");
      } else {
        emitTaskReportEvent(taskId);
      }

      const leader = findTeamLeader(latestTask.department_id);
      const leaderName = leader
        ? getAgentDisplayName(leader, lang)
        : pickL(l(["팀장"], ["Team Lead"], ["チームリーダー"], ["组长"]), lang);
      const subtaskProgressSummary = formatTaskSubtaskProgressSummary(taskId, lang);
      const progressSuffix = subtaskProgressSummary
        ? `\n${pickL(l(["보완/협업 완료 현황"], ["Remediation/Collaboration completion"], ["補完/協業 完了状況"], ["整改/协作完成情况"]), lang)}\n${subtaskProgressSummary}`
        : "";
      notifyCeo(pickL(l(
        [`${leaderName}: '${taskTitle}' 최종 승인 완료 보고드립니다.${mergeNote}${progressSuffix}`],
        [`${leaderName}: Final approval completed for '${taskTitle}'.${mergeNote}${progressSuffix}`],
        [`${leaderName}: '${taskTitle}' の最終承認が完了しました。${mergeNote}${progressSuffix}`],
        [`${leaderName}：'${taskTitle}' 最终审批已完成。${mergeNote}${progressSuffix}`],
      ), lang), taskId);

      reviewRoundState.delete(taskId);
      reviewInFlight.delete(taskId);

      if (!currentTask.source_task_id) {
        const childRows = db.prepare(
          "SELECT id, title FROM tasks WHERE source_task_id = ? AND status = 'review' ORDER BY created_at ASC"
        ).all(taskId) as Array<{ id: string; title: string }>;
        if (childRows.length > 0) {
          appendTaskLog(taskId, "system", `Finalization: closing ${childRows.length} collaboration child task(s) after parent review`);
          for (const child of childRows) {
            finishReview(child.id, child.title);
          }
        }
        void archivePlanningConsolidatedReport(taskId);
      }

      const nextCallback = crossDeptNextCallbacks.get(taskId);
      if (nextCallback) {
        crossDeptNextCallbacks.delete(taskId);
        nextCallback();
      } else {
        recoverCrossDeptQueueAfterMissingCallback(taskId);
      }

      const subtaskNext = subtaskDelegationCallbacks.get(taskId);
      if (subtaskNext) {
        subtaskDelegationCallbacks.delete(taskId);
        subtaskNext();
      }
    };

    if (currentTask.source_task_id) {
      appendTaskLog(taskId, "system", "Review consensus skipped for delegated collaboration task");
      finalizeApprovedReview(); return;
    }
    startReviewConsensusMeeting(taskId, taskTitle, currentTask.department_id, finalizeApprovedReview);
  }
  return { finishReview };
}
