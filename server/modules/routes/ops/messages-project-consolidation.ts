// @ts-nocheck

export function buildProjectReviewConsolidation(ctx: {
  db: any;
  nowMs: () => number;
  findTeamLeader: (dept: string) => any;
  getAgentDisplayName: (agent: any, lang: string) => string;
  runAgentOneShot: (agent: any, prompt: string, opts: any) => Promise<any>;
  chooseSafeReply: (run: any, lang: string, kind: string, agent: any) => string;
  l: (...args: any[]) => any;
  pickL: (val: any, lang: string) => string;
  stateHelpers: {
    getProjectReviewDecisionState: (id: string) => any;
    upsertProjectReviewDecisionState: (...args: any[]) => void;
    recordProjectReviewDecisionEvent: (input: any) => void;
    getProjectReviewRoundDecisionContext: (id: string, lang: string, limit?: number) => string[];
    formatPlannerSummaryForDisplay: (input: string) => string;
  };
  projectReviewDecisionConsolidationInFlight: Set<string>;
}) {
  const { db, nowMs, findTeamLeader, getAgentDisplayName, runAgentOneShot, chooseSafeReply, l, pickL, stateHelpers, projectReviewDecisionConsolidationInFlight } = ctx;
  const { getProjectReviewDecisionState, upsertProjectReviewDecisionState, recordProjectReviewDecisionEvent, getProjectReviewRoundDecisionContext, formatPlannerSummaryForDisplay } = stateHelpers;

  function buildProjectReviewPlanningFallbackSummary(
    lang: string, projectName: string, taskTitles: string[], roundDecisionLines: string[] = [],
  ): string {
    const topTasks = taskTitles.slice(0, 6);
    const lines = topTasks.map((title, idx) => `${idx + 1}. ${title}`);
    const noTaskLine = pickL(l(["- 검토 항목 정보 없음"], ["- No review-item details available"], ["- レビュー項目情報なし"], ["- 无可用评审项信息"]), lang);
    const taskBlock = lines.length > 0 ? lines.join("\n") : noTaskLine;
    const noRoundDecisionLine = pickL(l(["- 라운드 의사결정 이력 없음"], ["- No round-level decision history yet"], ["- ラウンド判断履歴なし"], ["- 暂无轮次决策记录"]), lang);
    const roundDecisionBlock = roundDecisionLines.length > 0 ? roundDecisionLines.slice(0, 8).join("\n") : noRoundDecisionLine;
    return pickL(l(
      [`프로젝트 '${projectName}' 검토 항목을 기획팀장 기준으로 취합했습니다.\n- 주요 검토 포인트를 기준으로 대표 항목을 선택한 뒤 팀장 회의를 시작하세요.\n- 필요 시 추가요청 입력으로 보완 작업을 먼저 열 수 있습니다.\n\n검토 대상:\n${taskBlock}\n\n최근 리뷰 라운드 의사결정:\n${roundDecisionBlock}`],
      [`Planning-lead consolidation is complete for project '${projectName}'.\n- Choose representative review item(s) from key checkpoints, then start the team-lead meeting.\n- If needed, open remediation first with Add Follow-up Request.\n\nReview targets:\n${taskBlock}\n\nRecent review-round decisions:\n${roundDecisionBlock}`],
      [`プロジェクト'${projectName}'のレビュー項目を企画リード基準で集約しました。\n- 主要チェックポイントを基準に代表項目を選択してからチームリーダー会議を開始してください。\n- 必要に応じて追加要請入力で先に補完作業を開けます。\n\nレビュー対象:\n${taskBlock}\n\n最近のレビューラウンド判断:\n${roundDecisionBlock}`],
      [`项目'${projectName}'的评审项已按规划负责人标准完成汇总。\n- 请先按关键检查点选择代表项，再启动组长评审会议。\n- 如有需要，可先通过追加请求开启补充整改。\n\n评审目标:\n${taskBlock}\n\n最近评审轮次决策:\n${roundDecisionBlock}`],
    ), lang);
  }

  function queueProjectReviewPlanningConsolidation(
    projectId: string, projectName: string, projectPath: string | null, snapshotHash: string, lang: string,
  ): void {
    const inFlightKey = `${projectId}:${snapshotHash}`;
    if (projectReviewDecisionConsolidationInFlight.has(inFlightKey)) return;
    projectReviewDecisionConsolidationInFlight.add(inFlightKey);

    void (async () => {
      try {
        const currentState = getProjectReviewDecisionState(projectId);
        if (!currentState || currentState.snapshot_hash !== snapshotHash) return;
        if (currentState.status !== "collecting") return;

        const taskRows = db.prepare(`
          SELECT t.id, t.title, t.updated_at,
            COALESCE((SELECT m.content FROM messages m WHERE m.task_id = t.id AND m.message_type = 'report' ORDER BY m.created_at DESC LIMIT 1), '') AS latest_report
          FROM tasks t WHERE t.project_id = ? AND t.status = 'review' AND t.source_task_id IS NULL
          ORDER BY t.updated_at ASC, t.created_at ASC LIMIT 20
        `).all(projectId) as Array<{ id: string; title: string; updated_at: number; latest_report: string }>;

        if (taskRows.length <= 0) return;
        const planningLeader = findTeamLeader("planning");
        const clip = (text: string, max = 180) => {
          const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
          if (!normalized) return "-";
          return normalized.length > max ? `${normalized.slice(0, max - 3).trimEnd()}...` : normalized;
        };
        const roundDecisionLines = getProjectReviewRoundDecisionContext(projectId, lang, 8);
        const noRoundDecisionPromptLine = pickL(l(["- 라운드 의사결정 이력 없음"], ["- No round-level decision history yet"], ["- ラウンド判断履歴なし"], ["- 暂无轮次决策记录"]), lang);
        const roundDecisionPromptBlock = roundDecisionLines.length > 0 ? roundDecisionLines.join("\n") : noRoundDecisionPromptLine;
        const fallbackSummary = buildProjectReviewPlanningFallbackSummary(lang, projectName, taskRows.map((task) => task.title), roundDecisionLines);

        let plannerSummary = fallbackSummary;
        if (planningLeader) {
          const sourceLines = taskRows.map((task, idx) => `${idx + 1}) ${task.title}\n- latest_report: ${clip(task.latest_report)}`).join("\n");
          const prompt = [
            `You are the planning lead (${planningLeader.name}).`,
            `Consolidate project-level review status for '${projectName}'.`,
            `Language: ${lang}`,
            "Output requirements:",
            "- Provide one concise paragraph for CEO decision support.",
            "- Include: representative selection guidance, meeting start condition, and follow-up request usage hint.",
            "- If round-level decisions exist, reflect them explicitly in the recommendation.",
            "- Keep it under 10 lines.",
            "", "Review item sources:", sourceLines, "", "Recent review-round decision context:", roundDecisionPromptBlock,
          ].join("\n");
          try {
            const run = await runAgentOneShot(planningLeader, prompt, { projectPath: projectPath || process.cwd(), timeoutMs: 45_000 });
            const preferred = String(chooseSafeReply(run, lang, "summary", planningLeader) || "").trim();
            const raw = String(run?.text || "").trim();
            const merged = preferred || raw;
            if (merged) {
              const clipped = merged.length > 1800 ? `${merged.slice(0, 1797).trimEnd()}...` : merged;
              plannerSummary = formatPlannerSummaryForDisplay(clipped);
            }
          } catch { plannerSummary = fallbackSummary; }
        }
        plannerSummary = formatPlannerSummaryForDisplay(plannerSummary);

        const updateResult = db.prepare(`
          UPDATE project_review_decision_states
          SET status = 'ready', planner_summary = ?, planner_agent_id = ?, planner_agent_name = ?, updated_at = ?
          WHERE project_id = ? AND snapshot_hash = ? AND status = 'collecting'
        `).run(
          plannerSummary, planningLeader?.id ?? null,
          planningLeader ? getAgentDisplayName(planningLeader, lang) : null,
          nowMs(), projectId, snapshotHash,
        ) as { changes?: number } | undefined;

        if ((updateResult?.changes ?? 0) > 0) {
          recordProjectReviewDecisionEvent({ project_id: projectId, snapshot_hash: snapshotHash, event_type: "planning_summary", summary: plannerSummary });
        }
      } catch {
        const failMsg = pickL(l(["기획팀장 의견 취합이 일시 지연되었습니다. 자동 재시도 중입니다."], ["Planning-lead consolidation is temporarily delayed. Auto retry in progress."], ["企画リード意見の集約が一時遅延しました。自動再試行中です。"], ["规划负责人意见汇总暂时延迟，正在自动重试。"]), lang);
        db.prepare(`UPDATE project_review_decision_states SET status = 'failed', planner_summary = ?, updated_at = ? WHERE project_id = ? AND snapshot_hash = ?`).run(failMsg, nowMs(), projectId, snapshotHash);
      } finally {
        projectReviewDecisionConsolidationInFlight.delete(inFlightKey);
      }
    })();
  }

  return { buildProjectReviewPlanningFallbackSummary, queueProjectReviewPlanningConsolidation };
}
