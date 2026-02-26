// @ts-nocheck

import { randomUUID } from "node:crypto";
import type { Lang } from "../../../types/lang.ts";
import type { AgentRow } from "./agent-types.ts";
import { l, pickL, getRoleLabel } from "./agent-types.ts";
import type { DelegationOptions } from "./directive-policy.ts";
import { normalizeTextField, buildRoundGoal } from "./directive-policy.ts";

export function initializeTaskDelegation(deps: {
  db: any; nowMs: () => number; broadcast: any;
  resolveLang: (text?: string, fallback?: Lang) => Lang;
  getDeptName: (deptId: string) => string;
  findTeamLeader: (deptId: string | null) => AgentRow | null;
  findBestSubordinate: (deptId: string, excludeId: string) => AgentRow | null;
  detectTargetDepartments: (message: string) => string[];
  sendAgentMessage: any; notifyCeo: any; appendTaskLog: any; recordTaskCreationAudit: any;
  isTaskWorkflowInterrupted: (taskId: string) => boolean;
  hasOpenForeignSubtasks: (taskId: string, targetDeptIds?: string[]) => boolean;
  processSubtaskDelegations: (taskId: string) => void;
  startCrossDeptCooperation: any; startPlannedApprovalMeeting: any;
  seedApprovedPlanSubtasks: any; startTaskExecutionForAgent: any;
  resolveProjectFromOptions: any; resolveDirectiveProjectPath: any;
}) {
  const {
    db, nowMs, broadcast, resolveLang, getDeptName, findTeamLeader, findBestSubordinate,
    detectTargetDepartments, sendAgentMessage, notifyCeo, appendTaskLog, recordTaskCreationAudit,
    isTaskWorkflowInterrupted, hasOpenForeignSubtasks, processSubtaskDelegations,
    startCrossDeptCooperation, startPlannedApprovalMeeting, seedApprovedPlanSubtasks,
    startTaskExecutionForAgent, resolveProjectFromOptions, resolveDirectiveProjectPath,
  } = deps;

  function handleMentionDelegation(originLeader: AgentRow, targetDeptId: string, ceoMessage: string, lang: Lang): void {
    const crossLeader = findTeamLeader(targetDeptId);
    if (!crossLeader) return;
    const crossDeptName = getDeptName(targetDeptId);
    const crossLeaderName = lang === "ko" ? (crossLeader.name_ko || crossLeader.name) : crossLeader.name;
    const taskTitle = ceoMessage.length > 60 ? ceoMessage.slice(0, 57) + "..." : ceoMessage;
    sendAgentMessage(originLeader, pickL(l(
      [`${crossLeaderName}님! 대표님 지시입니다: "${taskTitle}" — ${crossDeptName}에서 처리 부탁드립니다! 🏷️`],
      [`${crossLeaderName}! CEO directive for ${crossDeptName}: "${taskTitle}" — please handle this! 🏷️`],
      [`${crossLeaderName}さん！CEO指示です："${taskTitle}" — ${crossDeptName}で対応お願いします！🏷️`],
      [`${crossLeaderName}，CEO指示："${taskTitle}" — 请${crossDeptName}处理！🏷️`],
    ), lang), "task_assign", "agent", crossLeader.id, null);
    broadcast("cross_dept_delivery", { from_agent_id: originLeader.id, to_agent_id: crossLeader.id, task_title: taskTitle });
    setTimeout(() => { handleTaskDelegation(crossLeader, ceoMessage, ""); }, 1500 + Math.random() * 1000);
  }

  function handleTaskDelegation(
    teamLeader: AgentRow, ceoMessage: string, ceoMsgId: string, options: DelegationOptions = {},
  ): void {
    const lang = resolveLang(ceoMessage);
    const leaderName = lang === "ko" ? (teamLeader.name_ko || teamLeader.name) : teamLeader.name;
    const leaderDeptId = teamLeader.department_id!;
    const leaderDeptName = getDeptName(leaderDeptId);
    const skipPlannedMeeting = !!options.skipPlannedMeeting;
    const skipPlanSubtasks = !!options.skipPlanSubtasks;

    setTimeout(() => {
      // Manual mode: restrict candidates to project_agents pool
      let candidateAgentIds: string[] | null = null;
      const selectedProject = resolveProjectFromOptions(options);
      if (selectedProject?.id) {
        const proj = db.prepare("SELECT assignment_mode FROM projects WHERE id = ?").get(selectedProject.id) as { assignment_mode: string } | undefined;
        if (proj?.assignment_mode === "manual") {
          const assigned = db.prepare(
            "SELECT agent_id FROM project_agents WHERE project_id = ?"
          ).all(selectedProject.id) as { agent_id: string }[];
          candidateAgentIds = assigned.map(r => r.agent_id);
        }
      }

      let subordinate: AgentRow | null;
      if (candidateAgentIds) {
        // Filter to candidates in leader's dept, excluding leader
        const deptCandidates = candidateAgentIds.filter(id => id !== teamLeader.id);
        if (deptCandidates.length > 0) {
          const placeholders = deptCandidates.map(() => "?").join(",");
          subordinate = db.prepare(`
            SELECT * FROM agents
            WHERE id IN (${placeholders}) AND department_id = ? AND role != 'team_leader'
            ORDER BY
              CASE status WHEN 'idle' THEN 0 WHEN 'break' THEN 1 WHEN 'working' THEN 2 ELSE 3 END,
              CASE role WHEN 'senior' THEN 0 WHEN 'junior' THEN 1 WHEN 'intern' THEN 2 ELSE 3 END
            LIMIT 1
          `).get(...deptCandidates, leaderDeptId) as AgentRow | null;
        } else {
          subordinate = null;
        }
        // No fallback to entire dept for manual mode
        if (!subordinate) {
          console.log(`[delegation:manual] No eligible subordinate in dept=${leaderDeptId} for project=${selectedProject?.id}. Candidates: [${deptCandidates.join(',')}]. Leader ${teamLeader.id} will execute directly.`);
        }
      } else {
        subordinate = findBestSubordinate(leaderDeptId, teamLeader.id);
      }
      const taskId = randomUUID();
      const t = nowMs();
      const taskTitle = ceoMessage.length > 60 ? ceoMessage.slice(0, 57) + "..." : ceoMessage;
      // selectedProject already resolved above for manual mode check
      const projectContextHint = normalizeTextField(options.projectContext) || selectedProject.coreGoal;
      const roundGoal = buildRoundGoal(selectedProject.coreGoal, ceoMessage);
      const { projectPath: detectedPathRaw } = resolveDirectiveProjectPath(ceoMessage, {
        ...options, projectPath: options.projectPath ?? selectedProject.projectPath, projectContext: projectContextHint,
      });
      const detectedPath = detectedPathRaw || selectedProject.projectPath || null;
      const taskDescriptionLines = [`[CEO] ${ceoMessage}`];
      if (selectedProject.name) taskDescriptionLines.push(`[PROJECT] ${selectedProject.name}`);
      if (selectedProject.coreGoal) taskDescriptionLines.push(`[PROJECT CORE GOAL] ${selectedProject.coreGoal}`);
      taskDescriptionLines.push(`[ROUND GOAL] ${roundGoal}`);
      if (projectContextHint && projectContextHint !== selectedProject.coreGoal) {
        taskDescriptionLines.push(`[PROJECT CONTEXT] ${projectContextHint}`);
      }
      db.prepare(`
        INSERT INTO tasks (id, title, description, department_id, project_id, status, priority, task_type, project_path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'planned', 1, 'general', ?, ?, ?)
      `).run(taskId, taskTitle, taskDescriptionLines.join("\n"), leaderDeptId, selectedProject.id, detectedPath, t, t);
      recordTaskCreationAudit({
        taskId, taskTitle, taskStatus: "planned", departmentId: leaderDeptId, taskType: "general",
        projectPath: detectedPath ?? null, trigger: "workflow.delegation.ceo_message",
        triggerDetail: `skip_planned_meeting=${skipPlannedMeeting}; skip_plan_subtasks=${skipPlanSubtasks}`,
        actorType: "agent", actorId: teamLeader.id, actorName: teamLeader.name,
        body: { ceo_message: ceoMessage, options: { skip_planned_meeting: skipPlannedMeeting, skip_plan_subtasks: skipPlanSubtasks, project_id: selectedProject.id, project_context: projectContextHint, round_goal: roundGoal } },
      });
      if (selectedProject.id) db.prepare("UPDATE projects SET last_used_at = ?, updated_at = ? WHERE id = ?").run(t, t, selectedProject.id);
      appendTaskLog(taskId, "system", `CEO → ${leaderName}: ${ceoMessage}`);
      if (selectedProject.id) appendTaskLog(taskId, "system", `Project linked: ${selectedProject.name || selectedProject.id}`);
      appendTaskLog(taskId, "system", `Round goal: ${roundGoal}`);
      if (detectedPath) appendTaskLog(taskId, "system", `Project path resolved: ${detectedPath}`);
      if (projectContextHint) appendTaskLog(taskId, "system", `Project context hint: ${projectContextHint}`);
      broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));

      const mentionedDepts = [...new Set(detectTargetDepartments(ceoMessage).filter((d) => d !== leaderDeptId))];
      const isPlanningLead = leaderDeptId === "planning";

      if (isPlanningLead) {
        const relatedLabel = mentionedDepts.length > 0 ? mentionedDepts.map(getDeptName).join(", ") : pickL(l(["없음"], ["None"], ["なし"], ["无"]), lang);
        appendTaskLog(taskId, "system", `Planning pre-check related departments: ${relatedLabel}`);
        notifyCeo(pickL(l(
          [`[기획팀] '${taskTitle}' 유관부서 사전 파악 완료: ${relatedLabel}`],
          [`[Planning] Related departments identified for '${taskTitle}': ${relatedLabel}`],
          [`[企画] '${taskTitle}' の関連部門の事前把握が完了: ${relatedLabel}`],
          [`[企划] 已完成'${taskTitle}'相关部门预识别：${relatedLabel}`],
        ), lang), taskId);
      }

      const runCrossDeptBeforeDelegationIfNeeded = (next: () => void) => {
        if (isTaskWorkflowInterrupted(taskId)) return;
        if (!(isPlanningLead && mentionedDepts.length > 0)) { next(); return; }
        const crossDeptNames = mentionedDepts.map(getDeptName).join(", ");
        if (hasOpenForeignSubtasks(taskId, mentionedDepts)) {
          notifyCeo(pickL(l(
            [`[CEO OFFICE] 기획팀 선행 협업을 서브태스크 통합 디스패처로 실행합니다: ${crossDeptNames}`],
            [`[CEO OFFICE] Running planning pre-collaboration via unified subtask dispatcher: ${crossDeptNames}`],
            [`[CEO OFFICE] 企画先行協業を統合サブタスクディスパッチャで実行します: ${crossDeptNames}`],
            [`[CEO OFFICE] 企划前置协作改为统一 SubTask 调度执行：${crossDeptNames}`],
          ), lang), taskId);
          appendTaskLog(taskId, "system", `Planning pre-collaboration unified to batched subtask dispatch (${crossDeptNames})`);
          processSubtaskDelegations(taskId);
          next();
          return;
        }
        notifyCeo(pickL(l(
          [`[CEO OFFICE] 기획팀 선행 협업 처리 시작: ${crossDeptNames}`],
          [`[CEO OFFICE] Planning pre-collaboration started with: ${crossDeptNames}`],
          [`[CEO OFFICE] 企画チームの先行協業を開始: ${crossDeptNames}`],
          [`[CEO OFFICE] 企划团队前置协作已启动：${crossDeptNames}`],
        ), lang), taskId);
        db.prepare("UPDATE tasks SET status = 'collaborating', updated_at = ? WHERE id = ?").run(nowMs(), taskId);
        broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
        startCrossDeptCooperation(mentionedDepts, 0,
          { teamLeader, taskTitle, ceoMessage, leaderDeptId, leaderDeptName, leaderName, lang, taskId },
          () => {
            if (isTaskWorkflowInterrupted(taskId)) return;
            notifyCeo(pickL(l(
              ["[CEO OFFICE] 유관부서 선행 처리 완료. 이제 내부 업무 하달을 시작합니다."],
              ["[CEO OFFICE] Related-department pre-processing complete. Starting internal delegation now."],
              ["[CEO OFFICE] 関連部門の先行処理が完了。これより内部委任を開始します。"],
              ["[CEO OFFICE] 相关部门前置处理完成，现开始内部下达。"],
            ), lang), taskId);
            next();
          },
        );
      };

      const runCrossDeptAfterMainIfNeeded = () => {
        if (isPlanningLead || mentionedDepts.length === 0) return;
        setTimeout(() => {
          if (isTaskWorkflowInterrupted(taskId)) return;
          if (hasOpenForeignSubtasks(taskId, mentionedDepts)) {
            appendTaskLog(taskId, "system", `Cross-dept collaboration unified to batched subtask dispatch (${mentionedDepts.map(getDeptName).join(", ")})`);
            processSubtaskDelegations(taskId);
            return;
          }
          const currentTask = db.prepare("SELECT status FROM tasks WHERE id = ?").get(taskId) as { status: string } | undefined;
          if (currentTask && currentTask.status !== 'in_progress') {
            db.prepare("UPDATE tasks SET status = 'collaborating', updated_at = ? WHERE id = ?").run(nowMs(), taskId);
            broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
          }
          startCrossDeptCooperation(mentionedDepts, 0, { teamLeader, taskTitle, ceoMessage, leaderDeptId, leaderDeptName, leaderName, lang, taskId });
        }, 3000 + Math.random() * 1000);
      };

      const runPlanningPhase = (afterPlan: () => void) => {
        if (isTaskWorkflowInterrupted(taskId)) return;
        if (skipPlannedMeeting) {
          appendTaskLog(taskId, "system", "Planned meeting skipped by CEO directive");
          if (!skipPlanSubtasks) seedApprovedPlanSubtasks(taskId, leaderDeptId, []);
          runCrossDeptBeforeDelegationIfNeeded(afterPlan);
          return;
        }
        startPlannedApprovalMeeting(taskId, taskTitle, leaderDeptId, (planningNotes) => {
          if (isTaskWorkflowInterrupted(taskId)) return;
          if (!skipPlanSubtasks) seedApprovedPlanSubtasks(taskId, leaderDeptId, planningNotes ?? []);
          runCrossDeptBeforeDelegationIfNeeded(afterPlan);
        });
      };

      if (subordinate) {
        const subName = lang === "ko" ? (subordinate.name_ko || subordinate.name) : subordinate.name;
        const subRole = getRoleLabel(subordinate.role, lang);
        const crossDeptNames = mentionedDepts.length > 0 ? mentionedDepts.map(getDeptName).join(", ") : "";
        let ackMsg: string;
        if (skipPlannedMeeting && isPlanningLead && crossDeptNames) {
          ackMsg = pickL(l(
            [`네, 대표님! 팀장 계획 회의는 생략하고 ${crossDeptNames} 유관부서 사전 조율 후 ${subRole} ${subName}에게 즉시 하달하겠습니다. 📋`],
            [`Understood. We'll skip the leaders' planning meeting, coordinate quickly with ${crossDeptNames}, then delegate immediately to ${subRole} ${subName}. 📋`],
            [`了解しました。リーダー計画会議は省略し、${crossDeptNames} と事前調整後に ${subRole} ${subName} へ即時委任します。📋`],
            [`收到。将跳过负责人规划会议，先与${crossDeptNames}快速协同后立即下达给${subRole} ${subName}。📋`],
          ), lang);
        } else if (skipPlannedMeeting && crossDeptNames) {
          ackMsg = pickL(l(
            [`네, 대표님! 팀장 계획 회의 없이 바로 ${subRole} ${subName}에게 하달하고 ${crossDeptNames} 협업을 병행하겠습니다. 📋`],
            [`Understood. We'll skip the planning meeting, delegate directly to ${subRole} ${subName}, and coordinate with ${crossDeptNames} in parallel. 📋`],
            [`了解しました。計画会議なしで ${subRole} ${subName} へ直ちに委任し、${crossDeptNames} との協業を並行します。📋`],
            [`收到。跳过规划会议，直接下达给${subRole} ${subName}，并并行推进${crossDeptNames}协作。📋`],
          ), lang);
        } else if (skipPlannedMeeting) {
          ackMsg = pickL(l(
            [`네, 대표님! 팀장 계획 회의는 생략하고 ${subRole} ${subName}에게 즉시 하달하겠습니다. 📋`],
            [`Understood. We'll skip the leaders' planning meeting and delegate immediately to ${subRole} ${subName}. 📋`],
            [`了解しました。リーダー計画会議は省略し、${subRole} ${subName} へ即時委任します。📋`],
            [`收到。将跳过负责人规划会议，立即下达给${subRole} ${subName}。📋`],
          ), lang);
        } else if (isPlanningLead && crossDeptNames) {
          ackMsg = pickL(l(
            [`네, 대표님! 먼저 ${crossDeptNames} 유관부서 목록을 확정하고 회의/선행 협업을 완료한 뒤 ${subRole} ${subName}에게 하달하겠습니다. 📋`],
            [`Understood. I'll first confirm related departments (${crossDeptNames}), finish cross-team pre-processing, then delegate to ${subRole} ${subName}. 📋`],
            [`了解しました。まず関連部門（${crossDeptNames}）を確定し、先行協業完了後に${subRole} ${subName}へ委任します。📋`],
            [`收到。先确认相关部门（${crossDeptNames}）并完成前置协作后，再下达给${subRole} ${subName}。📋`],
          ), lang);
        } else if (crossDeptNames) {
          ackMsg = pickL(l(
            [`네, 대표님! 먼저 팀장 계획 회의를 진행한 뒤 ${subRole} ${subName}에게 하달하고, ${crossDeptNames} 협업도 연계하겠습니다. 📋`],
            [`Understood. We'll run the team-lead planning meeting first, then delegate to ${subRole} ${subName} and coordinate with ${crossDeptNames}. 📋`],
            [`了解しました。まずチームリーダー計画会議を行い、その後 ${subRole} ${subName} へ委任し、${crossDeptNames} との協業も調整します。📋`],
            [`收到。先进行团队负责人规划会议，再下达给${subRole} ${subName}，并协调${crossDeptNames}协作。📋`],
          ), lang);
        } else {
          ackMsg = pickL(l(
            [`네, 대표님! 먼저 팀장 계획 회의를 소집하고, 회의 결과 정리 후 ${subRole} ${subName}에게 하달하겠습니다. 📋`],
            [`Understood. I'll convene the team-lead planning meeting first, then assign to ${subRole} ${subName} after the planning output is finalized. 📋`],
            [`了解しました。まずチームリーダー計画会議を招集し、会議結果整理後に ${subRole} ${subName} へ委任します。📋`],
            [`收到。先召集团队负责人规划会议，整理结论后再分配给${subRole} ${subName}。📋`],
          ), lang);
        }
        sendAgentMessage(teamLeader, ackMsg, "chat", "agent", null, taskId);

        const delegateToSubordinate = () => {
          setTimeout(() => {
            if (isTaskWorkflowInterrupted(taskId)) return;
            const t2 = nowMs();
            db.prepare("UPDATE tasks SET assigned_agent_id = ?, status = 'planned', updated_at = ? WHERE id = ?").run(subordinate.id, t2, taskId);
            db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(taskId, subordinate.id);
            appendTaskLog(taskId, "system", `${leaderName} → ${subName}`);
            broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
            broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(subordinate.id));
            const delegateMsg = pickL(l(
              [`${subName}, 대표님 지시사항이야. "${ceoMessage}" — 확인하고 진행해줘!`],
              [`${subName}, directive from the CEO: "${ceoMessage}" — please handle this!`],
              [`${subName}、CEOからの指示だよ。"${ceoMessage}" — 確認して進めて！`],
              [`${subName}，CEO的指示："${ceoMessage}" — 请跟进处理！`],
            ), lang);
            sendAgentMessage(teamLeader, delegateMsg, "task_assign", "agent", subordinate.id, taskId);
            setTimeout(() => {
              if (isTaskWorkflowInterrupted(taskId)) return;
              const leaderRole = getRoleLabel(teamLeader.role, lang);
              const subAckMsg = pickL(l(
                [`네, ${leaderRole} ${leaderName}님! 확인했습니다. 바로 착수하겠습니다! 💪`],
                [`Yes, ${leaderName}! Confirmed. Starting right away! 💪`],
                [`はい、${leaderName}さん！了解しました。すぐ取りかかります！💪`],
                [`好的，${leaderName}！收到，马上开始！💪`],
              ), lang);
              sendAgentMessage(subordinate, subAckMsg, "chat", "agent", null, taskId);
              startTaskExecutionForAgent(taskId, subordinate, leaderDeptId, leaderDeptName);
              runCrossDeptAfterMainIfNeeded();
            }, 1000 + Math.random() * 1000);
          }, 2000 + Math.random() * 1000);
        };

        runPlanningPhase(delegateToSubordinate);
      } else {
        const selfMsg = skipPlannedMeeting
          ? pickL(l(
            [`네, 대표님! 팀장 계획 회의는 생략하고 팀 내 가용 인력이 없어 제가 즉시 직접 처리하겠습니다. 💪`],
            [`Understood. We'll skip the leaders' planning meeting and I'll execute this directly right away since no assignee is available. 💪`],
            [`了解しました。リーダー計画会議は省略し、空き要員がいないため私が即時対応します。💪`],
            [`收到。将跳过负责人规划会议，因无可用成员由我立即亲自处理。💪`],
          ), lang)
          : pickL(l(
            [`네, 대표님! 먼저 팀장 계획 회의를 진행하고, 팀 내 가용 인력이 없어 회의 정리 후 제가 직접 처리하겠습니다. 💪`],
            [`Understood. We'll complete the team-lead planning meeting first, and since no one is available I'll execute it myself after the plan is organized. 💪`],
            [`了解しました。まずチームリーダー計画会議を行い、空き要員がいないため会議整理後は私が直接対応します。💪`],
            [`收到。先进行团队负责人规划会议，因无可用成员，会议整理后由我亲自执行。💪`],
          ), lang);
        sendAgentMessage(teamLeader, selfMsg, "chat", "agent", null, taskId);
        const t2 = nowMs();
        db.prepare("UPDATE tasks SET assigned_agent_id = ?, status = 'planned', updated_at = ? WHERE id = ?").run(teamLeader.id, t2, taskId);
        db.prepare("UPDATE agents SET current_task_id = ? WHERE id = ?").run(taskId, teamLeader.id);
        appendTaskLog(taskId, "system", `${leaderName} self-assigned (planned)`);
        broadcast("task_update", db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId));
        broadcast("agent_status", db.prepare("SELECT * FROM agents WHERE id = ?").get(teamLeader.id));
        runPlanningPhase(() => {
          if (isTaskWorkflowInterrupted(taskId)) return;
          startTaskExecutionForAgent(taskId, teamLeader, leaderDeptId, leaderDeptName);
          runCrossDeptAfterMainIfNeeded();
        });
      }
    }, 1000 + Math.random() * 1000);
  }

  return { handleMentionDelegation, handleTaskDelegation };
}
