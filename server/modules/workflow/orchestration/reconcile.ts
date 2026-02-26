// @ts-nocheck

export function createReconcileHelpers(ctx: {
  db: any;
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  broadcast: (...args: any[]) => void;
  getPreferredLanguage: () => string;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  finishReview: (taskId: string, taskTitle: string, options?: any) => void;
}) {
  const {
    db, nowMs, appendTaskLog, broadcast, getPreferredLanguage, pickL, l, finishReview,
  } = ctx;

  function reconcileDelegatedSubtasksAfterRun(taskId: string, exitCode: number): void {
    const linked = db.prepare(`
      SELECT id, task_id
      FROM subtasks
      WHERE delegated_task_id = ?
        AND status NOT IN ('done', 'cancelled')
    `).all(taskId) as Array<{ id: string; task_id: string }>;
    if (linked.length <= 0) return;

    const touchedParents = new Set<string>();
    for (const sub of linked) {
      if (sub.task_id) touchedParents.add(sub.task_id);
    }

    if (exitCode === 0) {
      const doneAt = nowMs();
      for (const sub of linked) {
        db.prepare(
          "UPDATE subtasks SET status = 'done', completed_at = ?, blocked_reason = NULL WHERE id = ?"
        ).run(doneAt, sub.id);
        broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sub.id));
      }
      appendTaskLog(taskId, "system", `Delegated subtask sync: marked ${linked.length} linked subtask(s) as done`);

      for (const parentTaskId of touchedParents) {
        const parent = db.prepare("SELECT id, title, status FROM tasks WHERE id = ?").get(parentTaskId) as {
          id: string;
          title: string;
          status: string;
        } | undefined;
        if (!parent) continue;
        const remaining = db.prepare(
          "SELECT COUNT(*) AS cnt FROM subtasks WHERE task_id = ? AND status != 'done'"
        ).get(parentTaskId) as { cnt: number } | undefined;
        if ((remaining?.cnt ?? 0) === 0 && parent.status === "review") {
          appendTaskLog(parentTaskId, "system", "All delegated subtasks completed after resume; retrying review completion");
          setTimeout(() => finishReview(parentTaskId, parent.title), 1200);
        }
      }
      return;
    }

    const lang = getPreferredLanguage();
    const blockedReason = pickL(l(
      ["위임 작업 실패"],
      ["Delegated task failed"],
      ["委任タスク失敗"],
      ["委派任务失败"],
    ), lang);
    for (const sub of linked) {
      db.prepare(
        "UPDATE subtasks SET status = 'blocked', blocked_reason = ?, completed_at = NULL WHERE id = ?"
      ).run(blockedReason, sub.id);
      broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(sub.id));
    }
    appendTaskLog(taskId, "system", `Delegated subtask sync: marked ${linked.length} linked subtask(s) as blocked`);
  }

  return { reconcileDelegatedSubtasksAfterRun };
}
