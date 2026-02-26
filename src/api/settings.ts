import type {
  CompanySettings,
  CompanyStats,
  CliStatusMap,
  RoomTheme,
} from '../types';
import { request, post, put } from './client';

export async function getCliStatus(refresh?: boolean): Promise<CliStatusMap> {
  const q = refresh ? '?refresh=1' : '';
  const j = await request<{ providers: CliStatusMap }>(`/api/cli-status${q}`);
  return j.providers;
}

export async function getStats(): Promise<CompanyStats> {
  const j = await request<{ stats: CompanyStats }>('/api/stats');
  return j.stats;
}

export async function getSettings(): Promise<CompanySettings> {
  const j = await request<{ settings: CompanySettings }>('/api/settings');
  return j.settings;
}

export async function getSettingsRaw(): Promise<Record<string, unknown>> {
  const j = await request<{ settings: Record<string, unknown> }>(
    '/api/settings',
  );
  return j.settings;
}

export async function saveSettings(
  settings: CompanySettings,
): Promise<void> {
  await put('/api/settings', settings);
}

export async function saveSettingsPatch(
  patch: Record<string, unknown>,
): Promise<void> {
  await put('/api/settings', patch);
}

export async function saveRoomThemes(
  roomThemes: Record<string, RoomTheme>,
): Promise<void> {
  await put('/api/settings', { roomThemes });
}

export interface UpdateStatus {
  current_version: string;
  latest_version: string | null;
  update_available: boolean;
  release_url: string | null;
  checked_at: number;
  enabled: boolean;
  repo: string;
  error: string | null;
}

export async function getUpdateStatus(
  refresh?: boolean,
): Promise<UpdateStatus> {
  const q = refresh ? '?refresh=1' : '';
  const j = await request<UpdateStatus & { ok?: boolean }>(
    `/api/update-status${q}`,
  );
  const { ok: _ok, ...status } = j;
  return status;
}

export async function setAutoUpdateEnabled(enabled: boolean): Promise<void> {
  await post('/api/update-auto-config', { enabled });
}
