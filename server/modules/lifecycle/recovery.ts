// @ts-nocheck
import fs from "node:fs";
import path from "path";
import type { RuntimeContext } from "../../types/runtime-context.ts";
import { notifyTaskStatus } from "../../gateway/client.ts";
import { pruneDuplicateReviewMeetings } from "./breaks.ts";

type InProgressRecoveryReason = "startup" | "interval";

export function recoverOrphanInProgressTasks(ctx: RuntimeContext, reason: InProgressRecoveryReason): void {
  const {
    IN_PROGRESS_ORPHAN_GRACE_MS,
    activeProcesses,
    appendTaskLog,
    broadcast,
    clearTaskWorkflowState,
    db,
    endTaskExecutionSession,
    handleTaskRunComplete,
    isPidAlive,
    nowMs,
    notifyCeo,
    resolveLang,
    rollbackTaskWorktree,
    runInTransaction,
    stopProgressTimer,
    logsDir,
  } = ctx as any;

  const ORPHAN_RECENT_ACTIVITY_WINDOW_MS = Math.max(120_000, IN_PROGRESS_ORPHAN_GRACE_MS);

  const inProgressTasks = db.prepare(`
    SELECT id, title, assigned_agent_id, created_at, started_at, updated_at
    FROM tasks
    WHERE status = 'in_progress'
    ORDER BY updated_at ASC
  `).all() as Array<{
    id: string;
    title: string;
    assigned_agent_id: string | null;
    created_at: number | null;
    started_at: number | null;
    updated_at: number | null;
  }>;

  const now = nowMs();
  for (const task of inProgressTasks) {
    const active = activeProcesses.get(task.id);
    if (active) {
      const pid = typeof active.pid === "number" ? active.pid : null;
      if (pid !== null && pid > 0 && !isPidAlive(pid)) {
        activeProcesses.delete(task.id);
        appendTaskLog(task.id, "system", `Recovery (${reason}): removed stale process handle (pid=${pid})`);
      } else {
        continue;
      }
    }

    const lastTouchedAt = Math.max(task.updated_at ?? 0, task.started_at ?? 0, task.created_at ?? 0);
    const ageMs = lastTouchedAt > 0 ? Math.max(0, now - lastTouchedAt) : IN_PROGRESS_ORPHAN_GRACE_MS + 1;
    if (ageMs < IN_PROGRESS_ORPHAN_GRACE_MS) continue;

    const recentLog = db.prepare(`
      SELECT created_at FROM task_logs
      WHERE task_id = ? AND created_at > ?
      ORDER BY created_at DESC LIMIT 1
    `).get(task.id, now - ORPHAN_RECENT_ACTIVITY_WINDOW_MS) as { created_at: number } | undefined;
    if (recentLog) continue;

    try {
      const logPath = path.join(logsDir, `${task.id}.log`);
      const stat = fs.statSync(logPath);
      const logIdleMs = Math.max(0, now - Math.floor(stat.mtimeMs || 0));
      if (logIdleMs <= ORPHAN_RECENT_ACTIVITY_WINDOW_MS) continue;
    } catch {
      // no log file or inaccessible
    }

    const latestRunLog = db.prepare(`
      SELECT message
      FROM task_logs
      WHERE task_id = ?
        AND kind = 'system'
        AND (message LIKE 'RUN %' OR message LIKE 'Agent spawn failed:%')
      ORDER BY created_at DESC
      LIMIT 1
    `).get(task.id) as { message: string } | undefined;
    const latestRunMessage = latestRunLog?.message ?? "";

    if (latestRunMessage.startsWith("RUN completed (exit code: 0)")) {
      appendTaskLog(
        task.id,
        "system",
        `Recovery (${reason}): orphan in_progress detected (age_ms=${ageMs}) → replaying successful completion`,
      );
      handleTaskRunComplete(task.id, 0);
      continue;
    }

    if (latestRunMessage.startsWith("RUN ") || latestRunMessage.startsWith("Agent spawn failed:")) {
      appendTaskLog(
        task.id,
        "system",
        `Recovery (${reason}): orphan in_progress detected (age_ms=${ageMs}) → replaying failed completion`,
      );
      handleTaskRunComplete(task.id, 1);
      continue;
    }

    const t = nowMs();
    const move = db.prepare(
      "UPDATE tasks SET status = 'inbox', updated_at = ? WHERE id = ? AND status = 'in_progress'"
    ).run(t, task.id) as { changes?: number };
    if ((move.changes ?? 0) === 0) continue;

    stopProgressTimer(task.id);
    clearTaskWorkflowState(task.id);
    endTaskExecutionSession(task.id, `orphan_in_progress_${reason}`);
    appendTaskLog(
      task.id,
      "system",
      `Recovery (${reason}): in_progress without active process/run log (age_ms=${ageMs}) → inbox`,
    );

    if (task.assigned_agent_id) {
      db.prepare("UPDATE agents SET status = 'idle', current_task_id = NULL WHERE id = ?")
        .run(task.assigned_agent_id);
      const updatedAgent = db.prepare("SELECT * FROM agents WHERE id = ?").get(task.assigned_agent_id);
      broadcast("agent_status", updatedAgent);
    }

    const updatedTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(task.id);
    broadcast("task_update", updatedTask);
    const lang = resolveLang(task.title);
    notifyTaskStatus(task.id, task.title, "inbox", lang);
    const watchdogMessage = lang === "en"
      ? `[WATCHDOG] '${task.title}' was in progress but had no active process. Recovered to inbox.`
      : lang === "ja"
        ? `[WATCHDOG] '${task.title}' は in_progress でしたが実行プロセスが存在しないため inbox に復旧しました。`
        : lang === "zh"
          ? `[WATCHDOG] '${task.title}' 处于 in_progress，但未发现执行进程，已恢复到 inbox。`
          : `[WATCHDOG] '${task.title}' 작업이 in_progress 상태였지만 실행 프로세스가 없어 inbox로 복구했습니다.`;
    notifyCeo(watchdogMessage, task.id);
  }
}

