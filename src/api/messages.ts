import type { Message, ReceiverType, MessageType } from '../types';
import { request, del, postWithIdempotency, makeIdempotencyKey, extractMessageId } from './client';

export async function getMessages(params?: {
  receiver_type?: ReceiverType;
  receiver_id?: string;
  limit?: number;
}): Promise<Message[]> {
  const sp = new URLSearchParams();
  if (params?.receiver_type) sp.set('receiver_type', params.receiver_type);
  if (params?.receiver_id) sp.set('receiver_id', params.receiver_id);
  if (params?.limit) sp.set('limit', String(params.limit));
  const q = sp.toString();
  const j = await request<{ messages: Message[] }>(
    `/api/messages${q ? '?' + q : ''}`,
  );
  return j.messages;
}

export type DecisionInboxRouteOption = {
  number: number;
  action: string;
  label?: string;
};

export type DecisionInboxRouteItem = {
  id: string;
  kind: 'project_review_ready' | 'task_timeout_resume' | 'review_round_pick';
  created_at: number;
  summary: string;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_name_ko?: string | null;
  agent_avatar?: string | null;
  project_id: string | null;
  project_name: string | null;
  project_path: string | null;
  task_id: string | null;
  task_title: string | null;
  meeting_id?: string | null;
  review_round?: number | null;
  options: DecisionInboxRouteOption[];
};

export type DecisionInboxReplyResult = {
  ok: boolean;
  resolved: boolean;
  kind: 'project_review_ready' | 'task_timeout_resume' | 'review_round_pick';
  action: string;
  started_task_ids?: string[];
  task_id?: string;
};

export async function getDecisionInbox(): Promise<DecisionInboxRouteItem[]> {
  const j = await request<{ items: DecisionInboxRouteItem[] }>(
    '/api/decision-inbox',
  );
  return j.items ?? [];
}

export async function replyDecisionInbox(
  id: string,
  optionNumber: number,
  payload?: {
    note?: string;
    target_task_id?: string;
    selected_option_numbers?: number[];
  },
): Promise<DecisionInboxReplyResult> {
  return request<DecisionInboxReplyResult>(
    `/api/decision-inbox/${encodeURIComponent(id)}/reply`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        option_number: optionNumber,
        ...(payload?.note ? { note: payload.note } : {}),
        ...(payload?.target_task_id
          ? { target_task_id: payload.target_task_id }
          : {}),
        ...(payload &&
        Object.prototype.hasOwnProperty.call(
          payload,
          'selected_option_numbers',
        )
          ? { selected_option_numbers: payload.selected_option_numbers }
          : {}),
      }),
    },
  );
}

export async function sendMessage(input: {
  receiver_type: ReceiverType;
  receiver_id?: string;
  content: string;
  message_type?: MessageType;
  task_id?: string;
  project_id?: string;
  project_path?: string;
  project_context?: string;
}): Promise<string> {
  const idempotencyKey = makeIdempotencyKey('ceo-message');
  const j = await postWithIdempotency<{
    id?: string;
    message?: { id?: string };
  }>('/api/messages', { sender_type: 'ceo', ...input }, idempotencyKey);
  return extractMessageId(j);
}

export async function sendAnnouncement(content: string): Promise<string> {
  const idempotencyKey = makeIdempotencyKey('ceo-announcement');
  const j = await postWithIdempotency<{
    id?: string;
    message?: { id?: string };
  }>('/api/announcements', { content }, idempotencyKey);
  return extractMessageId(j);
}

/** 팀장 회의 전용: 팀장만 수신·답변하는 채널로 전송 */
export async function sendAnnouncementToTeamLeaders(content: string): Promise<string> {
  const idempotencyKey = makeIdempotencyKey('ceo-announcement-team-leaders');
  const j = await postWithIdempotency<{
    id?: string;
    message?: { id?: string };
  }>('/api/announcements/team-leaders', { content }, idempotencyKey);
  return extractMessageId(j);
}

export async function sendDirective(content: string): Promise<string> {
  const idempotencyKey = makeIdempotencyKey('ceo-directive');
  const j = await postWithIdempotency<{
    id?: string;
    message?: { id?: string };
  }>('/api/directives', { content }, idempotencyKey);
  return extractMessageId(j);
}

export async function sendDirectiveWithProject(input: {
  content: string;
  project_id?: string;
  project_path?: string;
  project_context?: string;
}): Promise<string> {
  const idempotencyKey = makeIdempotencyKey('ceo-directive');
  const j = await postWithIdempotency<{
    id?: string;
    message?: { id?: string };
  }>('/api/directives', input, idempotencyKey);
  return extractMessageId(j);
}

export async function clearMessages(agentId?: string): Promise<void> {
  const params = new URLSearchParams();
  if (agentId) {
    params.set('agent_id', agentId);
  } else {
    params.set('scope', 'announcements');
  }
  await del(`/api/messages?${params.toString()}`);
}
