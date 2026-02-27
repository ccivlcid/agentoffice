import { request, post, put, del } from "./client";

export interface ProjectRule {
  id: string;
  name: string;
  title: string;
  description: string;
  content: string;
  category: string;
  globs: string;
  always_apply: number;
  providers: string;
  enabled: number;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface RulePreset {
  name: string;
  title: string;
  titleKo: string;
  description: string;
  descriptionKo: string;
  category: string;
  content: string;
  alwaysApply: boolean;
  globs: string[];
}

export async function getRules(search?: string): Promise<ProjectRule[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  const j = await request<{ ok: boolean; rules: ProjectRule[] }>(`/api/rules${qs}`);
  return j.rules;
}

export async function createRule(input: {
  name: string;
  title?: string;
  description?: string;
  content?: string;
  category?: string;
  globs?: string[];
  always_apply?: boolean;
  providers?: string[];
}): Promise<{ ok: boolean; id: string }> {
  return post("/api/rules", input) as Promise<{ ok: boolean; id: string }>;
}

export async function updateRule(id: string, patch: Record<string, unknown>): Promise<{ ok: boolean }> {
  return put(`/api/rules/${id}`, patch) as Promise<{ ok: boolean }>;
}

export async function deleteRule(id: string): Promise<{ ok: boolean }> {
  return del(`/api/rules/${id}`) as Promise<{ ok: boolean }>;
}

export async function toggleRule(id: string): Promise<{ ok: boolean; enabled: number }> {
  return post(`/api/rules/${id}/toggle`, {}) as Promise<{ ok: boolean; enabled: number }>;
}

export async function syncRules(): Promise<{ ok: boolean; synced: string[] }> {
  return post("/api/rules/sync", {}) as Promise<{ ok: boolean; synced: string[] }>;
}

export async function scanProjectRules(): Promise<{ scanned: number; imported: number }> {
  return post("/api/rules/scan", {}) as Promise<{ scanned: number; imported: number }>;
}

export async function getRulePresets(): Promise<RulePreset[]> {
  const j = await request<{ ok: boolean; presets: RulePreset[] }>("/api/rules/presets");
  return j.presets;
}
