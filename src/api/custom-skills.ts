import { request, post, put, del } from './client';

export interface CustomSkill {
  id: string;
  name: string;
  skill_id: string;
  repo: string;
  category: string | null;
  description: string;
  installs: number;
  created_at: number;
  updated_at: number;
}

export async function getCustomSkills(): Promise<CustomSkill[]> {
  const j = await request<{ ok: boolean; skills: CustomSkill[] }>('/api/custom-skills');
  return j.skills;
}

export async function createCustomSkill(input: {
  name: string;
  skill_id?: string;
  repo?: string;
  category?: string;
  description?: string;
  installs?: number;
}): Promise<{ ok: boolean; id: string }> {
  return post('/api/custom-skills', input) as Promise<{ ok: boolean; id: string }>;
}

export async function updateCustomSkill(
  id: string,
  patch: {
    name?: string;
    skill_id?: string;
    repo?: string;
    category?: string | null;
    description?: string;
    installs?: number;
  },
): Promise<{ ok: boolean }> {
  return put(`/api/custom-skills/${id}`, patch) as Promise<{ ok: boolean }>;
}

export async function deleteCustomSkill(id: string): Promise<{ ok: boolean }> {
  return del(`/api/custom-skills/${id}`) as Promise<{ ok: boolean }>;
}

export async function uploadCustomSkill(data: {
  name: string;
  content: string;
  provider: string;
}): Promise<{ ok: boolean; skill: CustomSkill }> {
  return post('/api/skills/custom', data) as Promise<{ ok: boolean; skill: CustomSkill }>;
}
