import { request, post } from './client';

export type GatewayTarget = {
  sessionKey: string;
  displayName: string;
  channel: string;
  to: string;
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

export async function sendGatewayMessage(
  sessionKey: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  return post('/api/gateway/send', { sessionKey, text }) as Promise<{
    ok: boolean;
    error?: string;
  }>;
}
