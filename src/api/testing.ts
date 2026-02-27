import { request, post, patch, del } from './client';

// ── Test Runs ────────────────────────────────────────────────────────────────

export interface TestRun {
  id: string;
  task_id: string;
  command: string;
  cwd: string | null;
  status: 'running' | 'passed' | 'failed' | 'error';
  started_at: number;
  finished_at: number | null;
  duration: number | null;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  output: string | null;
  created_at: number;
}

export async function getTestRuns(taskId: string): Promise<TestRun[]> {
  const j = await request<{ ok: boolean; runs: TestRun[] }>(`/api/tasks/${taskId}/test`);
  return j.runs;
}

export async function startTestRun(
  taskId: string,
  command: string,
  cwd?: string,
): Promise<string> {
  const j = (await post(`/api/tasks/${taskId}/test`, { command, cwd })) as { run_id: string };
  return j.run_id;
}

// ── Test Detection ───────────────────────────────────────────────────────────

export interface DetectedScript {
  name: string;
  command: string;
  source: string;
}

export async function detectTestScripts(taskId: string): Promise<DetectedScript[]> {
  const j = await request<{ ok: boolean; scripts: DetectedScript[] }>(
    `/api/tasks/${taskId}/test/detect`,
  );
  return j.scripts;
}

// ── Preview ──────────────────────────────────────────────────────────────────

export interface PreviewSession {
  id: string;
  task_id: string;
  command: string;
  pid: number | null;
  port: number | null;
  url: string | null;
  status: 'starting' | 'running' | 'stopped' | 'error';
  started_at: number;
  stopped_at: number | null;
  created_at: number;
}

export async function getPreviewSessions(taskId: string): Promise<PreviewSession[]> {
  const j = await request<{ ok: boolean; sessions: PreviewSession[] }>(
    `/api/tasks/${taskId}/preview`,
  );
  return j.sessions;
}

export async function startPreview(
  taskId: string,
  command: string,
): Promise<string> {
  const j = (await post(`/api/tasks/${taskId}/preview`, { command })) as { session_id: string };
  return j.session_id;
}

export async function stopPreview(
  taskId: string,
  sessionId: string,
): Promise<void> {
  await del(`/api/tasks/${taskId}/preview?session_id=${sessionId}`);
}

// ── Checklist ────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  task_id: string;
  category: string | null;
  text: string;
  checked: number;
  checked_at: number | null;
  note: string | null;
  auto_generated: number;
  sort_order: number;
  created_at: number;
}

export async function getChecklist(taskId: string): Promise<ChecklistItem[]> {
  const j = await request<{ ok: boolean; items: ChecklistItem[] }>(
    `/api/tasks/${taskId}/checklist`,
  );
  return j.items;
}

export async function addChecklistItem(
  taskId: string,
  text: string,
  category?: string,
): Promise<ChecklistItem> {
  const j = (await post(`/api/tasks/${taskId}/checklist`, { text, category })) as {
    item: ChecklistItem;
  };
  return j.item;
}

export async function updateChecklistItem(
  taskId: string,
  itemId: string,
  data: Partial<Pick<ChecklistItem, 'checked' | 'text' | 'note' | 'category' | 'sort_order'>>,
): Promise<ChecklistItem> {
  const j = (await patch(`/api/tasks/${taskId}/checklist/${itemId}`, data)) as {
    item: ChecklistItem;
  };
  return j.item;
}

export async function deleteChecklistItem(
  taskId: string,
  itemId: string,
): Promise<void> {
  await del(`/api/tasks/${taskId}/checklist/${itemId}`);
}

export async function generateChecklist(taskId: string): Promise<ChecklistItem[]> {
  const j = await request<{ ok: boolean; items: ChecklistItem[] }>(
    `/api/tasks/${taskId}/checklist/generate`,
    { method: 'POST' },
  );
  return j.items;
}
