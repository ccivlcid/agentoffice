// @ts-nocheck
import { REVIEW_MAX_ROUNDS } from "../../../db/runtime.ts";
import type { MeetingTranscriptEntry } from "./meetings-memo.ts";
import { runReviewVotePhase } from "./meetings-rounds-vote.ts";

export function makeRoundsHelpers(ctx: any) {
  const {
    db, reviewInFlight, reviewRoundState, meetingReviewDecisionByAgent,
    getTaskReviewLeaders, resolveLang, appendTaskLog, notifyCeo,
    getReviewRoundMode, scheduleNextReviewRound, resolveProjectPath,
    runAgentOneShot, chooseSafeReply, sleepMs, randomDelay,
    sendAgentMessage, getAgentDisplayName, getDeptName, getRoleLabel,
    buildMeetingPrompt, wantsReviewRevision, findLatestTranscriptContentByAgent,
    isDeferrableReviewHold, summarizeForMeetingBubble,
    isTaskWorkflowInterrupted, getTaskStatusById, clearTaskWorkflowState,
    l, pickL,
    beginMeetingMinutes, appendMeetingMinuteEntry, finishMeetingMinutes,
    callLeadersToCeoOffice, dismissLeadersFromCeoOffice, emitMeetingSpeech,
    collectRevisionMemoItems, reserveReviewRevisionMemoItems,
    loadRecentReviewRevisionMemoItems, appendTaskProjectMemo, appendTaskReviewFinalMemo,
  } = ctx;

  function startReviewConsensusMeeting(
    taskId: string,
    taskTitle: string,
    departmentId: string | null,
    onApproved: () => void,
  ): void {
    if (reviewInFlight.has(taskId)) return;
    reviewInFlight.add(taskId);

    void (async () => {
      let meetingId: string | null = null;
      const leaders = getTaskReviewLeaders(taskId, departmentId);
      if (leaders.length === 0) { reviewInFlight.delete(taskId); onApproved(); return; }
      try {
        const latestMeeting = db.prepare(`
          SELECT id, round, status FROM meeting_minutes
          WHERE task_id = ? AND meeting_type = 'review'
          ORDER BY started_at DESC, created_at DESC LIMIT 1
        `).get(taskId) as { id: string; round: number; status: string } | undefined;
        const resumeMeeting = latestMeeting?.status === "in_progress";
        const round = resumeMeeting ? (latestMeeting?.round ?? 1) : ((latestMeeting?.round ?? 0) + 1);
        reviewRoundState.set(taskId, round);
        if (!resumeMeeting && round > REVIEW_MAX_ROUNDS) {
          const cappedLang = resolveLang(taskTitle);
          appendTaskLog(taskId, "system", `Review round ${round} exceeds max_rounds=${REVIEW_MAX_ROUNDS}; forcing final decision`);
          notifyCeo(pickL(l(
            [`[CEO OFFICE] '${taskTitle}' 리뷰 라운드가 최대치(${REVIEW_MAX_ROUNDS})를 초과해 추가 보완은 중단하고 최종 승인 판단으로 전환합니다.`],
            [`[CEO OFFICE] '${taskTitle}' exceeded max review rounds (${REVIEW_MAX_ROUNDS}). Additional revision rounds are closed and we are moving to final approval decision.`],
            [`[CEO OFFICE] '${taskTitle}' はレビュー上限(${REVIEW_MAX_ROUNDS}回)を超えたため、追加補完を停止して最終承認判断へ移行します。`],
            [`[CEO OFFICE] '${taskTitle}' 的评审轮次已超过上限（${REVIEW_MAX_ROUNDS}）。现停止追加整改并转入最终审批判断。`],
          ), cappedLang), taskId);
          reviewRoundState.delete(taskId); reviewInFlight.delete(taskId); onApproved(); return;
        }

        const roundMode = getReviewRoundMode(round);
        const isRound1Remediation = roundMode === "parallel_remediation";
        const isRound2Merge = roundMode === "merge_synthesis";
        const isFinalDecisionRound = roundMode === "final_decision";
        const planningLeader = leaders.find((l) => l.department_id === "planning") ?? leaders[0];
        const otherLeaders = leaders.filter((l) => l.id !== planningLeader.id);
        let needsRevision = false;
        let reviseOwner: any | null = null;
        const seatIndexByAgent = new Map(leaders.slice(0, 6).map((leader, idx) => [leader.id, idx]));
        const taskCtx = db.prepare("SELECT description, project_path FROM tasks WHERE id = ?").get(taskId) as any;
        const taskDescription = taskCtx?.description ?? null;
        const projectPath = resolveProjectPath({ title: taskTitle, description: taskDescription, project_path: taskCtx?.project_path ?? null });
        const lang = resolveLang(taskDescription ?? taskTitle);
        const transcript: MeetingTranscriptEntry[] = [];
        const oneShotOptions = { projectPath, timeoutMs: 35_000 };
        meetingId = resumeMeeting ? (latestMeeting?.id ?? null) : beginMeetingMinutes(taskId, "review", round, taskTitle);
        let minuteSeq = 1;
        if (meetingId) {
          const seqRow = db.prepare("SELECT COALESCE(MAX(seq), 0) AS max_seq FROM meeting_minute_entries WHERE meeting_id = ?").get(meetingId) as any;
          minuteSeq = (seqRow?.max_seq ?? 0) + 1;
        }
        const abortIfInactive = (): boolean => {
          if (!isTaskWorkflowInterrupted(taskId)) return false;
          const status = getTaskStatusById(taskId);
          if (meetingId) finishMeetingMinutes(meetingId, "failed");
          dismissLeadersFromCeoOffice(taskId, leaders);
          clearTaskWorkflowState(taskId);
          if (status) appendTaskLog(taskId, "system", `Review meeting aborted due to task state change (${status})`);
          return true;
        };
        const speak = (leader: any, messageType: string, receiverType: string, receiverId: string | null, content: string) => {
          if (isTaskWorkflowInterrupted(taskId)) return;
          sendAgentMessage(leader, content, messageType, receiverType, receiverId, taskId);
          const seatIndex = seatIndexByAgent.get(leader.id) ?? 0;
          emitMeetingSpeech(leader.id, seatIndex, "review", taskId, content, lang);
          transcript.push({ speaker_agent_id: leader.id, speaker: getAgentDisplayName(leader, lang), department: getDeptName(leader.department_id ?? ""), role: getRoleLabel(leader.role, lang as any), content });
          if (meetingId) appendMeetingMinuteEntry(meetingId, minuteSeq++, leader, lang, messageType, content);
        };

        if (abortIfInactive()) return;
        callLeadersToCeoOffice(taskId, leaders, "review");
        const resumeNotice = isRound2Merge
          ? l([`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 ${round} 재개. 라운드1 보완 결과 취합/머지 판단을 이어갑니다.`], [`[CEO OFFICE] '${taskTitle}' review round ${round} resumed. Continuing consolidation and merge-readiness judgment from round 1 remediation.`], [`[CEO OFFICE] '${taskTitle}' レビューラウンド${round}を再開。ラウンド1補完結果の集約とマージ可否判断を続行します。`], [`[CEO OFFICE] 已恢复'${taskTitle}'第${round}轮 Review，继续汇总第1轮整改结果并判断合并准备度。`])
          : isFinalDecisionRound
            ? l([`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 ${round} 재개. 추가 보완 없이 최종 승인과 문서 확정을 진행합니다.`], [`[CEO OFFICE] '${taskTitle}' review round ${round} resumed. Final approval and documentation will be completed without additional remediation.`], [`[CEO OFFICE] '${taskTitle}' レビューラウンド${round}を再開。追加補完なしで最終承認と文書確定を進めます。`], [`[CEO OFFICE] 已恢复'${taskTitle}'第${round}轮 Review，将在不新增整改的前提下完成最终审批与文档确认。`])
            : l([`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 ${round} 재개. 팀장 의견 수집 및 상호 승인 재진행합니다.`], [`[CEO OFFICE] '${taskTitle}' review round ${round} resumed. Continuing team-lead feedback and mutual approvals.`], [`[CEO OFFICE] '${taskTitle}' レビューラウンド${round}を再開しました。チームリーダー意見収集と相互承認を続行します。`], [`[CEO OFFICE] 已恢复'${taskTitle}'第${round}轮 Review，继续收集团队负责人意见与相互审批。`]);
        const startNotice = isRound2Merge
          ? l([`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 ${round} 시작. 라운드1 보완 작업 결과를 팀장회의에서 취합하고 머지 판단을 진행합니다.`], [`[CEO OFFICE] '${taskTitle}' review round ${round} started. Team leads are consolidating round 1 remediation outputs and making merge-readiness decisions.`], [`[CEO OFFICE] '${taskTitle}' レビューラウンド${round}開始。ラウンド1補完結果をチームリーダー会議で集約し、マージ可否を判断します。`], [`[CEO OFFICE] 已开始'${taskTitle}'第${round}轮 Review，团队负责人将汇总第1轮整改结果并进行合并判断。`])
          : isFinalDecisionRound
            ? l([`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 ${round} 시작. 추가 보완 없이 최종 승인 결과와 문서 패키지를 확정합니다.`], [`[CEO OFFICE] '${taskTitle}' review round ${round} started. Final approval and documentation package will be finalized without additional remediation.`], [`[CEO OFFICE] '${taskTitle}' レビューラウンド${round}開始。追加補완なしで最終承認結果と文書パッケージを確定します。`], [`[CEO OFFICE] 已开始'${taskTitle}'第${round}轮 Review，在不新增整改的前提下确定最终审批结果与文档包。`])
            : l([`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 ${round} 시작. 팀장 의견 수집 및 상호 승인 진행합니다.`], [`[CEO OFFICE] '${taskTitle}' review round ${round} started. Collecting team-lead feedback and mutual approvals.`], [`[CEO OFFICE] '${taskTitle}' レビューラウンド${round}を開始しました。チームリーダー意見収集と相互承認を進めます。`], [`[CEO OFFICE] 已开始'${taskTitle}'第${round}轮 Review，正在收集团队负责人意见并进行相互审批。`]);
        notifyCeo(pickL(resumeMeeting ? resumeNotice : startNotice, lang), taskId);

        const openingPrompt = buildMeetingPrompt(planningLeader, {
          meetingType: "review", round, taskTitle, taskDescription, transcript,
          turnObjective: isRound2Merge ? "Kick off round 2 merge-synthesis discussion and ask each leader to verify consolidated remediation output." : isFinalDecisionRound ? "Kick off round 3 final decision discussion and confirm that no additional remediation round will be opened." : "Kick off round 1 review discussion and ask each leader for all required remediation items in one pass.",
          stanceHint: isRound2Merge ? "Focus on consolidation and merge readiness. Convert concerns into documented residual risks instead of new subtasks." : isFinalDecisionRound ? "Finalize approval decision and documentation package. Do not ask for new remediation subtasks." : "Capture every remediation requirement now so execution can proceed in parallel once.",
          lang,
        });
        const openingRun = await runAgentOneShot(planningLeader, openingPrompt, oneShotOptions);
        if (abortIfInactive()) return;
        speak(planningLeader, "chat", "all", null, chooseSafeReply(openingRun, lang, "opening", planningLeader));
        await sleepMs(randomDelay(720, 1300));
        if (abortIfInactive()) return;

        for (const leader of otherLeaders) {
          if (abortIfInactive()) return;
          const feedbackPrompt = buildMeetingPrompt(leader, {
            meetingType: "review", round, taskTitle, taskDescription, transcript,
            turnObjective: isRound2Merge ? "Validate merged remediation output and state whether it is ready for final-round sign-off." : isFinalDecisionRound ? "Provide final approval opinion with documentation-ready rationale." : "Provide concise review feedback and list all revision requirements that must be addressed in round 1.",
            stanceHint: isRound2Merge ? "Do not ask for a new remediation round; if concerns remain, describe residual risks for final documentation." : isFinalDecisionRound ? "No additional remediation is allowed in this final round. Choose final approve or approve-with-residual-risk." : "If revision is needed, explicitly state what must be fixed before approval.",
            lang,
          });
          const feedbackRun = await runAgentOneShot(leader, feedbackPrompt, oneShotOptions);
          if (abortIfInactive()) return;
          const feedbackText = chooseSafeReply(feedbackRun, lang, "feedback", leader);
          speak(leader, "chat", "agent", planningLeader.id, feedbackText);
          if (wantsReviewRevision(feedbackText)) { needsRevision = true; if (!reviseOwner) reviseOwner = leader; }
          await sleepMs(randomDelay(650, 1180));
          if (abortIfInactive()) return;
        }

        if (otherLeaders.length === 0) {
          if (abortIfInactive()) return;
          const soloPrompt = buildMeetingPrompt(planningLeader, {
            meetingType: "review", round, taskTitle, taskDescription, transcript,
            turnObjective: isRound2Merge ? "As the only reviewer, decide whether round 1 remediation is fully consolidated and merge-ready." : isFinalDecisionRound ? "As the only reviewer, publish the final approval conclusion and documentation note." : "As the only reviewer, provide your single-party review conclusion with complete remediation checklist.",
            stanceHint: isFinalDecisionRound ? "No further remediation round is allowed. Conclude with final decision and documented residual risks if any." : "Summarize risks, dependencies, and confidence level in one concise message.",
            lang,
          });
          const soloRun = await runAgentOneShot(planningLeader, soloPrompt, oneShotOptions);
          if (abortIfInactive()) return;
          speak(planningLeader, "chat", "all", null, chooseSafeReply(soloRun, lang, "feedback", planningLeader));
          await sleepMs(randomDelay(620, 980));
          if (abortIfInactive()) return;
        }

        await runReviewVotePhase(
          { taskId, taskTitle, round, roundMode, isRound1Remediation, isRound2Merge, isFinalDecisionRound, meetingId, leaders, planningLeader, transcript, lang, needsRevision, reviseOwner },
          { ...ctx, speak, abortIfInactive, oneShotOptions },
          onApproved,
        );
      } catch (err: any) {
        if (isTaskWorkflowInterrupted(taskId)) {
          if (meetingId) finishMeetingMinutes(meetingId, "failed");
          dismissLeadersFromCeoOffice(taskId, leaders);
          clearTaskWorkflowState(taskId);
          return;
        }
        const msg = err?.message ? String(err.message) : String(err);
        appendTaskLog(taskId, "error", `Review consensus meeting error: ${msg}`);
        const errLang = resolveLang(taskTitle);
        notifyCeo(pickL(l(
          [`[CEO OFFICE] '${taskTitle}' 리뷰 라운드 처리 중 오류가 발생했습니다: ${msg}`],
          [`[CEO OFFICE] Error while processing review round for '${taskTitle}': ${msg}`],
          [`[CEO OFFICE] '${taskTitle}' のレビューラウンド処理中にエラーが発生しました: ${msg}`],
          [`[CEO OFFICE] 处理'${taskTitle}'评审轮次时发生错误：${msg}`],
        ), errLang), taskId);
        if (meetingId) finishMeetingMinutes(meetingId, "failed");
        dismissLeadersFromCeoOffice(taskId, leaders);
        reviewInFlight.delete(taskId);
      }
    })();
  }

  return { startReviewConsensusMeeting };
}
