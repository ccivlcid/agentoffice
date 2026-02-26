// @ts-nocheck

import { readNonNegativeIntEnv } from "../../db/runtime.ts";

// ---------------------------------------------------------------------------
// MVP Code Review Policy + Execution Continuity Policy
// ---------------------------------------------------------------------------

const MVP_CODE_REVIEW_POLICY_BASE_LINES = [
  "[MVP Code Review Policy / 코드 리뷰 정책]",
  "- CRITICAL/HIGH: fix immediately / 즉시 수정",
  "- MEDIUM/LOW: warning report only, no code changes / 경고 보고서만, 코드 수정 금지",
];
const EXECUTION_CONTINUITY_POLICY_LINES = [
  "[Execution Continuity / 실행 연속성]",
  "- Continue from the latest state without self-introduction or kickoff narration / 자기소개·착수 멘트 없이 최신 상태에서 바로 이어서 작업",
  "- Reuse prior codebase understanding and read only files needed for this delta / 기존 코드베이스 이해를 재사용하고 이번 변경에 필요한 파일만 확인",
  "- Focus on unresolved checklist items and produce concrete diffs first / 미해결 체크리스트 중심으로 즉시 코드 변경부터 진행",
];

const WARNING_FIX_OVERRIDE_LINE = "- Exception override: User explicitly requested warning-level fixes for this task. You may fix the requested MEDIUM/LOW items / 예외: 이 작업에서 사용자 요청 시 MEDIUM/LOW도 해당 요청 범위 내에서 수정 가능";

export function hasExplicitWarningFixRequest(...textParts: Array<string | null | undefined>): boolean {
  const text = textParts.filter((part): part is string => typeof part === "string" && part.trim().length > 0).join("\n");
  if (!text) return false;
  if (/\[(ALLOW_WARNING_FIX|WARN_FIX)\]/i.test(text)) return true;

  const requestHint = /\b(please|can you|need to|must|should|fix this|fix these|resolve this|address this|fix requested|warning fix)\b|해줘|해주세요|수정해|수정해야|고쳐|고쳐줘|해결해|반영해|조치해|수정 요청/i;
  if (!requestHint.test(text)) return false;

  const warningFixPair = /\b(fix|resolve|address|patch|remediate|correct)\b[\s\S]{0,60}\b(warning|warnings|medium|low|minor|non-critical|lint)\b|\b(warning|warnings|medium|low|minor|non-critical|lint)\b[\s\S]{0,60}\b(fix|resolve|address|patch|remediate|correct)\b|(?:경고|워닝|미디엄|로우|마이너|사소|비치명|린트)[\s\S]{0,40}(?:수정|고쳐|해결|반영|조치)|(?:수정|고쳐|해결|반영|조치)[\s\S]{0,40}(?:경고|워닝|미디엄|로우|마이너|사소|비치명|린트)/i;
  return warningFixPair.test(text);
}

function buildMvpCodeReviewPolicyBlock(allowWarningFix: boolean): string {
  const lines = [...MVP_CODE_REVIEW_POLICY_BASE_LINES];
  if (allowWarningFix) lines.push(WARNING_FIX_OVERRIDE_LINE);
  return lines.join("\n");
}

export function buildTaskExecutionPrompt(
  parts: Array<string | null | undefined>,
  opts: { allowWarningFix?: boolean } = {},
): string {
  return [
    ...parts,
    EXECUTION_CONTINUITY_POLICY_LINES.join("\n"),
    buildMvpCodeReviewPolicyBlock(Boolean(opts.allowWarningFix)),
  ].filter(Boolean).join("\n");
}

// ---------------------------------------------------------------------------
// Prompt Skills
// ---------------------------------------------------------------------------

type PromptSkillProvider = "claude" | "codex" | "gemini" | "opencode" | "copilot" | "antigravity" | "api";
type PromptSkillRow = {
  repo: string;
  skill_id: string;
  skill_label: string;
  learned_at: number;
};

const SKILL_PROMPT_FETCH_LIMIT = 8;
const SKILL_PROMPT_INLINE_LIMIT = 4;
const DEFAULT_LOCAL_TASTE_SKILL_PATH = "tools/taste-skill/skill.md";
const DEFAULT_PROMPT_SKILLS: PromptSkillRow[] = [
  {
    repo: DEFAULT_LOCAL_TASTE_SKILL_PATH,
    skill_id: "",
    skill_label: `${DEFAULT_LOCAL_TASTE_SKILL_PATH} (default local baseline)`,
    learned_at: Number.MAX_SAFE_INTEGER,
  },
];

function isPromptSkillProvider(provider: string): provider is PromptSkillProvider {
  return provider === "claude"
    || provider === "codex"
    || provider === "gemini"
    || provider === "opencode"
    || provider === "copilot"
    || provider === "antigravity"
    || provider === "api";
}

function getPromptSkillProviderDisplayName(provider: string): string {
  if (provider === "claude") return "Claude Code";
  if (provider === "codex") return "Codex";
  if (provider === "gemini") return "Gemini";
  if (provider === "opencode") return "OpenCode";
  if (provider === "copilot") return "GitHub Copilot";
  if (provider === "antigravity") return "Antigravity";
  if (provider === "api") return "API Provider";
  return provider || "unknown";
}