export function recoverInterruptedWorkflowOnStartup(ctx: RuntimeContext): void {
  const { db, finishReview, reconcileCrossDeptSubtasks } = ctx as any;

  pruneDuplicateReviewMeetings(ctx);

  try {
    reconcileCrossDeptSubtasks();
  } catch (err) {
    console.error("[HyperClaw] startup reconciliation failed:", err);
  }

  recoverOrphanInProgressTasks(ctx, "startup");

  const reviewTasks = db.prepare(`
    SELECT id, title
    FROM tasks
    WHERE status = 'review'
    ORDER BY updated_at ASC
  `).all() as Array<{ id: string; title: string }>;

  reviewTasks.forEach((task, idx) => {
    const delay = 1200 + idx * 400;
    setTimeout(() => {
      const current = db.prepare("SELECT status FROM tasks WHERE id = ?").get(task.id) as { status: string } | undefined;
      if (!current || current.status !== "review") return;
      finishReview(task.id, task.title);
    }, delay);
  });
}

export function sweepPendingSubtaskDelegations(ctx: RuntimeContext): void {
  const { db, processSubtaskDelegations } = ctx as any;

  const parents = db.prepare(`
    SELECT DISTINCT t.id
    FROM tasks t
    JOIN subtasks s ON s.task_id = t.id
    WHERE t.status IN ('planned', 'collaborating', 'in_progress', 'review')
      AND s.target_department_id IS NOT NULL
      AND s.status != 'done'
      AND (s.delegated_task_id IS NULL OR s.delegated_task_id = '')
    ORDER BY t.updated_at ASC
    LIMIT 80
  `).all() as Array<{ id: string }>;

  for (const row of parents) {
    if (!row.id) continue;
    processSubtaskDelegations(row.id);
  }
}
