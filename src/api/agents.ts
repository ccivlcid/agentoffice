import type { Agent, MeetingPresence } from '../types';
import { request, patch, post, del } from './client';

export async function getAgents(): Promise<Agent[]> {
  const j = await request<{ agents: Agent[] }>('/api/agents');
  return j.agents;
}

export async function getAgent(id: string): Promise<Agent> {
  const j = await request<{ agent: Agent }>(`/api/agents/${id}`);
  return j.agent;
}

export async function getMeetingPresence(): Promise<MeetingPresence[]> {
  const j = await request<{ presence: MeetingPresence[] }>('/api/meeting-presence');
  return j.presence;
}

export async function updateAgent(
  id: string,
  data: Partial<
    Pick<
      Agent,
      | 'status'
      | 'current_task_id'
      | 'department_id'
      | 'role'
      | 'cli_provider'
      | 'oauth_account_id'
      | 'api_provider_id'
      | 'api_model'
      | 'personality'
      | 'name'
      | 'name_ko'
      | 'name_ja'
      | 'name_zh'
      | 'avatar_emoji'
      | 'sprite_number'
    >
  >,
): Promise<void> {
  await patch(`/api/agents/${id}`, data);
}

export async function createAgent(
  data: {
    name: string;
    /** 비우거나 생략 시 미배정(휴게실) */
    department_id?: string | null;
    role: string;
    name_ko?: string;
    name_ja?: string;
    name_zh?: string;
    cli_provider?: string;
    avatar_emoji?: string;
    personality?: string;
    sprite_number?: number;
  },
): Promise<Agent> {
  const payload = { ...data };
  if (payload.department_id === "" || payload.department_id == null) {
    payload.department_id = "";
  }
  const j = await post('/api/agents', payload) as { ok: boolean; agent: Agent };
  return j.agent;
}

export async function deleteAgent(id: string): Promise<void> {
  await del(`/api/agents/${id}`);
}
