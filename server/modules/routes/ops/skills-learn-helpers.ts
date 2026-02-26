// @ts-nocheck
/**
 * Skill learn types, constants and helper functions.
 * Extracted from skills-learn.ts to keep each file under 300 lines.
 */

import fs from "node:fs";
import path from "node:path";

export type SkillLearnProvider = "claude" | "codex" | "gemini" | "opencode";
export type SkillHistoryProvider = SkillLearnProvider | "copilot" | "antigravity" | "api";
export type SkillLearnStatus = "queued" | "running" | "succeeded" | "failed";

export interface SkillLearnJob {
  id: string;
  repo: string;
  skillId: string;
  providers: SkillLearnProvider[];
  agents: string[];
  status: SkillLearnStatus;
  command: string;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
  exitCode: number | null;
  logTail: string[];
  error: string | null;
}

export const SKILL_LEARN_PROVIDER_TO_AGENT: Record<SkillLearnProvider, string> = {
  claude: "claude-code",
  codex: "codex",
  gemini: "gemini-cli",
  opencode: "opencode",
};
export const SKILL_HISTORY_PROVIDER_TO_AGENT: Record<SkillHistoryProvider, string | null> = {
  claude: "claude-code",
  codex: "codex",
  gemini: "gemini-cli",
  opencode: "opencode",
  copilot: "github-copilot",
  antigravity: "antigravity",
  api: null,
};

export const SKILL_LEARN_REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;
export const SKILL_LEARN_MAX_LOG_LINES = 120;
export const SKILL_LEARN_JOB_TTL_MS = 30 * 60 * 1000;
export const SKILL_LEARN_MAX_JOBS = 200;
export const SKILL_LEARN_HISTORY_RETENTION_DAYS = 180;
export const SKILL_LEARN_HISTORY_RETENTION_MS = SKILL_LEARN_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;
export const SKILL_LEARN_HISTORY_MAX_ROWS_PER_PROVIDER = 2_000;
export const SKILL_LEARN_HISTORY_MAX_QUERY_LIMIT = 200;
export const SKILL_UNLEARN_TIMEOUT_MS = 20_000;
export const SKILLS_NPX_CMD = process.platform === "win32" ? "npx.cmd" : "npx";

export function isSkillLearnProvider(value: string): value is SkillLearnProvider {
  return value === "claude" || value === "codex" || value === "gemini" || value === "opencode";
}

export function isSkillHistoryProvider(value: string): value is SkillHistoryProvider {
  return isSkillLearnProvider(value) || value === "copilot" || value === "antigravity" || value === "api";
}

export function normalizeSkillLearnProviders(input: unknown): SkillLearnProvider[] {
  if (!Array.isArray(input)) return [];
  const out: SkillLearnProvider[] = [];
  for (const raw of input) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (isSkillLearnProvider(value) && !out.includes(value)) out.push(value);
  }
  return out;
}

export function normalizeSkillLearnStatus(input: string): SkillLearnStatus | null {
  if (input === "queued" || input === "running" || input === "succeeded" || input === "failed") return input;
  return null;
}

export function normalizeSkillLearnSkillId(skillId: string, repo: string): string {
  const trimmed = skillId.trim();
  if (trimmed) return trimmed;
  const repoTail = repo.split("/").filter(Boolean).pop();
  return repoTail ?? "unknown-skill";
}

export function stripAnsiControl(value: string): string {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

export function buildSkillUnlearnCandidates(skillId: string, repo: string): string[] {
  const out: string[] = [];
  const pushUnique = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !out.includes(trimmed)) out.push(trimmed);
  };
  pushUnique(skillId);
  if (skillId.includes("#")) { const t = skillId.split("#").filter(Boolean).pop(); if (t) pushUnique(t); }
  if (skillId.includes(":")) { const t = skillId.split(":").filter(Boolean).pop(); if (t) pushUnique(t); }
  if (skillId.includes("/")) { const t = skillId.split("/").filter(Boolean).pop(); if (t) pushUnique(t); }
  const repoTail = repo.split("/").filter(Boolean).pop();
  if (repoTail) pushUnique(repoTail);
  return out;
}

