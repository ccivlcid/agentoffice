import { request } from './client';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  html_url: string;
  clone_url: string;
}

export interface GitHubBranch {
  name: string;
  sha: string;
  is_default: boolean;
}

export interface GitHubStatus {
  connected: boolean;
  has_repo_scope: boolean;
  email?: string | null;
  account_id?: string;
}

export interface CloneStatus {
  clone_id: string;
  status: string;
  progress: number;
  error?: string;
  targetPath: string;
  repoFullName: string;
}

export async function getGitHubStatus(): Promise<GitHubStatus> {
  return request<GitHubStatus>('/api/github/status');
}

export async function getGitHubRepos(params?: {
  q?: string;
  page?: number;
  per_page?: number;
}): Promise<{ repos: GitHubRepo[] }> {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.per_page) qs.set('per_page', String(params.per_page));
  const q = qs.toString();
  return request<{ repos: GitHubRepo[] }>(
    `/api/github/repos${q ? '?' + q : ''}`,
  );
}

export async function getGitHubBranches(
  owner: string,
  repo: string,
  pat?: string,
): Promise<{
  remote_branches: GitHubBranch[];
  default_branch: string | null;
}> {
  const init: RequestInit = {};
  if (pat) init.headers = { 'X-GitHub-PAT': pat };
  return request(
    `/api/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
    init,
  );
}

export async function cloneGitHubRepo(input: {
  owner: string;
  repo: string;
  branch?: string;
  target_path?: string;
  pat?: string;
}): Promise<{
  clone_id: string | null;
  already_exists?: boolean;
  target_path: string;
}> {
  const { pat, ...body } = input;
  return request('/api/github/clone', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(pat ? { 'X-GitHub-PAT': pat } : {}),
    },
  });
}

export async function getCloneStatus(cloneId: string): Promise<CloneStatus> {
  return request<CloneStatus>(`/api/github/clone/${cloneId}`);
}
