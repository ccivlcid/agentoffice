// @ts-nocheck

import { randomUUID } from "node:crypto";

type HandlerCtx = {
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
  openSupplementRound: (taskId: string, agentId: string | null, deptId: string | null, prefix?: string) => { started: boolean; reason: string };
  getProjectReviewTaskChoices: (projectId: string) => any[];
  getReviewDecisionNotes: (taskId: string, round: number, limit?: number) => string[];
  getReviewDecisionFallbackLabel: (lang: string) => string;
  getProjectReviewDecisionState: (id: string) => any;
  recordProjectReviewDecisionEvent: (input: any) => void;
  PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX: string;
  REVIEW_DECISION_RESOLVED_LOG_PREFIX: string;
};

export function handleProjectReviewReply(req: any, res: any, currentItem: any, selectedOption: any, optionNumber: number, ctx: HandlerCtx): void {
  const { db, nowMs, broadcast, appendTaskLog, normalizeTextField, resolveLang, l, pickL, openSupplementRound, getProjectReviewTaskChoices, getProjectReviewDecisionState, recordProjectReviewDecisionEvent, finishReview, PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX } = ctx;
  const projectId = currentItem.project_id;
  if (!projectId) { res.status(400).json({ error: "project_id_required" }); return; }
  const selectedAction = selectedOption.action;
  const decisionSnapshotHash = getProjectReviewDecisionState(projectId)?.snapshot_hash ?? null;

  if (selectedAction === "keep_waiting") {
    res.json({ ok: true, resolved: false, kind: "project_review_ready", action: "keep_waiting" }); return;
  }

  if (selectedAction.startsWith("approve_task_review:")) {
    const selectedTaskId = selectedAction.slice("approve_task_review:".length).trim();
    if (!selectedTaskId) { res.status(400).json({ error: "task_id_required" }); return; }
    const targetTask = db.prepare(`SELECT id, title FROM tasks WHERE id = ? AND project_id = ? AND status = 'review' AND source_task_id IS NULL`).get(selectedTaskId, projectId) as { id: string; title: string } | undefined;
    if (!targetTask) { res.status(404).json({ error: "project_review_task_not_found" }); return; }
    appendTaskLog(targetTask.id, "system", `${PROJECT_REVIEW_TASK_SELECTED_LOG_PREFIX} (project_id=${projectId}, option=${optionNumber})`);
    recordProjectReviewDecisionEvent({ project_id: projectId, snapshot_hash: decisionSnapshotHash, event_type: "representative_pick", summary: `대표 선택: ${targetTask.title}`, selected_options_json: JSON.stringify([{ number: optionNumber, action: selectedAction, label: selectedOption.label || targetTask.title, task_id: targetTask.id }]), task_id: targetTask.id });
    const remaining = getProjectReviewTaskChoices(projectId).filter((task) => !task.selected).length;
    res.json({ ok: true, resolved: false, kind: "project_review_ready", action: "approve_task_review", task_id: targetTask.id, pending_task_choices: remaining }); return;
  }

  if (selectedAction === "add_followup_request") {
    const note = normalizeTextField(req.body?.note);
    if (!note) { res.status(400).json({ error: "followup_note_required" }); return; }
    const lang = resolveLang(note);
    const followupTitlePrefix = pickL(l(["[의사결정 추가요청]"], ["[Decision Follow-up]"], ["[意思決定追加要請]"], ["[决策追加请求]"]), lang);
    const targetTaskIdInput = normalizeTextField(req.body?.target_task_id);
    const targetTask = targetTaskIdInput ? db.prepare(`SELECT id, title, status, assigned_agent_id, department_id FROM tasks WHERE id = ? AND project_id = ? AND status = 'review' AND source_task_id IS NULL`).get(targetTaskIdInput, projectId) as any | undefined : undefined;
    const fallbackTargetTask = db.prepare(`SELECT id, title, status, assigned_agent_id, department_id FROM tasks WHERE project_id = ? AND status = 'review' AND source_task_id IS NULL ORDER BY updated_at ASC, created_at ASC LIMIT 1`).get(projectId) as any | undefined;
    const resolvedTarget = targetTask ?? fallbackTargetTask;
    if (!resolvedTarget) { res.status(404).json({ error: "project_review_task_not_found" }); return; }
    const subtaskId = randomUUID();
    const createdAt = nowMs();
    const noteCompact = note.replace(/\s+/g, " ").trim();
    const noteTitle = noteCompact.length > 72 ? `${noteCompact.slice(0, 69).trimEnd()}...` : noteCompact;
    db.prepare(`INSERT INTO subtasks (id, task_id, title, description, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)`).run(subtaskId, resolvedTarget.id, `${followupTitlePrefix} ${noteTitle}`, note, createdAt);
    appendTaskLog(resolvedTarget.id, "system", `Decision inbox follow-up request added: ${note}`);
    recordProjectReviewDecisionEvent({ project_id: projectId, snapshot_hash: decisionSnapshotHash, event_type: "followup_request", summary: selectedOption.label || "추가요청 입력", selected_options_json: JSON.stringify([{ number: optionNumber, action: selectedAction, label: selectedOption.label || "add_followup_request", task_id: resolvedTarget.id }]), note, task_id: resolvedTarget.id });
    broadcast("subtask_update", db.prepare("SELECT * FROM subtasks WHERE id = ?").get(subtaskId));
    const supplement = openSupplementRound(resolvedTarget.id, resolvedTarget.assigned_agent_id, resolvedTarget.department_id, "Decision inbox");
    res.json({ ok: true, resolved: false, kind: "project_review_ready", action: "add_followup_request", task_id: resolvedTarget.id, subtask_id: subtaskId, supplement_round_started: supplement.started, supplement_round_reason: supplement.reason }); return;
  }

  if (selectedAction === "start_project_review") {
    const reviewTaskChoices = getProjectReviewTaskChoices(projectId);
    const requiresRepresentativeSelection = reviewTaskChoices.length > 1;
    const pendingChoices = requiresRepresentativeSelection ? reviewTaskChoices.filter((task) => !task.selected) : [];
    if (requiresRepresentativeSelection && pendingChoices.length > 0) { res.status(409).json({ error: "project_task_options_pending", pending_task_choices: pendingChoices.map((task) => ({ id: task.id, title: task.title })) }); return; }
    const readiness = db.prepare(`SELECT SUM(CASE WHEN status NOT IN ('done', 'cancelled') THEN 1 ELSE 0 END) AS active_total, SUM(CASE WHEN status NOT IN ('done', 'cancelled') AND status = 'review' THEN 1 ELSE 0 END) AS active_review FROM tasks WHERE project_id = ?`).get(projectId) as { active_total: number | null; active_review: number | null } | undefined;
    const activeTotal = readiness?.active_total ?? 0;
    const activeReview = readiness?.active_review ?? 0;
    if (!(activeTotal > 0 && activeTotal === activeReview)) { res.status(409).json({ error: "project_not_ready_for_review_meeting", active_total: activeTotal, active_review: activeReview }); return; }
    const reviewTasks = db.prepare(`SELECT id, title FROM tasks WHERE project_id = ? AND status = 'review' AND source_task_id IS NULL ORDER BY updated_at ASC`).all(projectId) as Array<{ id: string; title: string }>;
    for (const task of reviewTasks) {
      appendTaskLog(task.id, "system", "Decision inbox: project-level review meeting approved by CEO");
      finishReview(task.id, task.title, { bypassProjectDecisionGate: true, trigger: "decision_inbox" });
    }
    recordProjectReviewDecisionEvent({ project_id: projectId, snapshot_hash: decisionSnapshotHash, event_type: "start_review_meeting", summary: selectedOption.label || "팀장 회의 진행", selected_options_json: JSON.stringify([{ number: optionNumber, action: selectedAction, label: selectedOption.label || "start_project_review", task_count: reviewTasks.length }]) });
    res.json({ ok: true, resolved: true, kind: "project_review_ready", action: "start_project_review", started_task_ids: reviewTasks.map((task) => task.id) }); return;
  }

  res.status(400).json({ error: "unsupported_project_action", action: selectedAction });
}