function clipPromptSkillLabel(label: string, maxLength = 48): string {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function formatPromptSkillTag(repo: string, skillId: string, skillLabel: string): string {
  const fallback = skillId ? `${repo}#${skillId}` : repo;
  const source = skillLabel || fallback;
  const clipped = clipPromptSkillLabel(source);
  return clipped ? `[${clipped}]` : "";
}

function normalizePromptSkillRepo(repo: string): string {
  return String(repo || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\/+$/, "");
}

function withDefaultPromptSkills(rows: PromptSkillRow[]): PromptSkillRow[] {
  const merged: PromptSkillRow[] = [];
  const seen = new Set<string>();

  const pushUnique = (row: PromptSkillRow) => {
    const repoKey = normalizePromptSkillRepo(row.repo);
    if (!repoKey) return;
    if (seen.has(repoKey)) return;
    seen.add(repoKey);
    merged.push(row);
  };

  for (const row of DEFAULT_PROMPT_SKILLS) pushUnique(row);
  for (const row of rows) pushUnique(row);

  return merged;
}

function queryPromptSkillsByProvider(db: any, provider: PromptSkillProvider, limit: number): Array<{
  repo: string;
  skill_id: string;
  skill_label: string;
  learned_at: number;
}> {
  return db.prepare(`
    SELECT
      repo,
      skill_id,
      skill_label,
      MAX(COALESCE(run_completed_at, updated_at, created_at)) AS learned_at
    FROM skill_learning_history
    WHERE status = 'succeeded' AND provider = ?
    GROUP BY repo, skill_id, skill_label
    ORDER BY learned_at DESC
    LIMIT ?
  `).all(provider, limit) as Array<{
    repo: string;
    skill_id: string;
    skill_label: string;
    learned_at: number;
  }>;
}

function queryPromptSkillsGlobal(db: any, limit: number): Array<{
  repo: string;
  skill_id: string;
  skill_label: string;
  learned_at: number;
}> {
  return db.prepare(`
    SELECT
      repo,
      skill_id,
      skill_label,
      MAX(COALESCE(run_completed_at, updated_at, created_at)) AS learned_at
    FROM skill_learning_history
    WHERE status = 'succeeded'
    GROUP BY repo, skill_id, skill_label
    ORDER BY learned_at DESC
    LIMIT ?
  `).all(limit) as Array<{
    repo: string;
    skill_id: string;
    skill_label: string;
    learned_at: number;
  }>;
}

function formatPromptSkillTagLine(rows: Array<{ repo: string; skill_id: string; skill_label: string }>): string {
  const tags = rows
    .map((row) => formatPromptSkillTag(row.repo, row.skill_id, row.skill_label))
    .filter(Boolean);
  if (tags.length === 0) return "[none]";
  const inlineCount = Math.min(tags.length, SKILL_PROMPT_INLINE_LIMIT);
  const inline = tags.slice(0, inlineCount).join("");
  const overflow = tags.length - inlineCount;
  return overflow > 0 ? `${inline}[+${overflow} more]` : inline;
}

export function buildAvailableSkillsPromptBlock(db: any, provider: string): string {
  const providerDisplay = getPromptSkillProviderDisplayName(provider);
  const localDefaultSkillRule = `[Skills Rule] Default local skill: \`${DEFAULT_LOCAL_TASTE_SKILL_PATH}\`. Read and apply it before execution when available.`;
  try {
    const providerKey = isPromptSkillProvider(provider) ? provider : null;
    const providerLearnedSkills = providerKey
      ? queryPromptSkillsByProvider(db, providerKey, SKILL_PROMPT_FETCH_LIMIT)
      : [];
    if (providerLearnedSkills.length > 0) {
      const providerSkills = withDefaultPromptSkills(providerLearnedSkills);
      return [
        `[Available Skills][provider=${providerDisplay}][default=taste-skill]${formatPromptSkillTagLine(providerSkills)}`,
        "[Skills Rule] Use provider-matched skills first when relevant.",
        localDefaultSkillRule,
      ].join("\n");
    }

    const fallbackLearnedSkills = queryPromptSkillsGlobal(db, SKILL_PROMPT_FETCH_LIMIT);
    if (fallbackLearnedSkills.length > 0) {
      const fallbackSkills = withDefaultPromptSkills(fallbackLearnedSkills);
      return [
        `[Available Skills][provider=${providerDisplay}][default=taste-skill][fallback=global]${formatPromptSkillTagLine(fallbackSkills)}`,
        "[Skills Rule] No provider-specific history yet. Use global learned skills when relevant.",
        localDefaultSkillRule,
      ].join("\n");
    }

    const defaultSkills = withDefaultPromptSkills([]);
    return [
      `[Available Skills][provider=${providerDisplay}][default=taste-skill]${formatPromptSkillTagLine(defaultSkills)}`,
      "[Skills Rule] No learned skills recorded yet.",
      localDefaultSkillRule,
    ].join("\n");
  } catch {
    const defaultSkills = withDefaultPromptSkills([]);
    return [
      `[Available Skills][provider=${providerDisplay}][default=taste-skill][fallback=unavailable]${formatPromptSkillTagLine(defaultSkills)}`,
      "[Skills Rule] Skills history lookup failed.",
      localDefaultSkillRule,
    ].join("\n");
  }
}
