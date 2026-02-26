import type { Agent } from '../../types';
import type { LangText } from '../../i18n';

export const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-green-400',
  working: 'bg-blue-400',
  break: 'bg-yellow-400',
  offline: 'bg-gray-500',
};

export const STATUS_LABELS: Record<string, LangText> = {
  idle: { ko: '대기중', en: 'Idle' },
  working: { ko: '작업중', en: 'Working' },
  break: { ko: '휴식', en: 'Break' },
  offline: { ko: '오프라인', en: 'Offline' },
};

export const ROLE_LABELS: Record<string, LangText> = {
  team_leader: { ko: '팀장', en: 'Team Leader' },
  senior: { ko: '시니어', en: 'Senior' },
  junior: { ko: '주니어', en: 'Junior' },
  intern: { ko: '인턴', en: 'Intern' },
};

export function formatTime(ts: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export function isPromiseLike(value: unknown): value is Promise<void> {
  return !!value && typeof (value as { then?: unknown }).then === 'function';
}

export function getAgentName(agent: Agent | null | undefined, isKorean: boolean): string {
  if (!agent) return '';
  return isKorean ? agent.name_ko || agent.name : agent.name || agent.name_ko;
}
