import { request, post, del } from './client';

export type GatewayTarget = {
  sessionKey: string;
  displayName: string;
  channel: string;
  to: string;
};

/** Messenger session for channel message settings (list/edit). */
export type MessengerSession = {
  id: string;
  channel: string;
  target: string;
  display_name: string;
  agent_id: string | null;
  session_key: string;
  active: number;
  created_at: number | null;
  updated_at: number | null;
  agent_name: string | null;
  agent_name_ko: string | null;
  agent_avatar_emoji: string | null;
  agent_sprite_number?: number | null;
};

export async function getGatewayTargets(): Promise<GatewayTarget[]> {
  try {
    const data = await request<{ targets?: GatewayTarget[] }>(
      '/api/gateway/targets',
    );
    return data?.targets ?? [];
  } catch {
    return [];
  }
}

export async function getGatewaySessions(): Promise<MessengerSession[]> {
  const data = await request<{ sessions?: MessengerSession[] }>(
    '/api/gateway/sessions',
  );
  return data?.sessions ?? [];
}

export type GatewaySessionPayload = {
  id?: string;
  channel: string;
  target: string;
  display_name: string;
  token?: string;
  agent_id?: string | null;
  active?: boolean;
};

export async function saveGatewaySession(
  payload: GatewaySessionPayload,
): Promise<{ ok: boolean; session?: MessengerSession; error?: string }> {
  const body: Record<string, unknown> = {
    channel: payload.channel.trim(),
    target: payload.target.trim(),
    display_name: payload.display_name.trim(),
    agent_id: payload.agent_id ?? null,
    active: payload.active !== false,
  };
  if (payload.id) body.id = payload.id;
  if (payload.token !== undefined) body.token = payload.token;
  const res = await post('/api/gateway/sessions', body);
  return res as { ok: boolean; session?: MessengerSession; error?: string };
}

export async function deleteGatewaySession(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  return del(`/api/gateway/sessions/${id}`) as Promise<{
    ok: boolean;
    error?: string;
  }>;
}

export async function sendGatewayMessage(
  sessionKey: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  return post('/api/gateway/send', { sessionKey, text }) as Promise<{
    ok: boolean;
    error?: string;
  }>;
}
