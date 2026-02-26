import { request, del } from './client';

export interface ActiveAgentInfo {
  id: string;
  name: string;
  name_ko: string;
  avatar_emoji: string;
  role: string;
  status: string;
  current_task_id: string | null;
  department_id: string | null;
  cli_provider: string;
  dept_name: string;
  dept_name_ko: string;
  task_id: string | null;
  task_title: string | null;
  task_status: string | null;
  task_started_at: number | null;
  has_active_process: boolean;
  session_opened_at: number | null;
  last_activity_at: number | null;
  idle_seconds: number | null;
}

export async function getActiveAgents(): Promise<ActiveAgentInfo[]> {
  const j = await request<{ ok: boolean; agents: ActiveAgentInfo[] }>(
    '/api/agents/active',
  );
  return j.agents;
}

export interface CliProcessInfo {
  pid: number;
  ppid: number | null;
  provider:
    | 'claude'
    | 'codex'
    | 'gemini'
    | 'opencode'
    | 'node'
    | 'python';
  executable: string;
  command: string;
  is_tracked: boolean;
  is_idle: boolean;
  idle_reason: string | null;
  task_id: string | null;
  task_title: string | null;
  task_status: string | null;
  agent_id: string | null;
  agent_name: string | null;
  agent_name_ko: string | null;
  agent_status: string | null;
  session_opened_at: number | null;
  last_activity_at: number | null;
  idle_seconds: number | null;
}

export async function getCliProcesses(): Promise<CliProcessInfo[]> {
  const j = await request<{ ok: boolean; processes: CliProcessInfo[] }>(
    '/api/agents/cli-processes',
  );
  return j.processes ?? [];
}

export async function killCliProcess(pid: number): Promise<{
  ok: boolean;
  pid: number;
  tracked_task_id: string | null;
}> {
  return del(
    `/api/agents/cli-processes/${encodeURIComponent(String(pid))}`,
  ) as Promise<{
    ok: boolean;
    pid: number;
    tracked_task_id: string | null;
  }>;
}
