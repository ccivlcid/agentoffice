import type {
  Task,
  TaskLog,
  SubTask,
  TaskStatus,
  TaskType,
  MeetingMinute,
} from '../types';
import { request, post, patch, del } from './client';

export async function getTasks(filters?: {
  status?: TaskStatus;
  department_id?: string;
  agent_id?: string;
}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.department_id) params.set('department_id', filters.department_id);
  if (filters?.agent_id) params.set('agent_id', filters.agent_id);
  const q = params.toString();
  const j = await request<{ tasks: Task[] }>(`/api/tasks${q ? '?' + q : ''}`);
  return j.tasks;
}

export async function getTask(
  id: string,
): Promise<{ task: Task; logs: TaskLog[]; subtasks: SubTask[] }> {
  return request(`/api/tasks/${id}`);
}

export async function createTask(input: {
  title: string;
  description?: string;
  department_id?: string;
  task_type?: TaskType;
  priority?: number;
  project_id?: string;
  project_path?: string;
  assigned_agent_id?: string;
}): Promise<string> {
  const j = (await post('/api/tasks', input)) as { id: string };
  return j.id;
}

export async function updateTask(
  id: string,
  data: Partial<
    Pick<
      Task,
      | 'title'
      | 'description'
      | 'status'
      | 'priority'
      | 'task_type'
      | 'department_id'
      | 'project_id'
      | 'project_path'
      | 'hidden'
    >
  >,
): Promise<void> {
  await patch(`/api/tasks/${id}`, data);
}

export async function bulkHideTasks(
  statuses: string[],
  hidden: 0 | 1,
): Promise<void> {
  await post('/api/tasks/bulk-hide', { statuses, hidden });
}

export async function deleteTask(id: string): Promise<void> {
  await del(`/api/tasks/${id}`);
}

export async function assignTask(id: string, agentId: string): Promise<void> {
  await post(`/api/tasks/${id}/assign`, { agent_id: agentId });
}

export async function runTask(id: string, opts?: { execution_mode: string }): Promise<void> {
  await post(`/api/tasks/${id}/run`, opts ?? {});
}

export interface TaskGitInfo {
  is_git_repo: boolean;
  current_branch?: string;
  remote_url?: string;
  project_path: string;
}

export async function getTaskGitInfo(id: string): Promise<TaskGitInfo> {
  return request<TaskGitInfo>(`/api/tasks/${id}/git-info`);
}

export async function stopTask(id: string): Promise<void> {
  await post(`/api/tasks/${id}/stop`, { mode: 'cancel' });
}

export async function pauseTask(id: string): Promise<void> {
  await post(`/api/tasks/${id}/stop`, { mode: 'pause' });
}

export async function resumeTask(id: string): Promise<void> {
  await post(`/api/tasks/${id}/resume`);
}

export type TerminalProgressHint = {
  phase: 'use' | 'ok' | 'error';
  tool: string;
  summary: string;
  file_path: string | null;
};

export type TerminalProgressHintsPayload = {
  current_file: string | null;
  hints: TerminalProgressHint[];
  ok_items: string[];
};

export async function getTerminal(
  id: string,
  lines?: number,
  pretty?: boolean,
  logLimit?: number,
): Promise<{
  ok: boolean;
  exists: boolean;
  path: string;
  text: string;
  task_logs?: Array<{
    id: number;
    kind: string;
    message: string;
    created_at: number;
  }>;
  progress_hints?: TerminalProgressHintsPayload | null;
}> {
  const params = new URLSearchParams();
  if (lines) params.set('lines', String(lines));
  if (pretty) params.set('pretty', '1');
  if (logLimit) params.set('log_limit', String(logLimit));
  const q = params.toString();
  return request(
    `/api/tasks/${id}/terminal${q ? '?' + q : ''}`,
  );
}

export async function getTaskMeetingMinutes(
  id: string,
): Promise<MeetingMinute[]> {
  const j = await request<{ meetings: MeetingMinute[] }>(
    `/api/tasks/${id}/meeting-minutes`,
  );
  return j.meetings;
}

export interface TaskDiffResult {
  ok: boolean;
  hasWorktree?: boolean;
  branchName?: string;
  stat?: string;
  diff?: string;
  error?: string;
}

export interface MergeResult {
  ok: boolean;
  message: string;
  conflicts?: string[];
}

export interface WorktreeEntry {
  taskId: string;
  branchName: string;
  worktreePath: string;
  projectPath: string;
}

export async function getTaskDiff(id: string): Promise<TaskDiffResult> {
  return request<TaskDiffResult>(`/api/tasks/${id}/diff`);
}

export async function mergeTask(id: string): Promise<MergeResult> {
  return post(`/api/tasks/${id}/merge`) as Promise<MergeResult>;
}

export async function discardTask(
  id: string,
): Promise<{ ok: boolean; message: string }> {
  return post(`/api/tasks/${id}/discard`) as Promise<{
    ok: boolean;
    message: string;
  }>;
}

export async function getWorktrees(): Promise<{
  ok: boolean;
  worktrees: WorktreeEntry[];
}> {
  return request<{ ok: boolean; worktrees: WorktreeEntry[] }>(
    '/api/worktrees',
  );
}

export async function getActiveSubtasks(): Promise<SubTask[]> {
  const j = await request<{ subtasks: SubTask[] }>('/api/subtasks?active=1');
  return j.subtasks ?? [];
}

export async function createSubtask(
  taskId: string,
  input: {
    title: string;
    description?: string;
    assigned_agent_id?: string;
  },
): Promise<SubTask> {
  return post(
    `/api/tasks/${taskId}/subtasks`,
    input,
  ) as Promise<SubTask>;
}

export async function updateSubtask(
  id: string,
  data: Partial<
    Pick<
      SubTask,
      | 'title'
      | 'description'
      | 'status'
      | 'assigned_agent_id'
      | 'blocked_reason'
    >
  >,
): Promise<SubTask> {
  return patch(`/api/subtasks/${id}`, data) as Promise<SubTask>;
}
