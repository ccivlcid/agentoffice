// @ts-nocheck

import type { Lang } from "../../../types/lang.ts";
import type { AgentRow } from "./agent-types.ts";
import { l, pickL, DEPT_KEYWORDS } from "./agent-types.ts";

// ---------------------------------------------------------------------------
// Department detection, mention parsing, subtask types & progress helpers
// ---------------------------------------------------------------------------

export const REMEDIATION_SUBTASK_PREFIXES = [
  "[보완계획]", "[검토보완]", "[Plan Item]", "[Review Revision]",
  "[補完計画]", "[レビュー補완]", "[计划项]", "[评审整改]",
];

export const COLLABORATION_SUBTASK_PREFIXES = [
  "[협업]", "[Collaboration]", "[協業]", "[协作]",
];

export interface SubtaskRow {
  id: string; task_id: string; title: string; description: string | null;
  status: string; created_at: number; target_department_id: string | null;
  delegated_task_id: string | null; blocked_reason: string | null;
}

export interface TaskSubtaskProgressSummary {
  total: number; done: number; remediationTotal: number; remediationDone: number;
  collaborationTotal: number; collaborationDone: number;
}

export function hasAnyPrefix(title: string, prefixes: string[]): boolean {
  const trimmed = title.trim();
  return prefixes.some((prefix) => trimmed.startsWith(prefix));
}

