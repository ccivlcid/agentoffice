import type { CliModelInfo } from '../types';
import { request, post, put } from './client';

export interface OAuthAccountInfo {
  id: string;
  label: string | null;
  email: string | null;
  source: string | null;
  scope: string | null;
  status: 'active' | 'disabled';
  priority: number;
  expires_at: number | null;
  hasRefreshToken: boolean;
  executionReady: boolean;
  active: boolean;
  modelOverride?: string | null;
  failureCount?: number;
  lastError?: string | null;
  lastErrorAt?: number | null;
  lastSuccessAt?: number | null;
  created_at: number;
  updated_at: number;
}

export interface OAuthProviderStatus {
  connected: boolean;
  detected?: boolean;
  executionReady?: boolean;
  requiresWebOAuth?: boolean;
  source: string | null;
  email: string | null;
  scope: string | null;
  expires_at: number | null;
  created_at: number;
  updated_at: number;
  webConnectable: boolean;
  hasRefreshToken?: boolean;
  refreshFailed?: boolean;
  lastRefreshed?: number | null;
  activeAccountId?: string | null;
  activeAccountIds?: string[];
  accounts?: OAuthAccountInfo[];
}

export type OAuthConnectProvider = 'github-copilot' | 'antigravity';

export interface OAuthStatus {
  storageReady: boolean;
  providers: Record<string, OAuthProviderStatus>;
}

export async function getOAuthStatus(): Promise<OAuthStatus> {
  return request<OAuthStatus>('/api/oauth/status');
}

export function getOAuthStartUrl(
  provider: OAuthConnectProvider,
  redirectTo: string,
): string {
  const params = new URLSearchParams({ provider, redirect_to: redirectTo });
  return `/api/oauth/start?${params.toString()}`;
}

export async function disconnectOAuth(
  provider: OAuthConnectProvider,
): Promise<void> {
  await post('/api/oauth/disconnect', { provider });
}

export interface OAuthRefreshResult {
  ok: boolean;
  expires_at: number | null;
  refreshed_at: number;
}

export async function refreshOAuthToken(
  provider: OAuthConnectProvider,
): Promise<OAuthRefreshResult> {
  return post('/api/oauth/refresh', { provider }) as Promise<OAuthRefreshResult>;
}

export async function activateOAuthAccount(
  provider: OAuthConnectProvider,
  accountId: string,
  mode: 'exclusive' | 'add' | 'remove' | 'toggle' = 'exclusive',
): Promise<{ ok: boolean; activeAccountIds?: string[] }> {
  return post('/api/oauth/accounts/activate', {
    provider,
    account_id: accountId,
    mode,
  }) as Promise<{ ok: boolean; activeAccountIds?: string[] }>;
}

export async function updateOAuthAccount(
  accountId: string,
  patch: {
    label?: string | null;
    model_override?: string | null;
    priority?: number;
    status?: 'active' | 'disabled';
  },
): Promise<{ ok: boolean }> {
  return put(`/api/oauth/accounts/${accountId}`, patch) as Promise<{
    ok: boolean;
  }>;
}

export async function deleteOAuthAccount(
  provider: OAuthConnectProvider,
  accountId: string,
): Promise<{ ok: boolean }> {
  return post('/api/oauth/disconnect', {
    provider,
    account_id: accountId,
  }) as Promise<{ ok: boolean }>;
}

export interface DeviceCodeStart {
  stateId: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface DevicePollResult {
  status:
    | 'pending'
    | 'complete'
    | 'slow_down'
    | 'expired'
    | 'denied'
    | 'error';
  email?: string | null;
  error?: string;
}

export async function startGitHubDeviceFlow(): Promise<DeviceCodeStart> {
  return post('/api/oauth/github-copilot/device-start') as Promise<DeviceCodeStart>;
}

export async function pollGitHubDevice(
  stateId: string,
): Promise<DevicePollResult> {
  return post('/api/oauth/github-copilot/device-poll', {
    stateId,
  }) as Promise<DevicePollResult>;
}

export async function getOAuthModels(
  refresh = false,
): Promise<Record<string, string[]>> {
  const qs = refresh ? '?refresh=true' : '';
  const j = await request<{ models: Record<string, string[]> }>(
    `/api/oauth/models${qs}`,
  );
  return j.models;
}

export async function getCliModels(
  refresh = false,
): Promise<Record<string, CliModelInfo[]>> {
  const qs = refresh ? '?refresh=true' : '';
  const j = await request<{ models: Record<string, CliModelInfo[]> }>(
    `/api/cli-models${qs}`,
  );
  return j.models;
}
