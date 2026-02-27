import { request, post, put, del } from './client';

export interface McpServer {
  id: string;
  name: string;
  server_key: string;
  package: string;
  command: string;
  args: string;
  env: string;
  description: string;
  category: string;
  enabled: number;
  providers: string;
  source: string;
  created_at: number;
  updated_at: number;
}

export interface McpPreset {
  name: string;
  serverKey: string;
  package: string;
  command: string;
  args: string[];
  category: string;
  description: string;
  descriptionKo: string;
}

export async function getMcpServers(search?: string): Promise<McpServer[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  const j = await request<{ ok: boolean; servers: McpServer[] }>(`/api/mcp-servers${qs}`);
  return j.servers;
}

export async function createMcpServer(input: {
  name: string;
  server_key: string;
  package?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  description?: string;
  category?: string;
  providers?: string[];
}): Promise<{ ok: boolean; id: string }> {
  return post('/api/mcp-servers', input) as Promise<{ ok: boolean; id: string }>;
}

export async function updateMcpServer(id: string, patch: Record<string, unknown>): Promise<{ ok: boolean }> {
  return put(`/api/mcp-servers/${id}`, patch) as Promise<{ ok: boolean }>;
}

export async function deleteMcpServer(id: string): Promise<{ ok: boolean }> {
  return del(`/api/mcp-servers/${id}`) as Promise<{ ok: boolean }>;
}

export async function toggleMcpServer(id: string): Promise<{ ok: boolean; enabled: number }> {
  return post(`/api/mcp-servers/${id}/toggle`, {}) as Promise<{ ok: boolean; enabled: number }>;
}

export async function syncMcpServers(): Promise<{ ok: boolean; synced: string[] }> {
  return post('/api/mcp-servers/sync', {}) as Promise<{ ok: boolean; synced: string[] }>;
}

export async function getMcpPresets(): Promise<McpPreset[]> {
  const j = await request<{ ok: boolean; presets: McpPreset[] }>('/api/mcp-servers/presets');
  return j.presets;
}

// ── MCP Registry ──

export interface McpRegistryEntry {
  name: string;
  title: string;
  description: string;
  repoUrl: string;
  websiteUrl: string;
  version: string;
  iconUrl: string;
  packages: Array<{
    registryType: string;
    identifier: string;
    transportType: string;
    envVars: Array<{ name: string; description: string; isSecret: boolean }>;
  }>;
  remotes: Array<{ type: string; url: string }>;
  publishedAt: string;
  updatedAt: string;
}

export async function getMcpRegistry(search?: string): Promise<{ servers: McpRegistryEntry[]; total: number }> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : '';
  return request<{ ok: boolean; servers: McpRegistryEntry[]; total: number }>(`/api/mcp-registry${qs}`);
}
