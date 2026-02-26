// @ts-nocheck

import os from "node:os";
import path from "node:path";
import type { Lang } from "../../../types/lang.ts";

// ---------------------------------------------------------------------------
// Directive policy analysis and project resolution helpers
// ---------------------------------------------------------------------------

export type DirectivePolicy = {
  skipDelegation: boolean;
  skipDelegationReason: "no_task" | "lightweight" | null;
  skipPlannedMeeting: boolean;
  skipPlanSubtasks: boolean;
};

export type DelegationOptions = {
  skipPlannedMeeting?: boolean;
  skipPlanSubtasks?: boolean;
  projectId?: string | null;
  projectPath?: string | null;
  projectContext?: string | null;
};

export function normalizeTextField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export type ProjectLookupRow = {
  id: string;
  name: string;
  project_path: string;
  core_goal: string;
};

export function toResolvedProject(row: ProjectLookupRow | undefined): {
  id: string | null;
  name: string | null;
  projectPath: string | null;
  coreGoal: string | null;
} {
  if (!row) return { id: null, name: null, projectPath: null, coreGoal: null };
  return {
    id: row.id,
    name: normalizeTextField(row.name),
    projectPath: normalizeTextField(row.project_path),
    coreGoal: normalizeTextField(row.core_goal),
  };
}

export function normalizeProjectPathForMatch(value: string): string {
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed) return "";
  const withoutTrailing = trimmed.replace(/\/+$/g, "");
  return withoutTrailing || "/";
}

export function buildProjectPathCandidates(projectPath: string): string[] {
  const normalized = normalizeProjectPathForMatch(projectPath);
  if (!normalized) return [];

  const home = normalizeProjectPathForMatch(os.homedir());
  const candidates = new Set<string>([normalized]);
  if (normalized.startsWith("~/")) {
    candidates.add(normalizeProjectPathForMatch(path.join(os.homedir(), normalized.slice(2))));
  }
  if (home && normalized.startsWith(`${home}/`)) {
    candidates.add(normalized.slice(home.length));
  }
  if (normalized.startsWith("/Projects/")) {
    candidates.add(normalizeProjectPathForMatch(path.join(home, normalized.slice(1))));
  }
  if (normalized.startsWith("Projects/")) {
    candidates.add(normalizeProjectPathForMatch(path.join(home, normalized)));
  }
  return [...candidates].filter(Boolean);
}

export function analyzeDirectivePolicy(content: string): DirectivePolicy {
  const text = content.trim();
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  const compact = normalized.replace(/\s+/g, "");

  const includesTerm = (term: string): boolean => {
    const termNorm = term.toLowerCase();
    return normalized.includes(termNorm) || compact.includes(termNorm.replace(/\s+/g, ""));
  };
  const includesAny = (terms: string[]): boolean => terms.some(includesTerm);

  const isNoMeeting = false;

  const isNoTask = includesAny([
    "업무 생성 없이", "태스크 생성 없이", "작업 생성 없이", "sub task 없이",
    "delegation 없이", "하달 없이", "no task", "no delegation",
    "without delegation", "do not delegate", "don't delegate",
    "タスク作成なし", "タスク作成不要", "委任なし", "割り当てなし", "下達なし",
    "不创建任务", "无需创建任务", "不下达", "不委派", "不分配",
  ]);

  const hasLightweightSignal = includesAny([
    "응답 테스트", "응답테스트", "테스트 중", "테스트만", "ping", "헬스 체크",
    "health check", "status check", "상태 확인", "확인만", "ack test", "smoke test",
    "応答テスト", "応答確認", "テストのみ", "pingテスト", "状態確認", "動作確認",
    "响应测试", "响应确认", "仅测试", "测试一下", "状态检查", "健康检查", "ping测试",
  ]);

  const hasWorkSignal = includesAny([
    "업무", "작업", "하달", "착수", "실행", "진행", "작성", "수정", "구현", "배포",
    "리뷰", "검토", "정리", "조치", "할당", "태스크", "delegate", "assign",
    "implement", "deploy", "fix", "review", "plan", "subtask", "task", "handoff",
    "業務", "作業", "指示", "実行", "進行", "作成", "修正", "実装", "配布",
    "レビュー", "検討", "整理", "対応", "割当", "委任", "計画", "タスク",
    "任务", "工作", "下达", "执行", "进行", "编写", "修改", "实现", "部署",
    "评审", "审核", "处理", "分配", "委派", "计划", "子任务",
  ]);

  const isLightweight = hasLightweightSignal && !hasWorkSignal;
  const skipDelegation = isNoTask || isLightweight;
  const skipDelegationReason: DirectivePolicy["skipDelegationReason"] = isNoTask
    ? "no_task"
    : (isLightweight ? "lightweight" : null);
  const skipPlannedMeeting = !skipDelegation && isNoMeeting;
  const skipPlanSubtasks = skipPlannedMeeting;

  return { skipDelegation, skipDelegationReason, skipPlannedMeeting, skipPlanSubtasks };
}

