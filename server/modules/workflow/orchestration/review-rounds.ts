// @ts-nocheck

export type ReviewRoundMode = "parallel_remediation" | "merge_synthesis" | "final_decision";

export function getReviewRoundMode(round: number): ReviewRoundMode {
  if (round <= 1) return "parallel_remediation";
  if (round === 2) return "merge_synthesis";
  return "final_decision";
}

// ---------------------------------------------------------------------------
// Project review gate snapshot
// ---------------------------------------------------------------------------

export function createReviewRoundHelpers(ctx: {
  db: any;
  nowMs: () => number;
  appendTaskLog: (...args: any[]) => void;
  reviewRoundState: Map<string, number>;
  reviewInFlight: Set<string>;
  projectReviewGateNotifiedAt: Map<string, number>;
  randomDelay: (min: number, max: number) => number;
  resolveLang: (...args: any[]) => any;
  pickL: (...args: any[]) => string;
  l: (...args: any[]) => any;
  notifyCeo: (content: string, taskId?: string | null, messageType?: string) => void;
  finishReview: (...args: any[]) => void;
}) {
  const {
    db, nowMs, appendTaskLog, reviewRoundState, reviewInFlight,
    projectReviewGateNotifiedAt, randomDelay, resolveLang, pickL, l,
    notifyCeo, finishReview,
  } = ctx;

  function getProjectReviewGateSnapshot(projectId: string): {
    activeTotal: number;
    activeReview: number;
    rootReviewTotal: number;
    ready: boolean;
  } {
    const row = db.prepare(`
      SELECT
        SUM(CASE WHEN status NOT IN ('done', 'cancelled') THEN 1 ELSE 0 END) AS active_total,
        SUM(CASE WHEN status NOT IN ('done', 'cancelled') AND status = 'review' THEN 1 ELSE 0 END) AS active_review,
        SUM(CASE WHEN status = 'review' AND source_task_id IS NULL THEN 1 ELSE 0 END) AS root_review_total
      FROM tasks
      WHERE project_id = ?
    `).get(projectId) as {
      active_total: number | null;
      active_review: number | null;
      root_review_total: number | null;
    } | undefined;
    const activeTotal = row?.active_total ?? 0;
    const activeReview = row?.active_review ?? 0;
    const rootReviewTotal = row?.root_review_total ?? 0;
    const ready = activeTotal > 0 && activeTotal === activeReview && rootReviewTotal > 0;
    return { activeTotal, activeReview, rootReviewTotal, ready };
  }

  function scheduleNextReviewRound(
    taskId: string,
    taskTitle: string,
    currentRound: number,
    lang: any,
  ): void {
    const nextRound = currentRound + 1;
    appendTaskLog(
      taskId,
      "system",
      `Review round ${currentRound}: scheduling round ${nextRound} finalization meeting`,
    );
    notifyCeo(pickL(l(
      [`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 ${currentRound} 취합이 완료되어 라운드 ${nextRound} 최종 승인 회의로 즉시 전환합니다.`],
      [`[CEO OFFICE] '${taskTitle}' review round ${currentRound} consolidation is complete. Moving directly to final approval round ${nextRound}.`],
      [`[CEO OFFICE] '${taskTitle}' のレビューラウンド${currentRound}集約が完了したため、最終承認ラウンド${nextRound}へ即時移行します。`],
      [`[CEO OFFICE] '${taskTitle}' 第 ${currentRound} 轮评审已完成汇总，立即转入第 ${nextRound} 轮最终审批会议。`],
    ), lang), taskId);
    setTimeout(() => {
      const current = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status: string } | undefined;
      if (!current || current.status !== "review") return;
      finishReview(taskId, taskTitle, {
        bypassProjectDecisionGate: true,
        trigger: "review_round_transition",
      });
    }, randomDelay(1200, 1900));
  }

  return { getProjectReviewGateSnapshot, scheduleNextReviewRound };
}