export function initializeDelegationHelpers(deps: {
  db: any;
  getPreferredLanguage: () => Lang;
  resolveLang: (text?: string, fallback?: Lang) => Lang;
  notifyCeo: any;
  appendTaskLog: any;
  finishReview: any;
}) {
  const { db, getPreferredLanguage, resolveLang, notifyCeo, appendTaskLog, finishReview } = deps;

  function getDeptName(deptId: string): string {
    const lang = getPreferredLanguage();
    const d = db.prepare("SELECT name, name_ko FROM departments WHERE id = ?").get(deptId) as {
      name: string;
      name_ko: string;
    } | undefined;
    if (!d) return deptId;
    return lang === "ko" ? (d.name_ko || d.name) : (d.name || d.name_ko || deptId);
  }

  function getDeptRoleConstraint(deptId: string, deptName: string): string {
    const constraints: Record<string, string> = {
      planning: `IMPORTANT ROLE CONSTRAINT: You belong to ${deptName} (Planning). Focus ONLY on planning, strategy, market analysis, requirements, and documentation. Do NOT write production code, create design assets, or run tests. If coding/design is needed, describe requirements and specifications instead.`,
      dev: `IMPORTANT ROLE CONSTRAINT: You belong to ${deptName} (Development). Focus ONLY on coding, debugging, code review, and technical implementation. Do NOT create design mockups, write business strategy documents, or perform QA testing.`,
      design: `IMPORTANT ROLE CONSTRAINT: You belong to ${deptName} (Design). Focus ONLY on UI/UX design, visual assets, design specs, and prototyping. Do NOT write production backend code, run tests, or make infrastructure changes.`,
      qa: `IMPORTANT ROLE CONSTRAINT: You belong to ${deptName} (QA/QC). Focus ONLY on testing, quality assurance, test automation, and bug reporting. Do NOT write production code or create design assets.`,
      devsecops: `IMPORTANT ROLE CONSTRAINT: You belong to ${deptName} (DevSecOps). Focus ONLY on infrastructure, security audits, CI/CD pipelines, container orchestration, and deployment. Do NOT write business logic or create design assets.`,
      operations: `IMPORTANT ROLE CONSTRAINT: You belong to ${deptName} (Operations). Focus ONLY on operations, automation, monitoring, maintenance, and process optimization. Do NOT write production code or create design assets.`,
    };
    return constraints[deptId] || `IMPORTANT ROLE CONSTRAINT: You belong to ${deptName}. Focus on tasks within your department's expertise.`;
  }

  function findTeamLeader(deptId: string | null): AgentRow | null {
    if (!deptId) return null;
    return (db.prepare(
      "SELECT * FROM agents WHERE department_id = ? AND role = 'team_leader' LIMIT 1"
    ).get(deptId) as AgentRow | undefined) ?? null;
  }

  function findBestSubordinate(deptId: string, excludeId: string): AgentRow | null {
    const agents = db.prepare(
      `SELECT * FROM agents WHERE department_id = ? AND id != ? AND role != 'team_leader' ORDER BY
         CASE status WHEN 'idle' THEN 0 WHEN 'break' THEN 1 WHEN 'working' THEN 2 ELSE 3 END,
         CASE role WHEN 'senior' THEN 0 WHEN 'junior' THEN 1 WHEN 'intern' THEN 2 ELSE 3 END`
    ).all(deptId, excludeId) as unknown as AgentRow[];
    return agents[0] ?? null;
  }

  function detectTargetDepartments(message: string): string[] {
    const found: string[] = [];
    for (const [deptId, keywords] of Object.entries(DEPT_KEYWORDS)) {
      for (const kw of keywords) {
        if (message.includes(kw)) { found.push(deptId); break; }
      }
    }
    return found;
  }

  function detectMentions(message: string): { deptIds: string[]; agentIds: string[] } {
    const deptIds: string[] = [];
    const agentIds: string[] = [];

    const depts = db.prepare("SELECT id, name, name_ko FROM departments").all() as { id: string; name: string; name_ko: string }[];
    for (const dept of depts) {
      const nameKo = dept.name_ko.replace("팀", "");
      if (
        message.includes(`@${dept.name_ko}`) ||
        message.includes(`@${nameKo}`) ||
        message.includes(`@${dept.name}`) ||
        message.includes(`@${dept.id}`)
      ) {
        deptIds.push(dept.id);
      }
    }

    const agents = db.prepare("SELECT id, name, name_ko FROM agents").all() as { id: string; name: string; name_ko: string | null }[];
    for (const agent of agents) {
      if (
        (agent.name_ko && message.includes(`@${agent.name_ko}`)) ||
        message.includes(`@${agent.name}`)
      ) {
        agentIds.push(agent.id);
      }
    }

    return { deptIds, agentIds };
  }

  function getTaskSubtaskProgressSummary(taskId: string): TaskSubtaskProgressSummary {
    const rows = db.prepare(
      "SELECT title, status FROM subtasks WHERE task_id = ?"
    ).all(taskId) as Array<{ title: string; status: string }>;

    const summary: TaskSubtaskProgressSummary = {
      total: rows.length, done: 0,
      remediationTotal: 0, remediationDone: 0,
      collaborationTotal: 0, collaborationDone: 0,
    };

    for (const row of rows) {
      const isDone = row.status === "done";
      if (isDone) summary.done += 1;

      const isRemediation = hasAnyPrefix(row.title, REMEDIATION_SUBTASK_PREFIXES);
      if (isRemediation) {
        summary.remediationTotal += 1;
        if (isDone) summary.remediationDone += 1;
      }

      const isCollaboration = hasAnyPrefix(row.title, COLLABORATION_SUBTASK_PREFIXES);
      if (isCollaboration) {
        summary.collaborationTotal += 1;
        if (isDone) summary.collaborationDone += 1;
      }
    }

    return summary;
  }

  function formatTaskSubtaskProgressSummary(taskId: string, lang: Lang): string {
    const s = getTaskSubtaskProgressSummary(taskId);
    if (s.total === 0) return "";

    const lines = pickL(l(
      [
        `- 전체: ${s.done}/${s.total} 완료`,
        `- 보완사항: ${s.remediationDone}/${s.remediationTotal} 완료`,
        `- 협업사항: ${s.collaborationDone}/${s.collaborationTotal} 완료`,
      ],
      [
        `- Overall: ${s.done}/${s.total} done`,
        `- Remediation: ${s.remediationDone}/${s.remediationTotal} done`,
        `- Collaboration: ${s.collaborationDone}/${s.collaborationTotal} done`,
      ],
      [
        `- 全体: ${s.done}/${s.total} 完了`,
        `- 補完事項: ${s.remediationDone}/${s.remediationTotal} 完了`,
        `- 協業事項: ${s.collaborationDone}/${s.collaborationTotal} 完了`,
      ],
      [
        `- 全部: ${s.done}/${s.total} 完成`,
        `- 整改事项: ${s.remediationDone}/${s.remediationTotal} 完成`,
        `- 协作事项: ${s.collaborationDone}/${s.collaborationTotal} 完成`,
      ],
    ), lang);

    return lines;
  }

  function maybeNotifyAllSubtasksComplete(parentTaskId: string, subtaskDelegationCompletionNoticeSent: Set<string>): void {
    const remaining = db.prepare(
      "SELECT COUNT(*) as cnt FROM subtasks WHERE task_id = ? AND status != 'done'"
    ).get(parentTaskId) as { cnt: number };
    if (remaining.cnt !== 0 || subtaskDelegationCompletionNoticeSent.has(parentTaskId)) return;

    const parentTask = db.prepare("SELECT title, description, status FROM tasks WHERE id = ?").get(parentTaskId) as {
      title: string;
      description: string | null;
      status: string;
    } | undefined;
    if (!parentTask) return;

    const lang = resolveLang(parentTask.description ?? parentTask.title);
    subtaskDelegationCompletionNoticeSent.add(parentTaskId);
    const subtaskProgressSummary = formatTaskSubtaskProgressSummary(parentTaskId, lang);
    const progressSuffix = subtaskProgressSummary
      ? `\n${pickL(l(["보완/협업 완료 현황"], ["Remediation/Collaboration completion"], ["補完/協業 完了状況"], ["整改/协作完成情况"]), lang)}\n${subtaskProgressSummary}`
      : "";
    notifyCeo(pickL(l(
      [`'${parentTask.title}' 의 모든 서브태스크(부서간 협업 포함)가 완료되었습니다. ✅${progressSuffix}`],
      [`All subtasks for '${parentTask.title}' (including cross-department collaboration) are complete. ✅${progressSuffix}`],
      [`'${parentTask.title}' の全サブタスク（部門間協業含む）が完了しました。✅${progressSuffix}`],
      [`'${parentTask.title}'的全部 SubTask（含跨部门协作）已完成。✅${progressSuffix}`],
    ), lang), parentTaskId);
    if (parentTask.status === "review") {
      setTimeout(() => finishReview(parentTaskId, parentTask.title), 1200);
    }
  }

  function groupSubtasksByTargetDepartment(subtasks: SubtaskRow[]): SubtaskRow[][] {
    const grouped = new Map<string, SubtaskRow[]>();
    for (const subtask of subtasks) {
      const key = subtask.target_department_id ?? `unknown:${subtask.id}`;
      const bucket = grouped.get(key) ?? [];
      bucket.push(subtask);
      grouped.set(key, bucket);
    }
    return [...grouped.values()];
  }

  function getSubtaskDeptExecutionPriority(deptId: string | null): number {
    if (!deptId) return 999;
    const explicitOrder: Record<string, number> = {
      dev: 0, design: 1, qa: 2, operations: 3, devsecops: 4, planning: 5,
    };
    if (deptId in explicitOrder) return explicitOrder[deptId];
    const row = db.prepare("SELECT sort_order FROM departments WHERE id = ?").get(deptId) as { sort_order: number } | undefined;
    return row?.sort_order ?? 999;
  }

  function orderSubtaskQueuesByDepartment(queues: SubtaskRow[][]): SubtaskRow[][] {
    return [...queues].sort((a, b) => {
      const deptA = a[0]?.target_department_id ?? null;
      const deptB = b[0]?.target_department_id ?? null;
      const pa = getSubtaskDeptExecutionPriority(deptA);
      const pb = getSubtaskDeptExecutionPriority(deptB);
      if (pa !== pb) return pa - pb;
      const at = a[0]?.created_at ?? 0;
      const bt = b[0]?.created_at ?? 0;
      return at - bt;
    });
  }

  function hasOpenForeignSubtasks(taskId: string, targetDeptIds: string[] = []): boolean {
    const uniqueDeptIds = [...new Set(targetDeptIds.filter(Boolean))];
    if (uniqueDeptIds.length > 0) {
      const placeholders = uniqueDeptIds.map(() => "?").join(", ");
      const row = db.prepare(`
        SELECT 1 FROM subtasks
        WHERE task_id = ?
          AND target_department_id IN (${placeholders})
          AND target_department_id IS NOT NULL
          AND status != 'done'
          AND (delegated_task_id IS NULL OR delegated_task_id = '')
        LIMIT 1
      `).get(taskId, ...uniqueDeptIds);
      return !!row;
    }

    const row = db.prepare(`
      SELECT 1 FROM subtasks
      WHERE task_id = ?
        AND target_department_id IS NOT NULL
        AND status != 'done'
        AND (delegated_task_id IS NULL OR delegated_task_id = '')
      LIMIT 1
    `).get(taskId);
    return !!row;
  }

  return {
    getDeptName,
    getDeptRoleConstraint,
    findTeamLeader,
    findBestSubordinate,
    detectTargetDepartments,
    detectMentions,
    formatTaskSubtaskProgressSummary,
    maybeNotifyAllSubtasksComplete,
    groupSubtasksByTargetDepartment,
    orderSubtaskQueuesByDepartment,
    hasOpenForeignSubtasks,
  };
}
