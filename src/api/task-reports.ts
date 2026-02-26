import { request, post } from './client';

export interface TaskReportSummary {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  assigned_agent_id: string | null;
  status: string;
  project_id?: string | null;
  project_path: string | null;
  source_task_id?: string | null;
  created_at: number;
  completed_at: number | null;
  agent_name: string;
  agent_name_ko: string;
  agent_role: string;
  dept_name: string;
  dept_name_ko: string;
  project_name?: string;
}

export interface TaskReportDocument {
  id: string;
  title: string;
  source: 'task_result' | 'report_message' | 'file' | string;
  path: string | null;
  mime: string | null;
  size_bytes: number | null;
  updated_at: number | null;
  truncated: boolean;
  text_preview: string;
  content: string;
}

export interface TaskReportTeamSection {
  id: string;
  task_id: string;
  source_task_id: string | null;
  title: string;
  status: string;
  department_id: string | null;
  department_name: string;
  department_name_ko: string;
  agent_id: string | null;
  agent_name: string;
  agent_name_ko: string;
  agent_role: string | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  summary: string;
  logs: Array<{ kind: string; message: string; created_at: number }>;
  meeting_minutes: Array<{
    meeting_type: string;
    round_number: number;
    entries: string;
    created_at: number;
  }>;
  documents: TaskReportDocument[];
  linked_subtasks: Array<{
    id: string;
    title: string;
    status: string;
    assigned_agent_id: string | null;
    target_department_id: string | null;
    delegated_task_id: string | null;
    completed_at: number | null;
    agent_name: string;
    agent_name_ko: string;
    target_dept_name: string;
    target_dept_name_ko: string;
  }>;
}

export interface TaskReportDetail {
  ok?: boolean;
  requested_task_id?: string;
  project?: {
    root_task_id: string;
    project_id?: string | null;
    project_name: string;
    project_path: string | null;
    core_goal?: string | null;
  };
  task: TaskReportSummary;
  logs: Array<{ kind: string; message: string; created_at: number }>;
  subtasks: Array<{
    id: string;
    title: string;
    status: string;
    assigned_agent_id: string | null;
    target_department_id?: string | null;
    delegated_task_id?: string | null;
    completed_at: number | null;
    agent_name: string;
    agent_name_ko: string;
    target_dept_name?: string;
    target_dept_name_ko?: string;
  }>;
  meeting_minutes: Array<{
    meeting_type: string;
    round_number: number;
    entries: string;
    created_at: number;
  }>;
  planning_summary?: {
    title: string;
    content: string;
    source_task_id: string;
    source_agent_name: string;
    source_department_name: string;
    generated_at: number;
    documents: TaskReportDocument[];
  };
  team_reports?: TaskReportTeamSection[];
}

export interface CliUsageWindow {
  label: string;
  utilization: number;
  resetsAt: string | null;
}

export interface CliUsageEntry {
  windows: CliUsageWindow[];
  error: string | null;
}

export async function getCliUsage(): Promise<{
  ok: boolean;
  usage: Record<string, CliUsageEntry>;
}> {
  return request<{ ok: boolean; usage: Record<string, CliUsageEntry> }>(
    '/api/cli-usage',
  );
}

export async function refreshCliUsage(): Promise<{
  ok: boolean;
  usage: Record<string, CliUsageEntry>;
}> {
  return post('/api/cli-usage/refresh') as Promise<{
    ok: boolean;
    usage: Record<string, CliUsageEntry>;
  }>;
}

export async function getTaskReports(): Promise<TaskReportSummary[]> {
  const j = await request<{ ok: boolean; reports: TaskReportSummary[] }>(
    '/api/task-reports',
  );
  return j.reports;
}

export async function getTaskReportDetail(
  taskId: string,
): Promise<TaskReportDetail> {
  return request<TaskReportDetail>(`/api/task-reports/${taskId}`);
}

export async function archiveTaskReport(taskId: string): Promise<{
  ok: boolean;
  root_task_id: string;
  generated_by_agent_id: string | null;
  updated_at: number;
}> {
  return request(`/api/task-reports/${taskId}/archive`, { method: 'POST' });
}