export function handleReviewRoundReply(req: any, res: any, currentItem: any, selectedOption: any, optionNumber: number, ctx: HandlerCtx): void {
  const { db, nowMs, appendTaskLog, normalizeTextField, resolveLang, l, pickL, openSupplementRound, getReviewDecisionNotes, getReviewDecisionFallbackLabel, getProjectReviewDecisionState, recordProjectReviewDecisionEvent, seedReviewRevisionSubtasks, processSubtaskDelegations, scheduleNextReviewRound, REVIEW_DECISION_RESOLVED_LOG_PREFIX } = ctx;
  const taskId = currentItem.task_id;
  const meetingId = normalizeTextField((currentItem as { meeting_id?: string | null }).meeting_id);
  if (!taskId || !meetingId) { res.status(400).json({ error: "task_or_meeting_required" }); return; }

  const task = db.prepare(`SELECT id, title, status, project_id, department_id, assigned_agent_id, description FROM tasks WHERE id = ?`).get(taskId) as any | undefined;
  if (!task) { res.status(404).json({ error: "task_not_found" }); return; }
  if (task.status !== "review") { res.status(409).json({ error: "task_not_in_review", status: task.status }); return; }
  const meeting = db.prepare(`SELECT id, round, status FROM meeting_minutes WHERE id = ? AND task_id = ? AND meeting_type = 'review'`).get(meetingId, taskId) as { id: string; round: number; status: string } | undefined;
  if (!meeting) { res.status(404).json({ error: "meeting_not_found" }); return; }
  if (meeting.status !== "revision_requested") { res.status(409).json({ error: "meeting_not_pending", status: meeting.status }); return; }

  const reviewRound = Number.isFinite(meeting.round) ? Math.max(1, Math.trunc(meeting.round)) : 1;
  const lang = resolveLang(task.description ?? task.title);
  const resolvedProjectId = normalizeTextField(currentItem.project_id) ?? normalizeTextField(task.project_id);
  const decisionSnapshotHash = resolvedProjectId ? (getProjectReviewDecisionState(resolvedProjectId)?.snapshot_hash ?? null) : null;
  const notesRaw = getReviewDecisionNotes(taskId, reviewRound, 6);
  const notes = notesRaw.length > 0 ? notesRaw : [getReviewDecisionFallbackLabel(lang)];

  const skipNumber = notes.length + 1;
  const payloadNumbers = Array.isArray(req.body?.selected_option_numbers) ? req.body.selected_option_numbers : null;
  const selectedNumbers = (payloadNumbers !== null ? payloadNumbers : [optionNumber]).map((value: unknown) => Number(value)).filter((num: number) => Number.isFinite(num)).map((num: number) => Math.trunc(num));
  const dedupedSelected = Array.from(new Set(selectedNumbers));
  const extraNote = normalizeTextField(req.body?.note);

  if (dedupedSelected.includes(skipNumber)) {
    if (dedupedSelected.length > 1) { res.status(400).json({ error: "skip_option_must_be_alone" }); return; }
    if (extraNote) { res.status(400).json({ error: "skip_option_disallows_extra_note" }); return; }
    db.prepare("UPDATE meeting_minutes SET status = 'completed', completed_at = ? WHERE id = ?").run(nowMs(), meetingId);
    appendTaskLog(taskId, "system", `${REVIEW_DECISION_RESOLVED_LOG_PREFIX} (action=skip_to_next_round, round=${reviewRound}, meeting_id=${meetingId})`);
    if (resolvedProjectId) {
      const skipOptionLabel = currentItem.options.find((o) => o.number === skipNumber)?.label || selectedOption.label || "skip_to_next_round";
      recordProjectReviewDecisionEvent({ project_id: resolvedProjectId, snapshot_hash: decisionSnapshotHash, event_type: "representative_pick", summary: pickL(l([`리뷰 라운드 ${reviewRound} 의사결정: 다음 라운드로 SKIP`], [`Review round ${reviewRound} decision: skip to next round`], [`レビューラウンド${reviewRound}判断: 次ラウンドへスキップ`], [`评审第 ${reviewRound} 轮决策：跳到下一轮`]), lang), selected_options_json: JSON.stringify([{ number: skipNumber, action: "skip_to_next_round", label: skipOptionLabel, review_round: reviewRound }]), task_id: taskId, meeting_id: meetingId });
    }
    try {
      scheduleNextReviewRound(taskId, task.title, reviewRound, lang);
    } catch (err: any) {
      db.prepare("UPDATE meeting_minutes SET status = 'revision_requested', completed_at = NULL WHERE id = ?").run(meetingId);
      const msg = err?.message ? String(err.message) : String(err);
      appendTaskLog(taskId, "error", `Decision inbox skip rollback: next round scheduling failed (round=${reviewRound}, meeting_id=${meetingId}, reason=${msg})`);
      res.status(500).json({ error: "schedule_next_review_round_failed", message: msg }); return;
    }
    res.json({ ok: true, resolved: true, kind: "review_round_pick", action: "skip_to_next_round", task_id: taskId, review_round: reviewRound }); return;
  }

  const pickedNumbers = dedupedSelected.filter((num) => num >= 1 && num <= notes.length).sort((a, b) => a - b);
  const pickedNotes = pickedNumbers.map((num) => notes[num - 1]).filter(Boolean);
  const mergedNotes: string[] = [];
  const seen = new Set<string>();
  for (const note of pickedNotes) {
    const cleaned = String(note || "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mergedNotes.push(cleaned);
  }
  if (extraNote) { const key = extraNote.toLowerCase(); if (!seen.has(key)) { seen.add(key); mergedNotes.push(extraNote); } }
  if (mergedNotes.length <= 0) { res.status(400).json({ error: "review_pick_or_note_required" }); return; }

  const subtaskCount = seedReviewRevisionSubtasks(taskId, task.department_id, mergedNotes);
  processSubtaskDelegations(taskId);
  db.prepare("UPDATE meeting_minutes SET status = 'completed', completed_at = ? WHERE id = ?").run(nowMs(), meetingId);
  appendTaskLog(taskId, "system", `${REVIEW_DECISION_RESOLVED_LOG_PREFIX} (action=apply_review_pick, round=${reviewRound}, picks=${pickedNumbers.join(",") || "-"}, extra_note=${extraNote ? "yes" : "no"}, meeting_id=${meetingId}, subtasks=${subtaskCount})`);
  if (resolvedProjectId) {
    const pickedPayload = pickedNumbers.map((num) => ({ number: num, action: "apply_review_pick", label: notes[num - 1] || `option_${num}`, review_round: reviewRound }));
    recordProjectReviewDecisionEvent({ project_id: resolvedProjectId, snapshot_hash: decisionSnapshotHash, event_type: "representative_pick", summary: pickL(l([`리뷰 라운드 ${reviewRound} 의사결정: 보완 항목 선택 ${pickedNumbers.length}건`], [`Review round ${reviewRound} decision: ${pickedNumbers.length} remediation pick(s)`], [`レビューラウンド${reviewRound}判断: 補完項目 ${pickedNumbers.length} 件を選択`], [`评审第 ${reviewRound} 轮决策：已选择 ${pickedNumbers.length} 项补充整改`]), lang), selected_options_json: pickedPayload.length > 0 ? JSON.stringify(pickedPayload) : null, note: extraNote ?? null, task_id: taskId, meeting_id: meetingId });
  }
  const supplement = openSupplementRound(taskId, task.assigned_agent_id, task.department_id, `Decision inbox round${reviewRound}`);
  res.json({ ok: true, resolved: true, kind: "review_round_pick", action: "apply_review_pick", task_id: taskId, selected_option_numbers: pickedNumbers, review_round: reviewRound, revision_subtask_count: subtaskCount, supplement_round_started: supplement.started, supplement_round_reason: supplement.reason });
}

export function handleTimeoutResumeReply(res: any, currentItem: any, selectedOption: any, ctx: HandlerCtx): void {
  const { db, nowMs, appendTaskLog, activeProcesses, startTaskExecutionForAgent, getDeptName } = ctx;
  type AgentRow = any;
  const taskId = currentItem.task_id;
  if (!taskId) { res.status(400).json({ error: "task_id_required" }); return; }
  const selectedAction = selectedOption.action;
  if (selectedAction === "keep_inbox") { res.json({ ok: true, resolved: false, kind: "task_timeout_resume", action: "keep_inbox" }); return; }
  if (selectedAction !== "resume_timeout_task") { res.status(400).json({ error: "unsupported_timeout_action", action: selectedAction }); return; }
  const task = db.prepare(`SELECT id, title, description, status, assigned_agent_id, department_id FROM tasks WHERE id = ?`).get(taskId) as any | undefined;
  if (!task) { res.status(404).json({ error: "task_not_found" }); return; }
  if (task.status !== "inbox") { res.status(409).json({ error: "task_not_in_inbox", status: task.status }); return; }
  if (!task.assigned_agent_id) { res.status(409).json({ error: "task_has_no_assigned_agent" }); return; }
  const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(task.assigned_agent_id) as AgentRow | undefined;
  if (!agent) { res.status(404).json({ error: "agent_not_found" }); return; }
  if (activeProcesses.has(taskId)) { res.status(409).json({ error: "already_running" }); return; }
  if (agent.status === "working" && agent.current_task_id && agent.current_task_id !== taskId && activeProcesses.has(agent.current_task_id)) { res.status(409).json({ error: "agent_busy", current_task_id: agent.current_task_id }); return; }
  const deptId = agent.department_id ?? task.department_id ?? null;
  const deptName = deptId ? getDeptName(deptId) : "Unassigned";
  appendTaskLog(taskId, "system", "Decision inbox: timeout resume approved by CEO");
  startTaskExecutionForAgent(taskId, agent, deptId, deptName);
  res.json({ ok: true, resolved: true, kind: "task_timeout_resume", action: "resume_timeout_task", task_id: taskId });
}
