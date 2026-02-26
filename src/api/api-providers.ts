import { request, post, put, del } from './client';

export type ApiProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'ollama'
  | 'openrouter'
  | 'together'
  | 'groq'
  | 'cerebras'
  | 'custom';

export interface ApiProvider {
  id: string;
  name: string;
  type: ApiProviderType;
  base_url: string;
  has_api_key: boolean;
  enabled: boolean;
  models_cache: string[];
  models_cached_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ApiProviderPreset {
  base_url: string;
  models_path: string;
  auth_header: string;
}

export async function getApiProviders(): Promise<ApiProvider[]> {
  const j = await request<{ ok: boolean; providers: ApiProvider[] }>(
    '/api/api-providers',
  );
  return j.providers;
}

export async function createApiProvider(input: {
  name: string;
  type: ApiProviderType;
  base_url: string;
  api_key?: string;
}): Promise<{ ok: boolean; id: string }> {
  return post('/api/api-providers', input) as Promise<{
    ok: boolean;
    id: string;
  }>;
}

export async function updateApiProvider(
  id: string,
  patch_data: {
    name?: string;
    type?: ApiProviderType;
    base_url?: string;
    api_key?: string;
    enabled?: boolean;
  },
): Promise<{ ok: boolean }> {
  return put(`/api/api-providers/${id}`, patch_data) as Promise<{
    ok: boolean;
  }>;
}

export async function deleteApiProvider(
  id: string,
): Promise<{ ok: boolean }> {
  return del(`/api/api-providers/${id}`) as Promise<{ ok: boolean }>;
}

export async function testApiProvider(id: string): Promise<{
  ok: boolean;
  model_count?: number;
  models?: string[];
  error?: string;
  status?: number;
}> {
  return post(`/api/api-providers/${id}/test`) as Promise<{
    ok: boolean;
    model_count?: number;
    models?: string[];
    error?: string;
    status?: number;
  }>;
}

export async function getApiProviderModels(
  id: string,
  refresh = false,
): Promise<{
  ok: boolean;
  models: string[];
  cached?: boolean;
  stale?: boolean;
}> {
  const qs = refresh ? '?refresh=true' : '';
  return request(
    `/api/api-providers/${id}/models${qs}`,
  );
}

export async function getApiProviderPresets(): Promise<
  Record<string, ApiProviderPreset>
> {
  const j = await request<{
    ok: boolean;
    presets: Record<string, ApiProviderPreset>;
  }>('/api/api-providers/presets');
  return j.presets;
}
