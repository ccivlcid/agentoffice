import { request, post } from './client';

export interface SkillEntry {
  rank: number;
  name: string;
  skillId: string;
  repo: string;
  installs: number;
}

export async function getSkills(): Promise<SkillEntry[]> {
  const j = await request<{ skills: SkillEntry[] }>('/api/skills');
  return j.skills;
}

export interface SkillDetail {
  title: string;
  description: string;
  whenToUse: string[];
  weeklyInstalls: string;
  firstSeen: string;
  installCommand: string;
  platforms: Array<{ name: string; installs: string }>;
  audits: Array<{ name: string; status: string }>;
}

export async function getSkillDetail(
  source: string,
  skillId: string,
): Promise<SkillDetail | null> {
  const j = await request<{ ok: boolean; detail: SkillDetail | null }>(
    `/api/skills/detail?source=${encodeURIComponent(source)}&skillId=${encodeURIComponent(skillId)}`,
  );
  return j.detail;
}

export type SkillLearnProvider =
  | 'claude'
  | 'codex'
  | 'gemini'
  | 'opencode';
export type SkillLearnStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';
export type SkillHistoryProvider =
  | SkillLearnProvider
  | 'copilot'
  | 'antigravity'
  | 'api';

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

export async function startSkillLearning(input: {
  repo: string;
  skillId?: string;
  providers: SkillLearnProvider[];
}): Promise<SkillLearnJob> {
  const j = (await post('/api/skills/learn', input)) as {
    ok: boolean;
    job: SkillLearnJob;
  };
  return j.job;
}

export async function getSkillLearningJob(
  jobId: string,
): Promise<SkillLearnJob> {
  const j = await request<{ ok: boolean; job: SkillLearnJob }>(
    `/api/skills/learn/${encodeURIComponent(jobId)}`,
  );
  return j.job;
}

export interface SkillLearningHistoryEntry {
  id: string;
  job_id: string;
  provider: SkillHistoryProvider;
  repo: string;
  skill_id: string;
  skill_label: string;
  status: SkillLearnStatus;
  command: string;
  error: string | null;
  run_started_at: number | null;
  run_completed_at: number | null;
  created_at: number;
  updated_at: number;
  skill_id_removed?: string | null;
  removed?: number | null;
}

export interface LearnedSkillEntry {
  provider: SkillHistoryProvider;
  repo: string;
  skill_id: string;
  skill_label: string;
  learned_at: number;
}

export async function getSkillLearningHistory(
  input: {
    provider?: SkillHistoryProvider;
    status?: SkillLearnStatus;
    limit?: number;
  } = {},
): Promise<{ history: SkillLearningHistoryEntry[]; retentionDays: number }> {
  const params = new URLSearchParams();
  if (input.provider) params.set('provider', input.provider);
  if (input.status) params.set('status', input.status);
  if (typeof input.limit === 'number')
    params.set('limit', String(input.limit));
  const qs = params.toString();
  const j = await request<{
    ok: boolean;
    history: SkillLearningHistoryEntry[];
    retention_days: number;
  }>(`/api/skills/history${qs ? `?${qs}` : ''}`);
  return {
    history: j.history ?? [],
    retentionDays: Number(j.retention_days ?? 0),
  };
}

export async function getAvailableLearnedSkills(
  input: { provider?: SkillHistoryProvider; limit?: number } = {},
): Promise<LearnedSkillEntry[]> {
  const params = new URLSearchParams();
  if (input.provider) params.set('provider', input.provider);
  if (typeof input.limit === 'number')
    params.set('limit', String(input.limit));
  const qs = params.toString();
  const j = await request<{ ok: boolean; skills: LearnedSkillEntry[] }>(
    `/api/skills/available${qs ? `?${qs}` : ''}`,
  );
  return j.skills ?? [];
}

export async function unlearnSkill(input: {
  provider: SkillHistoryProvider;
  repo: string;
  skillId?: string;
}): Promise<{
  ok: boolean;
  provider: SkillHistoryProvider;
  repo: string;
  skill_id: string;
  removed: number;
}> {
  return post('/api/skills/unlearn', input) as Promise<{
    ok: boolean;
    provider: SkillHistoryProvider;
    repo: string;
    skill_id: string;
    removed: number;
  }>;
}