export function formatExecError(err: unknown): string {
  return err instanceof Error ? err.message || String(err) : String(err);
}

export type SkillLinkState = "linked" | "not_linked" | "unverifiable";

export function resolveAgentSkillDir(agent: string): string | null {
  if (agent === "claude-code") return path.join(process.cwd(), ".claude", "skills");
  if (agent === "codex") return path.join(process.cwd(), ".codex", "skills");
  if (agent === "gemini-cli") return path.join(process.cwd(), ".gemini", "skills");
  if (agent === "opencode") return path.join(process.cwd(), ".opencode", "skills");
  if (agent === "github-copilot") return path.join(process.cwd(), ".copilot", "skills");
  if (agent === "antigravity") return path.join(process.cwd(), ".antigravity", "skills");
  return null;
}

export function detectSkillLinkStateFromFilesystem(agent: string, candidates: string[]): SkillLinkState {
  const agentSkillDir = resolveAgentSkillDir(agent);
  if (!agentSkillDir || !fs.existsSync(agentSkillDir)) return "unverifiable";
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(agentSkillDir, candidate))) return "linked";
    } catch { /* ignore */ }
  }
  return "not_linked";
}

export async function runSkillUnlearnForProvider(
  execWithTimeout: (cmd: string, args: string[], timeoutMs: number) => Promise<string>,
  provider: SkillHistoryProvider,
  repo: string,
  skillId: string,
): Promise<{
  ok: boolean;
  skipped: boolean;
  agent: string | null;
  removedSkill: string | null;
  message: string;
  attempts: Array<{ skill: string; output: string }>;
}> {
  const agent = SKILL_HISTORY_PROVIDER_TO_AGENT[provider] ?? null;
  if (!agent) {
    return { ok: true, skipped: true, agent: null, removedSkill: null, message: "no_local_cli_agent_for_provider", attempts: [] };
  }
  const candidates = buildSkillUnlearnCandidates(skillId, repo);
  const attempts: Array<{ skill: string; output: string }> = [];
  const preState = detectSkillLinkStateFromFilesystem(agent, candidates);
  if (preState === "not_linked") {
    return { ok: true, skipped: true, agent, removedSkill: null, message: "skill_already_unlinked", attempts };
  }
  const strictVerify = preState !== "unverifiable";
  let removedSkill: string | null = null;
  let sawNoMatching = true;
  for (const candidate of candidates) {
    const args = ["--yes", "skills@latest", "remove", "--yes", "--agent", agent, "--skill", candidate];
    try {
      const rawOutput = await execWithTimeout(SKILLS_NPX_CMD, args, SKILL_UNLEARN_TIMEOUT_MS);
      const output = stripAnsiControl(rawOutput || "").trim();
      attempts.push({ skill: candidate, output });
      if (/no matching skills found/i.test(output)) continue;
      sawNoMatching = false;
      removedSkill = candidate;
      break;
    } catch (err) {
      return { ok: false, skipped: false, agent, removedSkill: null, message: formatExecError(err), attempts };
    }
  }
  const postState = detectSkillLinkStateFromFilesystem(agent, candidates);
  attempts.push({ skill: "__verify__", output: `state=${postState}` });
  if (strictVerify && postState === "linked") {
    return { ok: false, skipped: false, agent, removedSkill: null, message: "cli_unlearn_verify_failed_fs_still_linked", attempts };
  }
  if (removedSkill) {
    return { ok: true, skipped: false, agent, removedSkill, message: "cli_skill_remove_ok", attempts };
  }
  return {
    ok: true,
    skipped: true,
    agent,
    removedSkill: null,
    message: sawNoMatching
      ? (strictVerify ? "no_matching_installed_skill_found_for_unlearn" : "no_matching_installed_skill_found_unverifiable_scope")
      : "cli_unlearn_unverifiable_scope",
    attempts,
  };
}
