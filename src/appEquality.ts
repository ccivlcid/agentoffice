import type { Agent, Task } from "./types";

export function areValuesEquivalent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return Object.is(a, b);
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export function areExtraFieldsEquivalent(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  comparedKeys: ReadonlySet<string>,
): boolean {
  const keys = new Set<string>([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (comparedKeys.has(key)) continue;
    if (!areValuesEquivalent(a[key], b[key])) return false;
  }
  return true;
}

export const AGENT_EQ_KNOWN_KEYS = new Set<string>([
  "id", "name", "name_ko", "department_id", "role", "cli_provider",
  "oauth_account_id", "api_provider_id", "api_model", "avatar_emoji",
  "personality", "status", "current_task_id", "stats_tasks_done",
  "stats_xp", "created_at",
]);

export const TASK_EQ_KNOWN_KEYS = new Set<string>([
  "id", "title", "description", "department_id", "assigned_agent_id",
  "project_id", "status", "priority", "task_type", "project_path",
  "result", "started_at", "completed_at", "created_at", "updated_at",
  "source_task_id", "subtask_total", "subtask_done", "hidden",
]);

export function areAgentsEquivalent(a: Agent, b: Agent): boolean {
  if (
    a.id === b.id && a.name === b.name && a.name_ko === b.name_ko &&
    a.department_id === b.department_id && a.role === b.role &&
    a.cli_provider === b.cli_provider &&
    (a.oauth_account_id ?? null) === (b.oauth_account_id ?? null) &&
    (a.api_provider_id ?? null) === (b.api_provider_id ?? null) &&
    (a.api_model ?? null) === (b.api_model ?? null) &&
    a.avatar_emoji === b.avatar_emoji &&
    (a.personality ?? null) === (b.personality ?? null) &&
    a.status === b.status &&
    (a.current_task_id ?? null) === (b.current_task_id ?? null) &&
    a.stats_tasks_done === b.stats_tasks_done &&
    a.stats_xp === b.stats_xp && a.created_at === b.created_at
  ) {
    return areExtraFieldsEquivalent(
      a as unknown as Record<string, unknown>,
      b as unknown as Record<string, unknown>,
      AGENT_EQ_KNOWN_KEYS,
    );
  }
  return false;
}

export function areAgentListsEquivalent(prev: Agent[], next: Agent[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (!areAgentsEquivalent(prev[i], next[i])) return false;
  }
  return true;
}

export function areTasksEquivalent(a: Task, b: Task): boolean {
  if (
    a.id === b.id && a.title === b.title &&
    (a.description ?? null) === (b.description ?? null) &&
    (a.department_id ?? null) === (b.department_id ?? null) &&
    (a.assigned_agent_id ?? null) === (b.assigned_agent_id ?? null) &&
    (a.project_id ?? null) === (b.project_id ?? null) &&
    a.status === b.status && a.priority === b.priority &&
    a.task_type === b.task_type &&
    (a.project_path ?? null) === (b.project_path ?? null) &&
    (a.result ?? null) === (b.result ?? null) &&
    (a.started_at ?? null) === (b.started_at ?? null) &&
    (a.completed_at ?? null) === (b.completed_at ?? null) &&
    a.created_at === b.created_at && a.updated_at === b.updated_at &&
    (a.source_task_id ?? null) === (b.source_task_id ?? null) &&
    (a.subtask_total ?? null) === (b.subtask_total ?? null) &&
    (a.subtask_done ?? null) === (b.subtask_done ?? null) &&
    (a.hidden ?? 0) === (b.hidden ?? 0)
  ) {
    return areExtraFieldsEquivalent(
      a as unknown as Record<string, unknown>,
      b as unknown as Record<string, unknown>,
      TASK_EQ_KNOWN_KEYS,
    );
  }
  return false;
}

export function areTaskListsEquivalent(prev: Task[], next: Task[]): boolean {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    if (!areTasksEquivalent(prev[i], next[i])) return false;
  }
  return true;
}