export function shouldExecuteDirectiveDelegation(policy: DirectivePolicy, explicitSkipPlannedMeeting: boolean): boolean {
  if (!policy.skipDelegation) return true;
  if (explicitSkipPlannedMeeting && policy.skipDelegationReason === "lightweight") return true;
  return false;
}

export function buildRoundGoal(coreGoal: string | null, ceoMessage: string): string {
  if (coreGoal) {
    return `프로젝트 핵심목표("${coreGoal}")를 유지하면서 이번 요청("${ceoMessage}")을 이번 라운드에서 실행 가능한 산출물로 완수`;
  }
  return `이번 요청("${ceoMessage}")을 이번 라운드 목표로 정의하고 실행 가능한 산출물까지 완수`;
}

export function initializeDirectivePolicy(deps: { db: any }) {
  const { db } = deps;

  function resolveProjectFromOptions(options: DelegationOptions = {}): {
    id: string | null;
    name: string | null;
    projectPath: string | null;
    coreGoal: string | null;
  } {
    const explicitProjectId = normalizeTextField(options.projectId);
    if (explicitProjectId) {
      const row = db.prepare(`
        SELECT id, name, project_path, core_goal
        FROM projects WHERE id = ? LIMIT 1
      `).get(explicitProjectId) as ProjectLookupRow | undefined;
      if (row) return toResolvedProject(row);
    }

    const explicitProjectPath = normalizeTextField(options.projectPath);
    if (explicitProjectPath) {
      const pathCandidates = buildProjectPathCandidates(explicitProjectPath);
      if (pathCandidates.length > 0) {
        const placeholders = pathCandidates.map(() => "?").join(", ");
        const rowByPath = db.prepare(`
          SELECT id, name, project_path, core_goal
          FROM projects
          WHERE project_path IN (${placeholders})
          ORDER BY last_used_at DESC, updated_at DESC LIMIT 1
        `).get(...pathCandidates) as ProjectLookupRow | undefined;
        if (rowByPath) return toResolvedProject(rowByPath);
      }

      const normalizedPath = normalizeProjectPathForMatch(explicitProjectPath);
      const pathLeaf = path.posix.basename(normalizedPath);
      if (pathLeaf && pathLeaf !== "/" && pathLeaf !== ".") {
        const rowBySuffix = db.prepare(`
          SELECT id, name, project_path, core_goal
          FROM projects WHERE project_path LIKE ?
          ORDER BY last_used_at DESC, updated_at DESC LIMIT 1
        `).get(`%/${pathLeaf}`) as ProjectLookupRow | undefined;
        if (rowBySuffix) return toResolvedProject(rowBySuffix);
      }
    }

    const contextHint = normalizeTextField(options.projectContext);
    if (contextHint) {
      const rowByName = db.prepare(`
        SELECT id, name, project_path, core_goal
        FROM projects WHERE LOWER(name) = LOWER(?)
        ORDER BY last_used_at DESC, updated_at DESC LIMIT 1
      `).get(contextHint) as ProjectLookupRow | undefined;
      if (rowByName) return toResolvedProject(rowByName);

      const existingProjectHint = /기존\s*프로젝트|기존\s*작업|existing project|same project|current project|ongoing project|既存.*プロジェクト|現在.*プロジェクト|之前项目|当前项目/i
        .test(contextHint);
      if (existingProjectHint) {
        const latest = db.prepare(`
          SELECT id, name, project_path, core_goal
          FROM projects ORDER BY last_used_at DESC, updated_at DESC LIMIT 1
        `).get() as ProjectLookupRow | undefined;
        if (latest) return toResolvedProject(latest);
      }
    }

    return { id: null, name: null, projectPath: null, coreGoal: null };
  }

  return { resolveProjectFromOptions };
}
