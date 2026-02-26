import type { Project } from '../types';
import { request, post, patch, del } from './client';

export interface ProjectTaskHistoryItem {
  id: string;
  title: string;
  status: string;
  task_type: string;
  priority: number;
  source_task_id?: string | null;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  assigned_agent_id: string | null;
  assigned_agent_name: string;
  assigned_agent_name_ko: string;
}

export interface ProjectReportHistoryItem {
  id: string;
  title: string;
  completed_at: number | null;
  created_at: number;
  assigned_agent_id: string | null;
  agent_name: string;
  agent_name_ko: string;
  dept_name: string;
  dept_name_ko: string;
}

export interface ProjectDecisionEventItem {
  id: number;
  snapshot_hash: string | null;
  event_type:
    | 'planning_summary'
    | 'representative_pick'
    | 'followup_request'
    | 'start_review_meeting';
  summary: string;
  selected_options_json: string | null;
  note: string | null;
  task_id: string | null;
  meeting_id: string | null;
  created_at: number;
}

export interface ProjectDetailResponse {
  project: Project;
  tasks: ProjectTaskHistoryItem[];
  reports: ProjectReportHistoryItem[];
  decision_events: ProjectDecisionEventItem[];
}

export async function getProjects(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<{
  projects: Project[];
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
}> {
  const sp = new URLSearchParams();
  if (params?.page) sp.set('page', String(params.page));
  if (params?.page_size) sp.set('page_size', String(params.page_size));
  if (params?.search) sp.set('search', params.search);
  const q = sp.toString();
  return request(`/api/projects${q ? `?${q}` : ''}`);
}

export async function createProject(input: {
  name: string;
  project_path: string;
  core_goal: string;
  create_path_if_missing?: boolean;
  github_repo?: string;
  assignment_mode?: 'auto' | 'manual';
  agent_ids?: string[];
}): Promise<Project> {
  const j = (await post('/api/projects', input)) as {
    ok: boolean;
    project: Project;
  };
  return j.project;
}

export async function updateProject(
  id: string,
  patchData: Partial<
    Pick<Project, 'name' | 'project_path' | 'core_goal'>
  > & {
    create_path_if_missing?: boolean;
    github_repo?: string | null;
    assignment_mode?: 'auto' | 'manual';
    agent_ids?: string[];
  },
): Promise<Project> {
  const j = (await patch(`/api/projects/${id}`, patchData)) as {
    ok: boolean;
    project: Project;
  };
  return j.project;
}

export interface ProjectPathCheckResult {
  normalized_path: string;
  exists: boolean;
  is_directory: boolean;
  can_create: boolean;
  nearest_existing_parent: string | null;
}

export interface ProjectPathBrowseEntry {
  name: string;
  path: string;
}

export interface ProjectPathBrowseResult {
  current_path: string;
  parent_path: string | null;
  entries: ProjectPathBrowseEntry[];
  truncated: boolean;
}

export async function checkProjectPath(
  pathInput: string,
): Promise<ProjectPathCheckResult> {
  const sp = new URLSearchParams();
  sp.set('path', pathInput);
  const j = await request<{ ok: boolean } & ProjectPathCheckResult>(
    `/api/projects/path-check?${sp.toString()}`,
  );
  return {
    normalized_path: j.normalized_path,
    exists: j.exists,
    is_directory: j.is_directory,
    can_create: j.can_create,
    nearest_existing_parent: j.nearest_existing_parent,
  };
}

export async function getProjectPathSuggestions(
  query: string,
  limit = 30,
): Promise<string[]> {
  const sp = new URLSearchParams();
  if (query.trim()) sp.set('q', query.trim());
  sp.set('limit', String(limit));
  const j = await request<{ ok: boolean; paths: string[] }>(
    `/api/projects/path-suggestions?${sp.toString()}`,
  );
  return j.paths ?? [];
}

export async function browseProjectPath(
  pathInput?: string,
): Promise<ProjectPathBrowseResult> {
  const sp = new URLSearchParams();
  if (pathInput?.trim()) sp.set('path', pathInput.trim());
  const q = sp.toString();
  const j = await request<{
    ok: boolean;
    current_path: string;
    parent_path: string | null;
    entries: ProjectPathBrowseEntry[];
    truncated: boolean;
  }>(`/api/projects/path-browse${q ? `?${q}` : ''}`);
  return {
    current_path: j.current_path,
    parent_path: j.parent_path,
    entries: j.entries ?? [],
    truncated: Boolean(j.truncated),
  };
}

export async function pickProjectPathNative(): Promise<{
  cancelled: boolean;
  path: string | null;
}> {
  const j = await request<{
    ok: boolean;
    cancelled?: boolean;
    path?: string;
  }>('/api/projects/path-native-picker', { method: 'POST' });
  if (!j.ok) {
    return { cancelled: Boolean(j.cancelled), path: null };
  }
  return { cancelled: false, path: j.path ?? null };
}

export async function deleteProject(id: string): Promise<void> {
  await del(`/api/projects/${id}`);
}

export async function getProjectDetail(
  id: string,
): Promise<ProjectDetailResponse> {
  return request(`/api/projects/${id}`);
}

export async function getProjectBranches(projectId: string): Promise<{
  branches: string[];
  current_branch: string | null;
}> {
  return request(
    `/api/projects/${projectId}/branches`,
  );
}
